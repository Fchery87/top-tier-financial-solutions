/**
 * Database Encryption Helper
 * Provides utilities for encrypting/decrypting data at the database boundary
 *
 * PII Fields to encrypt:
 * - clients: firstName, lastName, dateOfBirth, ssnLast4, streetAddress, city, state, zipCode, phone
 * - creditAccounts: creditorName, originalCreditor
 * - negativeItems: creditorName
 */

import { decrypt, encrypt, isCiphertextValue } from './encryption';
import { logServerEvent } from '@/lib/server-logger';

// List of fields that should be encrypted in each table
export const ENCRYPTED_FIELDS = {
  clients: [
    'firstName',
    'lastName',
    'dateOfBirth',
    'ssnLast4',
    'streetAddress',
    'city',
    'state',
    'zipCode',
    'phone',
  ] as const,

  creditAccounts: [
    'creditorName',
  ] as const,

  negativeItems: [
    'creditorName',
  ] as const,

  disputes: [
    'creditorName',
  ] as const,
};

type ClientEncryptedField = (typeof ENCRYPTED_FIELDS.clients)[number];

export type ClientEncryptionFields = {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  ssnLast4: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
};

export type ClientEncryptionInput = Partial<ClientEncryptionFields>;

/** Value decryptClientData and friends return for a field that could not be decrypted. */
export const DECRYPTION_FAILED = '[decryption-failed]';

function safeDecryptValue(value: unknown): unknown {
  if (!value) return value;

  if (!isCiphertextValue(value)) {
    return value;
  }

  try {
    return decrypt(value);
  } catch (error) {
    logServerEvent({
      level: 'error',
      event: 'server.lib.db.encryption.decrypt.failed',
      error,
    });
    return DECRYPTION_FAILED;
  }
}

/**
 * Encrypt PII before inserting into database
 * Usage in API routes:
 *   const encrypted = encryptClientData({firstName: 'John', ...});
 *   await db.insert(clients).values(encrypted);
 */
export function encryptClientData(data: ClientEncryptionFields): ClientEncryptionFields;
export function encryptClientData(data: ClientEncryptionInput): ClientEncryptionInput;
export function encryptClientData(data: ClientEncryptionInput): ClientEncryptionInput {
  const encrypted = { ...data };

  for (const field of ENCRYPTED_FIELDS.clients satisfies readonly ClientEncryptedField[]) {
    const value = encrypted[field];
    if (value) {
      const encryptedValue = encrypt(value);
      if (encryptedValue) {
        encrypted[field] = encryptedValue;
      }
    }
  }

  return encrypted;
}

/**
 * Decrypt PII after retrieving from database
 * Usage in API routes:
 *   const [dbRecord] = await db.select().from(clients).where(...);
 *   const decrypted = decryptClientData(dbRecord);
 */
export function decryptClientData(data: Record<string, unknown>) {
  const decrypted = { ...data };

  for (const field of ENCRYPTED_FIELDS.clients) {
    if (field in decrypted && decrypted[field]) {
      decrypted[field] = safeDecryptValue(decrypted[field]);
    }
  }

  return decrypted;
}

/**
 * Encrypt credit account data
 */
export function encryptCreditAccountData(data: Record<string, unknown>) {
  const encrypted = { ...data };

  for (const field of ENCRYPTED_FIELDS.creditAccounts) {
    if (field in encrypted && encrypted[field]) {
      encrypted[field] = encrypt(String(encrypted[field]));
    }
  }

  return encrypted;
}

/**
 * Decrypt credit account data
 */
export function decryptCreditAccountData(data: Record<string, unknown>) {
  const decrypted = { ...data };

  for (const field of ENCRYPTED_FIELDS.creditAccounts) {
    if (field in decrypted && decrypted[field]) {
      decrypted[field] = safeDecryptValue(decrypted[field]);
    }
  }

  return decrypted;
}

/**
 * Encrypt negative item data
 */
export function encryptNegativeItemData(data: Record<string, unknown>) {
  const encrypted = { ...data };

  for (const field of ENCRYPTED_FIELDS.negativeItems) {
    if (field in encrypted && encrypted[field]) {
      encrypted[field] = encrypt(String(encrypted[field]));
    }
  }

  return encrypted;
}

/**
 * Decrypt negative item data
 */
export function decryptNegativeItemData(data: Record<string, unknown>) {
  const decrypted = { ...data };

  for (const field of ENCRYPTED_FIELDS.negativeItems) {
    if (field in decrypted && decrypted[field]) {
      decrypted[field] = safeDecryptValue(decrypted[field]);
    }
  }

  return decrypted;
}

/**
 * Encrypt dispute data
 */
export function encryptDisputeData(data: Record<string, unknown>) {
  const encrypted = { ...data };

  for (const field of ENCRYPTED_FIELDS.disputes) {
    if (field in encrypted && encrypted[field]) {
      encrypted[field] = encrypt(String(encrypted[field]));
    }
  }

  return encrypted;
}

/**
 * Decrypt dispute data
 */
export function decryptDisputeData(data: Record<string, unknown>) {
  const decrypted = { ...data };

  for (const field of ENCRYPTED_FIELDS.disputes) {
    if (field in decrypted && decrypted[field]) {
      decrypted[field] = safeDecryptValue(decrypted[field]);
    }
  }

  return decrypted;
}
