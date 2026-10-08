import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  clients,
  creditReports,
  feeConfigurations,
  invoicePayments,
  invoices,
  serviceEngagements,
  servicesRenderedEvents,
} from '@/db/schema';
import { buildComplianceGateStatus } from '@/lib/compliance-gate';
import { decideInvoicePayable, describeBlocker } from '@/lib/billing-readiness';
import { loadFeePlan, loadPayableFacts } from '@/lib/billing-facts';
import { summarizeInvoice, type InvoiceStatus } from '@/lib/invoice-ledger';

const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;

/** Everything the client Billing tab renders, in one read. Null when the client does not exist. */
export async function loadClientBilling(clientId: string, now: Date) {
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return null;

  const feePlan = await loadFeePlan(clientId);

  const feeConfigs = await db
    .select({
      id: feeConfigurations.id,
      name: feeConfigurations.name,
      feeModel: feeConfigurations.feeModel,
      amount: feeConfigurations.amount,
      frequency: feeConfigurations.frequency,
      setupFee: feeConfigurations.setupFee,
    })
    .from(feeConfigurations)
    .where(eq(feeConfigurations.isActive, true))
    .orderBy(asc(feeConfigurations.name));

  const engagementRows = await db
    .select()
    .from(serviceEngagements)
    .where(eq(serviceEngagements.clientId, clientId))
    .orderBy(desc(serviceEngagements.openedAt));

  const engagements = [];
  for (const engagement of engagementRows) {
    const loaded = await loadPayableFacts(engagement.id, now);
    const decision = loaded ? decideInvoicePayable(loaded.facts) : null;
    engagements.push({
      id: engagement.id,
      service_type: engagement.serviceType,
      status: engagement.status,
      lifecycle_stage: engagement.lifecycleStage,
      opened_at: iso(engagement.openedAt),
      sales_channel: engagement.salesChannel,
      service_period_ends_at: iso(engagement.servicePeriodEndsAt),
      results_achieved_at: iso(engagement.resultsAchievedAt),
      results_verification_report_id: engagement.resultsVerificationReportId,
      results_verification_report_date: iso(engagement.resultsVerificationReportDate),
      results_verified_at: iso(engagement.resultsVerifiedAt),
      gate: buildComplianceGateStatus(loaded?.gateRecords ?? []),
      payable: decision?.payable === true,
      blockers: decision && !decision.payable
        ? decision.blockers.map((blocker) => ({ kind: blocker.kind, message: describeBlocker(blocker) }))
        : [],
    });
  }

  const events = await db
    .select()
    .from(servicesRenderedEvents)
    .where(eq(servicesRenderedEvents.clientId, clientId))
    .orderBy(desc(servicesRenderedEvents.occurredAt));

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.clientId, clientId))
    .orderBy(desc(invoices.createdAt));

  const ledgerRows = await db
    .select()
    .from(invoicePayments)
    .where(eq(invoicePayments.clientId, clientId))
    .orderBy(desc(invoicePayments.receivedAt));

  const reports = await db
    .select({
      id: creditReports.id,
      bureau: creditReports.bureau,
      reportDate: creditReports.reportDate,
      fileName: creditReports.fileName,
    })
    .from(creditReports)
    .where(eq(creditReports.clientId, clientId))
    .orderBy(desc(creditReports.reportDate));

  const openInvoiceByEvent = new Map(invoiceRows
    .filter((invoice) => invoice.servicesRenderedEventId && invoice.status !== 'void')
    .map((invoice) => [invoice.servicesRenderedEventId, invoice.id]));

  return {
    client_id: clientId,
    fee_plan: feePlan && {
      billing_profile_id: feePlan.billingProfileId,
      fee_config_id: feePlan.feeConfigId,
      name: feePlan.name,
      fee_model: feePlan.feeModel,
      amount_cents: feePlan.amountCents,
      frequency: feePlan.frequency,
      setup_fee_cents: feePlan.setupFeeCents,
    },
    fee_configs: feeConfigs.map((config) => ({
      id: config.id,
      name: config.name,
      fee_model: config.feeModel,
      amount_cents: config.amount,
      frequency: config.frequency,
      setup_fee_cents: config.setupFee ?? 0,
    })),
    engagements,
    services_rendered: events.map((event) => ({
      id: event.id,
      service_engagement_id: event.serviceEngagementId,
      event_type: event.eventType,
      occurred_at: iso(event.occurredAt),
      notes: event.notes,
      invoice_id: openInvoiceByEvent.get(event.id) ?? null,
    })),
    invoices: invoiceRows.map((invoice) => {
      const summary = summarizeInvoice(
        { amountCents: invoice.amount, status: (invoice.status ?? 'draft') as InvoiceStatus },
        ledgerRows.filter((entry) => entry.invoiceId === invoice.id),
      );
      return {
        id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        service_engagement_id: invoice.serviceEngagementId,
        services_rendered_event_id: invoice.servicesRenderedEventId,
        amount_cents: invoice.amount,
        description: invoice.description,
        due_date: iso(invoice.dueDate),
        created_at: iso(invoice.createdAt),
        paid_cents: summary.paidCents,
        refunded_cents: summary.refundedCents,
        net_paid_cents: summary.netPaidCents,
        balance_cents: summary.balanceCents,
        status: summary.status,
      };
    }),
    ledger: ledgerRows.map((entry) => ({
      id: entry.id,
      invoice_id: entry.invoiceId,
      kind: entry.kind,
      method: entry.method,
      amount_cents: entry.amountCents,
      reference: entry.reference,
      received_at: iso(entry.receivedAt),
      notes: entry.notes,
      created_at: iso(entry.createdAt),
    })),
    credit_reports: reports.map((report) => ({
      id: report.id,
      bureau: report.bureau,
      report_date: iso(report.reportDate),
      file_name: report.fileName,
    })),
  };
}

export type ClientBillingView = NonNullable<Awaited<ReturnType<typeof loadClientBilling>>>;
