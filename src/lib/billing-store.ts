import { randomBytes, randomUUID } from 'crypto';
import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  creditReports,
  invoicePayments,
  invoices,
  paymentAuditLog,
  serviceEngagements,
  servicesRenderedEvents,
} from '@/db/schema';
import { decideInvoicePayable, type Blocker, type PayableDecision, type SalesChannel } from '@/lib/billing-readiness';
import { loadPayableFacts, QUALIFYING_SERVICES_RENDERED_EVENT } from '@/lib/billing-facts';
import {
  decideLedgerCommand,
  type InvoiceStatus,
  type InvoiceSummary,
  type LedgerCommand,
  type LedgerDecision,
} from '@/lib/invoice-ledger';
import { recordAdminActivity } from '@/lib/admin-activity';

function uniqueViolationConstraint(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as { code?: string; constraint?: string; cause?: unknown };
    if (candidate.code === '23505') return candidate.constraint ?? '';
    current = candidate.cause;
  }
  return null;
}

function generateInvoiceNumber(now: Date): string {
  const year = now.getUTCFullYear().toString().slice(-2);
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  return `INV-${year}${month}-${randomBytes(5).toString('hex').toUpperCase()}`;
}

const INVOICE_NUMBER_ATTEMPTS = 5;

export type CreateInvoiceInput = {
  clientId: string;
  serviceEngagementId: string;
  servicesRenderedEventId: string | null;
  invoiceServiceType: string | null;
  amountCents: unknown;
  description: string | null;
  dueDate: Date | null;
  actorUserId: string;
  ipAddress: string | null;
  now: Date;
};

export type CreateInvoiceResult =
  | { result: 'created'; id: string; invoiceNumber: string; amountCents: number }
  | { result: 'rejected'; status: 400 | 404 | 409; code: string; error: string; blockers?: Blocker[] };

export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const [engagement] = await db
    .select({ id: serviceEngagements.id, serviceType: serviceEngagements.serviceType })
    .from(serviceEngagements)
    .where(and(eq(serviceEngagements.id, input.serviceEngagementId), eq(serviceEngagements.clientId, input.clientId)))
    .limit(1);

  if (!engagement) {
    return { result: 'rejected', status: 404, code: 'ENGAGEMENT_NOT_FOUND', error: 'Service engagement not found for client' };
  }

  if (input.invoiceServiceType === 'credit_audit' && engagement.serviceType !== 'credit_audit') {
    return {
      result: 'rejected',
      status: 400,
      code: 'CREDIT_AUDIT_ENGAGEMENT_REQUIRED',
      error: 'Credit Audit invoices require a separate Credit Audit engagement',
    };
  }

  const events = await db
    .select({
      id: servicesRenderedEvents.id,
      eventType: servicesRenderedEvents.eventType,
      occurredAt: servicesRenderedEvents.occurredAt,
    })
    .from(servicesRenderedEvents)
    .where(and(
      eq(servicesRenderedEvents.serviceEngagementId, input.serviceEngagementId),
      eq(servicesRenderedEvents.eventType, QUALIFYING_SERVICES_RENDERED_EVENT),
    ))
    .orderBy(asc(servicesRenderedEvents.occurredAt));

  const invoicedEventIds = new Set((await db
    .select({ eventId: invoices.servicesRenderedEventId })
    .from(invoices)
    .where(and(eq(invoices.serviceEngagementId, input.serviceEngagementId), ne(invoices.status, 'void'))))
    .map((row) => row.eventId));

  const event = input.servicesRenderedEventId
    ? events.find((candidate) => candidate.id === input.servicesRenderedEventId)
    : events.find((candidate) => !invoicedEventIds.has(candidate.id)) ?? events[0];

  if (!event) {
    return {
      result: 'rejected',
      status: 400,
      code: 'SERVICES_RENDERED_EVENT_REQUIRED',
      error: 'A qualifying Services Rendered event is required before an invoice can become payable',
    };
  }

  if (invoicedEventIds.has(event.id)) {
    return {
      result: 'rejected',
      status: 409,
      code: 'SERVICES_RENDERED_EVENT_ALREADY_INVOICED',
      error: 'This services-rendered event already backs an open invoice',
    };
  }

  const loaded = await loadPayableFacts(input.serviceEngagementId, input.now);
  if (!loaded) {
    return { result: 'rejected', status: 404, code: 'ENGAGEMENT_NOT_FOUND', error: 'Service engagement not found for client' };
  }

  const payable = decideInvoicePayable(loaded.facts);
  if (!payable.payable) {
    return {
      result: 'rejected',
      status: 409,
      code: 'INVOICE_NOT_PAYABLE',
      error: 'This engagement cannot be invoiced yet',
      blockers: payable.blockers,
    };
  }

  const amountCents = input.amountCents === undefined || input.amountCents === null
    ? loaded.feePlan?.amountCents
    : input.amountCents;

  if (amountCents === undefined) {
    return { result: 'rejected', status: 400, code: 'AMOUNT_REQUIRED', error: 'Set a fee plan or enter an amount' };
  }
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents <= 0) {
    return { result: 'rejected', status: 400, code: 'AMOUNT_INVALID', error: 'Amount must be a positive whole number of cents' };
  }

  for (let attempt = 0; attempt < INVOICE_NUMBER_ATTEMPTS; attempt += 1) {
    const id = randomUUID();
    const invoiceNumber = generateInvoiceNumber(input.now);
    try {
      await db.transaction(async (tx) => {
        await tx.insert(invoices).values({
          id,
          clientId: input.clientId,
          billingProfileId: loaded.feePlan?.billingProfileId ?? null,
          serviceEngagementId: input.serviceEngagementId,
          servicesRenderedEventId: event.id,
          invoiceNumber,
          amount: amountCents,
          status: 'pending',
          servicesRendered: JSON.stringify({ event_id: event.id, event_type: event.eventType }),
          servicesRenderedAt: event.occurredAt,
          description: input.description,
          dueDate: input.dueDate,
          createdAt: input.now,
          updatedAt: input.now,
        });

        await tx.insert(paymentAuditLog).values({
          id: randomUUID(),
          clientId: input.clientId,
          invoiceId: id,
          action: 'invoice_created',
          details: JSON.stringify({
            invoice_number: invoiceNumber,
            amount: amountCents,
            amount_source: input.amountCents === undefined || input.amountCents === null ? 'fee_plan' : 'staff',
            fee_config_id: loaded.feePlan?.feeConfigId ?? null,
            readiness_reason: 'payable_decision',
            service_engagement_id: input.serviceEngagementId,
            services_rendered_event_id: event.id,
            services_rendered_event_type: event.eventType,
            services_rendered_event_occurred_at: event.occurredAt.toISOString(),
          }),
          performedById: input.actorUserId,
          ipAddress: input.ipAddress,
          createdAt: input.now,
        });
      });
      return { result: 'created', id, invoiceNumber, amountCents };
    } catch (error) {
      const constraint = uniqueViolationConstraint(error);
      if (constraint === 'invoices_one_open_per_services_rendered_event') {
        return {
          result: 'rejected',
          status: 409,
          code: 'SERVICES_RENDERED_EVENT_ALREADY_INVOICED',
          error: 'This services-rendered event already backs an open invoice',
        };
      }
      if (constraint !== 'invoices_invoice_number_unique') throw error;
    }
  }

  throw new Error('Could not allocate a unique invoice number');
}

export type ApplyLedgerResult =
  | { result: 'not_found' }
  | { result: 'rejected'; decision: Extract<LedgerDecision, { ok: false }> }
  | { result: 'applied'; summary: InvoiceSummary; entryId: string | null };

const AUDIT_ACTION: Record<LedgerCommand['type'], string> = {
  record_payment: 'payment_recorded',
  record_refund: 'refund_recorded',
  void: 'invoice_voided',
};

export async function applyLedgerCommand(input: {
  invoiceId: string;
  command: LedgerCommand;
  actorUserId: string;
  ipAddress: string | null;
  now: Date;
}): Promise<ApplyLedgerResult> {
  const [invoice] = await db
    .select({ id: invoices.id, serviceEngagementId: invoices.serviceEngagementId })
    .from(invoices)
    .where(eq(invoices.id, input.invoiceId))
    .limit(1);

  if (!invoice) return { result: 'not_found' };

  let payable: PayableDecision = { payable: false, blockers: [{ kind: 'no_services_rendered' }] };
  if (invoice.serviceEngagementId) {
    const loaded = await loadPayableFacts(invoice.serviceEngagementId, input.now);
    if (loaded) payable = decideInvoicePayable(loaded.facts);
  }

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, input.invoiceId))
      .limit(1)
      .for('update');

    if (!locked) return { result: 'not_found' as const };

    const entries = await tx
      .select({ kind: invoicePayments.kind, amountCents: invoicePayments.amountCents, receivedAt: invoicePayments.receivedAt })
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, locked.id));

    const decision = decideLedgerCommand({
      invoice: { amountCents: locked.amount, status: (locked.status ?? 'draft') as InvoiceStatus },
      entries,
      payable,
      now: input.now,
    }, input.command);

    if (!decision.ok) return { result: 'rejected' as const, decision };

    let entryId: string | null = null;
    if (decision.entry) {
      entryId = randomUUID();
      await tx.insert(invoicePayments).values({
        id: entryId,
        invoiceId: locked.id,
        clientId: locked.clientId,
        kind: decision.entry.kind,
        method: decision.entry.method,
        amountCents: decision.entry.amountCents,
        reference: decision.entry.reference,
        receivedAt: decision.entry.receivedAt,
        notes: decision.entry.notes,
        recordedById: input.actorUserId,
        createdAt: input.now,
      });
    }

    const entry = decision.entry;
    const next = decision.next;
    await tx
      .update(invoices)
      .set({
        status: next.status,
        paidAt: next.status === 'paid' ? (locked.paidAt ?? entry?.receivedAt ?? input.now) : null,
        paymentMethod: entry?.kind === 'payment' ? entry.method : locked.paymentMethod,
        refundedAt: entry?.kind === 'refund' ? entry.receivedAt : locked.refundedAt,
        refundAmount: next.refundedCents > 0 ? next.refundedCents : null,
        refundReason: entry?.kind === 'refund' ? entry.notes : locked.refundReason,
        updatedAt: input.now,
      })
      .where(eq(invoices.id, locked.id));

    await tx.insert(paymentAuditLog).values({
      id: randomUUID(),
      clientId: locked.clientId,
      invoiceId: locked.id,
      action: AUDIT_ACTION[input.command.type],
      details: JSON.stringify({
        ledger_entry_id: entryId,
        method: entry?.method ?? null,
        amount_cents: entry?.amountCents ?? null,
        reference: entry?.reference ?? null,
        received_at: entry?.receivedAt.toISOString() ?? null,
        void_reason: input.command.type === 'void' ? input.command.reason : null,
        previous_status: locked.status,
        status: next.status,
        net_paid_cents: next.netPaidCents,
      }),
      performedById: input.actorUserId,
      ipAddress: input.ipAddress,
      createdAt: input.now,
    });

    return { result: 'applied' as const, summary: next, entryId };
  });
}

export type BillingFactsPatch = {
  salesChannel?: SalesChannel | null;
  servicePeriodEndsAt?: Date | null;
  resultsAchievedAt?: Date | null;
  resultsVerificationReportId?: string | null;
};

export type UpdateBillingFactsResult =
  | { result: 'not_found' }
  | { result: 'rejected'; error: string }
  | { result: 'updated' };

export async function updateEngagementBillingFacts(input: {
  engagementId: string;
  patch: BillingFactsPatch;
  actorUserId: string;
  now: Date;
}): Promise<UpdateBillingFactsResult> {
  const [engagement] = await db
    .select()
    .from(serviceEngagements)
    .where(eq(serviceEngagements.id, input.engagementId))
    .limit(1);

  if (!engagement) return { result: 'not_found' };

  const changes: Partial<typeof serviceEngagements.$inferInsert> = {};
  const { patch } = input;

  if (patch.salesChannel !== undefined) changes.salesChannel = patch.salesChannel;
  if (patch.servicePeriodEndsAt !== undefined) changes.servicePeriodEndsAt = patch.servicePeriodEndsAt;
  if (patch.resultsAchievedAt !== undefined) changes.resultsAchievedAt = patch.resultsAchievedAt;

  if (patch.resultsVerificationReportId !== undefined) {
    if (patch.resultsVerificationReportId === null) {
      Object.assign(changes, {
        resultsVerificationReportId: null,
        resultsVerificationReportDate: null,
        resultsVerifiedById: null,
        resultsVerifiedAt: null,
      });
    } else {
      const [report] = await db
        .select({ id: creditReports.id, reportDate: creditReports.reportDate })
        .from(creditReports)
        .where(and(eq(creditReports.id, patch.resultsVerificationReportId), eq(creditReports.clientId, engagement.clientId)))
        .limit(1);

      if (!report) {
        return { result: 'rejected', error: 'Verification report not found for this client' };
      }
      if (!report.reportDate) {
        return { result: 'rejected', error: 'Verification report has no report date; set it on the report first' };
      }
      Object.assign(changes, {
        resultsVerificationReportId: report.id,
        resultsVerificationReportDate: report.reportDate,
        resultsVerifiedById: input.actorUserId,
        resultsVerifiedAt: input.now,
      });
    }
  }

  if (Object.keys(changes).length === 0) {
    return { result: 'rejected', error: 'No billing facts to update' };
  }

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    const previous = engagement[key as keyof typeof engagement];
    before[key] = previous instanceof Date ? previous.toISOString() : previous;
    after[key] = value instanceof Date ? value.toISOString() : value;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(serviceEngagements)
      .set({ ...changes, updatedAt: input.now })
      .where(eq(serviceEngagements.id, input.engagementId));

    await recordAdminActivity(tx, {
      actorUserId: input.actorUserId,
      action: 'service_engagement.billing_facts_updated',
      subjectType: 'service_engagement',
      subjectId: input.engagementId,
      metadata: { before, after },
    });
  });

  return { result: 'updated' };
}
