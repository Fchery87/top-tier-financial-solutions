import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { paymentAuditLog, paymentAuthorizations } from '@/db/schema';
import { sealAccount } from './account';
import { AccountInputException, type AccountType, type ActiveAuthorization, type Authorization, type PublicAuthorization, type RevokedAuthorization, type SubmitResult } from './types';

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
