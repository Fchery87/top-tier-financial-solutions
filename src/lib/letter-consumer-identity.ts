import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { clients } from '@/db/schema';
import { DECRYPTION_FAILED, decryptClientData } from '@/lib/db-encryption';
import type { LetterConsumerIdentity } from '@/lib/letter-rendering/types';

export type { LetterConsumerIdentity } from '@/lib/letter-rendering/types';

export type LetterIdentityField = keyof LetterConsumerIdentity | 'client';

export const LETTER_IDENTITY_INCOMPLETE = 'LETTER_IDENTITY_INCOMPLETE';

const ADDRESS_FIELDS: LetterIdentityField[] = ['streetAddress', 'city', 'state', 'zip'];

/**
 * The client cannot be named on a letter: a required field is missing, or a
 * field could not be decrypted. `missing` lists the identity fields at fault.
 */
export class LetterIdentityIncompleteError extends Error {
  readonly code = LETTER_IDENTITY_INCOMPLETE;

  constructor(readonly missing: LetterIdentityField[], readonly undecryptable: boolean) {
    super(
      missing.includes('client')
        ? 'Client not found'
        : undecryptable
          ? 'Client identity could not be decrypted; it is required before generating a letter'
          : missing.includes('fullName')
            ? 'Client name is required before generating a letter'
            : 'Client address is required before generating a letter',
    );
    this.name = 'LetterIdentityIncompleteError';
  }
}

/** The 409 body a route returns for `LetterIdentityIncompleteError`. */
export function letterIdentityIncompleteBody(error: LetterIdentityIncompleteError) {
  return { error: error.message, code: error.code, missing: error.missing };
}

type ClientIdentityRow = Pick<
  typeof clients.$inferSelect,
  'firstName' | 'lastName' | 'streetAddress' | 'city' | 'state' | 'zipCode' | 'dateOfBirth' | 'ssnLast4'
>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Decrypts and validates a client row. Throws `LetterIdentityIncompleteError`. */
export function resolveLetterConsumerIdentity(row: ClientIdentityRow): LetterConsumerIdentity {
  const decrypted = decryptClientData({ ...row });
  const firstName = text(decrypted.firstName);
  const lastName = text(decrypted.lastName);
  const fields: Record<keyof LetterConsumerIdentity, string> = {
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    streetAddress: text(decrypted.streetAddress),
    city: text(decrypted.city),
    state: text(decrypted.state),
    zip: text(decrypted.zipCode),
    dateOfBirth: text(decrypted.dateOfBirth),
    ssnLast4: text(decrypted.ssnLast4),
  };

  const failed = (Object.keys(fields) as (keyof LetterConsumerIdentity)[])
    .filter((field) => fields[field].includes(DECRYPTION_FAILED));
  if (failed.length > 0) throw new LetterIdentityIncompleteError(failed, true);

  const missing: LetterIdentityField[] = [];
  if (!firstName || !lastName) missing.push('fullName');
  missing.push(...ADDRESS_FIELDS.filter((field) => !fields[field as keyof LetterConsumerIdentity]));
  if (missing.length > 0) throw new LetterIdentityIncompleteError(missing, false);

  return {
    fullName: fields.fullName,
    streetAddress: fields.streetAddress,
    city: fields.city,
    state: fields.state,
    zip: fields.zip,
    ...(fields.dateOfBirth ? { dateOfBirth: fields.dateOfBirth } : {}),
    ...(fields.ssnLast4 ? { ssnLast4: fields.ssnLast4.slice(-4) } : {}),
  };
}

/**
 * Loads the decrypted identity every dispute letter is written from.
 * Throws `LetterIdentityIncompleteError` when the client is missing, lacks a
 * name or a full address, or has a field that cannot be decrypted.
 */
export async function loadLetterConsumerIdentity(clientId: string): Promise<LetterConsumerIdentity> {
  const [row] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
      streetAddress: clients.streetAddress,
      city: clients.city,
      state: clients.state,
      zipCode: clients.zipCode,
      dateOfBirth: clients.dateOfBirth,
      ssnLast4: clients.ssnLast4,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!row) throw new LetterIdentityIncompleteError(['client'], false);
  return resolveLetterConsumerIdentity(row);
}

export type LetterIdentityResult =
  | { ok: true; identity: LetterConsumerIdentity }
  | { ok: false; error: LetterIdentityIncompleteError };

/** `loadLetterConsumerIdentity` with the incomplete case as a value; other errors still throw. */
export async function tryLoadLetterConsumerIdentity(clientId: string): Promise<LetterIdentityResult> {
  try {
    return { ok: true, identity: await loadLetterConsumerIdentity(clientId) };
  } catch (error) {
    if (error instanceof LetterIdentityIncompleteError) return { ok: false, error };
    throw error;
  }
}
