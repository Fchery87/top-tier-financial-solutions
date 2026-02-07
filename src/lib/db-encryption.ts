/**
 * Database Encryption Helper
 * Provides utilities for encrypting/decrypting data at the database boundary
 *
 * PII Fields to encrypt:
 * - clients: firstName, lastName, dateOfBirth, ssnLast4, streetAddress, city, state, zipCode, phone
 * - creditAccounts: creditorName, originalCreditor
 * - negativeItems: creditorName
 */

import { encrypt, decrypt } from './encryption';

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

function safeDecryptValue(value: unknown): unknown {
  if (!value) return value;

  const raw = String(value);
  const parts = raw.split(':');

  // Only attempt decrypt for values that match our stored ciphertext shape:
  // IV_HEX:ENCRYPTED_HEX where IV is 16 bytes (32 hex chars).
  if (
    parts.length !== 2 ||
    parts[0].length !== 32 ||
    !/^[0-9a-f]+$/i.test(parts[0]) ||
    !/^[0-9a-f]+$/i.test(parts[1])
  ) {
    return value;
  }

  try {
    return decrypt(raw);
  } catch {
    // Backward compatibility: preserve original value when decryption fails
    // (e.g., legacy plaintext rows or data encrypted with a rotated key).
    return value;
  }
}

/**
 * Encrypt PII before inserting into database
 * Usage in API routes:
 *   const encrypted = encryptClientData({firstName: 'John', ...});
 *   await db.insert(clients).values(encrypted);
 */
export function encryptClientData(data: Record<string, unknown>) {
  const encrypted = { ...data };

  for (const field of ENCRYPTED_FIELDS.clients) {
    if (field in encrypted && encrypted[field]) {
      encrypted[field] = encrypt(String(encrypted[field]));
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
