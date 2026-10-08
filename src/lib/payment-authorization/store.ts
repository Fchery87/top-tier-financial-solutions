import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  clientBillingProfiles,
  complianceGateChecks,
  feeConfigurations,
  invoices,
  paymentAuditLog,
  paymentAuthorizations,
  serviceEngagements,
  servicesRenderedEvents,
} from '@/db/schema';
import { sealAccount } from './account';
import { AccountInputException, type AccountType, type ActiveAuthorization, type Authorization, type ChargeFacts, type ChargeRefusal, type PublicAuthorization, type RevokedAuthorization, type SubmitResult } from './types';

type AuthorizationRow = typeof paymentAuthorizations.$inferSelect;

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code === '23505' || candidate.cause?.code === '23505';
}

export class AuthorizationConflictException extends Error {
  readonly code = 'authorization_conflict';

  constructor() {
    super('authorization_conflict');
    this.name = 'AuthorizationConflictException';
  }
}

function requireDate(value: Date | null, field: string): Date {
  if (!value) {
    throw new Error(`Authorization row is missing ${field}`);
  }
  return value;
}

function toAuthorization(row: AuthorizationRow): Authorization {
  const shared = {
    id: row.id,
    clientId: row.clientId,
    bankName: row.bankName,
    accountLast4: row.accountLast4,
    accountType: row.accountType,
    maximumAmountCents: row.maximumAmountCents,
    signedAt: requireDate(row.signedAt, 'signedAt'),
  };

  if (row.status === 'active') {
    return { ...shared, status: 'active', expiresAt: row.expiresAt };
  }
  if (row.status === 'revoked') {
    return {
      ...shared,
      status: 'revoked',
      revokedAt: requireDate(row.revokedAt, 'revokedAt'),
      expiresAt: row.expiresAt,
    };
  }
  return {
    ...shared,
    status: 'expired',
    expiresAt: requireDate(row.expiresAt, 'expiresAt'),
  };
}

function toActive(row: AuthorizationRow): ActiveAuthorization {
  const authorization = toAuthorization(row);
  if (authorization.status !== 'active') {
    throw new Error('Expected an active authorization');
  }
  return authorization;
}

function matchesStoredSubmission(row: AuthorizationRow, sealed: ReturnType<typeof sealAccount>, input: {
  maximumAmountCents: number;
  signatureData: string;
}): boolean {
  return (
    row.bankName === sealed.bankName &&
    row.accountType === sealed.accountType &&
    row.accountLast4 === sealed.accountLast4 &&
    row.maximumAmountCents === input.maximumAmountCents &&
    row.signatureData === input.signatureData &&
    row.routingFingerprint === sealed.routingFingerprint &&
    row.accountFingerprint === sealed.accountFingerprint
  );
}

async function selectActiveRow(clientId: string) {
  const [row] = await db
    .select()
    .from(paymentAuthorizations)
    .where(and(
      eq(paymentAuthorizations.clientId, clientId),
      eq(paymentAuthorizations.status, 'active'),
    ))
    .limit(1);
  return row ?? null;
}

async function expireIfNeeded(row: AuthorizationRow, now: Date): Promise<AuthorizationRow | null> {
  if (!row.expiresAt || row.expiresAt > now) {
    return row;
  }
  await db
    .update(paymentAuthorizations)
    .set({ status: 'expired', updatedAt: now })
    .where(and(
      eq(paymentAuthorizations.id, row.id),
      eq(paymentAuthorizations.status, 'active'),
    ));
  return null;
}

export async function getActiveAuthorization(clientId: string, now: Date): Promise<ActiveAuthorization | null> {
  const row = await selectActiveRow(clientId);
  if (!row) return null;
  const current = await expireIfNeeded(row, now);
  return current ? toActive(current) : null;
}

export async function submitPaymentAuthorization(input: {
  clientId: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: AccountType;
  maximumAmountCents: number;
  signatureData: string;
  signerIpAddress: string | null;
  now: Date;
}): Promise<SubmitResult> {
  const signatureData = input.signatureData.trim();
  if (!Number.isInteger(input.maximumAmountCents) || input.maximumAmountCents <= 0) {
    throw new AccountInputException('MAXIMUM_AMOUNT_INVALID');
  }
  if (!signatureData) {
    throw new AccountInputException('SIGNATURE_REQUIRED');
  }

  const sealed = sealAccount({
    bankName: input.bankName,
    routingNumber: input.routingNumber,
    accountNumber: input.accountNumber,
    accountType: input.accountType,
  });

  try {
    return await db.transaction(async (tx) => {
      const [active] = await tx
        .select()
        .from(paymentAuthorizations)
        .where(and(
          eq(paymentAuthorizations.clientId, input.clientId),
          eq(paymentAuthorizations.status, 'active'),
        ))
        .limit(1)
        .for('update');

      if (active && matchesStoredSubmission(active, sealed, { ...input, signatureData })) {
        return { result: 'unchanged' as const, authorization: toActive(active) };
      }

      let replacedId: string | null = null;
      if (active) {
        replacedId = active.id;
        await tx
          .update(paymentAuthorizations)
          .set({
            status: 'revoked',
            revokedAt: input.now,
            updatedAt: input.now,
          })
          .where(eq(paymentAuthorizations.id, active.id));
      }

      const id = randomUUID();
      await tx.insert(paymentAuthorizations).values({
        id,
        clientId: input.clientId,
        status: 'active',
        bankName: sealed.bankName,
        routingNumberEncrypted: sealed.routingNumberEncrypted,
        accountNumberEncrypted: sealed.accountNumberEncrypted,
        routingFingerprint: sealed.routingFingerprint,
        accountFingerprint: sealed.accountFingerprint,
        accountLast4: sealed.accountLast4,
        accountType: sealed.accountType,
        maximumAmountCents: input.maximumAmountCents,
        signatureData,
        signedAt: input.now,
        signerIpAddress: input.signerIpAddress,
        revokedAt: null,
        expiresAt: null,
        supersededById: null,
        createdAt: input.now,
        updatedAt: input.now,
      });

      if (replacedId) {
        await tx
          .update(paymentAuthorizations)
          .set({ supersededById: id, updatedAt: input.now })
          .where(eq(paymentAuthorizations.id, replacedId));
      }

      await tx.insert(paymentAuditLog).values({
        id: randomUUID(),
        clientId: input.clientId,
        action: 'authorization_signed',
        details: JSON.stringify({
          authorization_id: id,
          account_last4: sealed.accountLast4,
          maximum_amount_cents: input.maximumAmountCents,
          replaced_authorization_id: replacedId,
        }),
        ipAddress: input.signerIpAddress,
        createdAt: input.now,
      });

      return {
        result: 'created' as const,
        authorization: {
          status: 'active' as const,
          id,
          clientId: input.clientId,
          bankName: sealed.bankName,
          accountLast4: sealed.accountLast4,
          accountType: sealed.accountType,
          maximumAmountCents: input.maximumAmountCents,
          signedAt: input.now,
          expiresAt: null,
        },
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AuthorizationConflictException();
    }
    throw error;
  }
}

export async function revokePaymentAuthorization(input: {
  clientId: string;
  signerIpAddress: string | null;
  now: Date;
}): Promise<{ revoked: RevokedAuthorization | null }> {
  const active = await selectActiveRow(input.clientId);
  if (!active) {
    return { revoked: null };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(paymentAuthorizations)
      .set({
        status: 'revoked',
        revokedAt: input.now,
        updatedAt: input.now,
      })
      .where(and(
        eq(paymentAuthorizations.id, active.id),
        eq(paymentAuthorizations.status, 'active'),
      ));

    await tx.insert(paymentAuditLog).values({
      id: randomUUID(),
      clientId: input.clientId,
      action: 'authorization_revoked',
      details: JSON.stringify({
        authorization_id: active.id,
        account_last4: active.accountLast4,
      }),
      ipAddress: input.signerIpAddress,
      createdAt: input.now,
    });
  });

  return {
    revoked: {
      status: 'revoked',
      id: active.id,
      clientId: active.clientId,
      bankName: active.bankName,
      accountLast4: active.accountLast4,
      accountType: active.accountType,
      maximumAmountCents: active.maximumAmountCents,
      signedAt: requireDate(active.signedAt, 'signedAt'),
      revokedAt: input.now,
      expiresAt: active.expiresAt,
    },
  };
}

export function toPublicAuthorization(authorization: Authorization): PublicAuthorization {
  return {
    id: authorization.id,
    clientId: authorization.clientId,
    status: authorization.status,
    bankName: authorization.bankName,
    accountLast4: authorization.accountLast4,
    accountType: authorization.accountType,
    maximumAmountCents: authorization.maximumAmountCents,
    signedAt: authorization.signedAt.toISOString(),
    revokedAt: authorization.status === 'revoked' ? authorization.revokedAt.toISOString() : null,
    expiresAt: authorization.expiresAt ? authorization.expiresAt.toISOString() : null,
  };
}

function parseEngagementId(details: string | null): string | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as { service_engagement_id?: unknown };
    return typeof parsed.service_engagement_id === 'string' && parsed.service_engagement_id
      ? parsed.service_engagement_id
      : null;
  } catch {
    return null;
  }
}

export async function loadChargeFacts(input: {
  invoiceId: string;
  now: Date;
}): Promise<{ found: false } | { found: true; facts: ChargeFacts }> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.invoiceId))
    .limit(1);

  if (!invoice) {
    return { found: false };
  }

  const authorization = await getActiveAuthorization(invoice.clientId, input.now);

  const createdRows = await db
    .select({
      details: paymentAuditLog.details,
      createdAt: paymentAuditLog.createdAt,
    })
    .from(paymentAuditLog)
    .where(and(
      eq(paymentAuditLog.invoiceId, invoice.id),
      eq(paymentAuditLog.action, 'invoice_created'),
    ))
    .orderBy(desc(paymentAuditLog.createdAt));

  const serviceEngagementId = createdRows
    .map((row) => parseEngagementId(row.details))
    .find((id): id is string => Boolean(id)) ?? null;

  let engagementStatus: string | null = null;
  let engagementClosedAt: Date | null = null;
  let gateRecords: ChargeFacts['gateRecords'] = [];

  if (serviceEngagementId) {
    const [engagement] = await db
      .select({
        status: serviceEngagements.status,
        closedAt: serviceEngagements.closedAt,
      })
      .from(serviceEngagements)
      .where(eq(serviceEngagements.id, serviceEngagementId))
      .limit(1);

    if (engagement) {
      engagementStatus = engagement.status;
      engagementClosedAt = engagement.closedAt;
    }

    gateRecords = await db
      .select({
        checkKey: complianceGateChecks.checkKey,
        passed: complianceGateChecks.passed,
        checkedAt: complianceGateChecks.checkedAt,
        notes: complianceGateChecks.notes,
      })
      .from(complianceGateChecks)
      .where(eq(complianceGateChecks.engagementId, serviceEngagementId));
  }

  const renderedConditions = [
    eq(servicesRenderedEvents.clientId, invoice.clientId),
    eq(servicesRenderedEvents.eventType, 'first_dispute_package_submitted'),
  ];
  if (serviceEngagementId) {
    renderedConditions.push(eq(servicesRenderedEvents.serviceEngagementId, serviceEngagementId));
  }

  const [rendered] = await db
    .select({ id: servicesRenderedEvents.id })
    .from(servicesRenderedEvents)
    .where(and(...renderedConditions))
    .limit(1);

  const [profile] = await db
    .select({ feeModel: feeConfigurations.feeModel })
    .from(clientBillingProfiles)
    .leftJoin(feeConfigurations, eq(clientBillingProfiles.feeConfigId, feeConfigurations.id))
    .where(eq(clientBillingProfiles.clientId, invoice.clientId))
    .orderBy(desc(clientBillingProfiles.createdAt))
    .limit(1);

  const status = (invoice.status ?? 'draft') as ChargeFacts['invoiceStatus'];

  return {
    found: true,
    facts: {
      authorization,
      invoiceStatus: status,
      invoiceAmountCents: invoice.amount,
      gateRecords,
      hasQualifyingServicesRenderedEvent: Boolean(rendered) && Boolean(serviceEngagementId),
      feeModel: profile?.feeModel ?? null,
      hasVerifiedResult: false,
      engagementStatus,
      engagementClosedAt,
    },
  };
}

export async function recordCollectionRefusal(input: {
  invoiceId: string;
  outcome: ChargeRefusal;
  authorizationId: string | null;
  performedById: string;
  ipAddress: string | null;
  now: Date;
}): Promise<void> {
  const [invoice] = await db
    .select({ clientId: invoices.clientId })
    .from(invoices)
    .where(eq(invoices.id, input.invoiceId))
    .limit(1);

  const details: Record<string, unknown> = {
    outcome: input.outcome.outcome,
    invoice_id: input.invoiceId,
    authorization_id: input.authorizationId,
    invoice_amount_cents: input.outcome.outcome === 'blocked_above_cap' ? input.outcome.invoiceAmountCents : null,
    maximum_amount_cents: input.outcome.outcome === 'blocked_above_cap' ? input.outcome.maximumAmountCents : null,
  };

  await db.insert(paymentAuditLog).values({
    id: randomUUID(),
    clientId: invoice?.clientId ?? null,
    invoiceId: input.invoiceId,
    action: 'collection_refused',
    details: JSON.stringify(details),
    performedById: input.performedById,
    ipAddress: input.ipAddress,
    createdAt: input.now,
  });
}
