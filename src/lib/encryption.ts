import crypto from 'crypto';

/**
 * PII Encryption Service
 * Encrypts/decrypts sensitive data using AES-256-CBC
 *
 * Design: Each encrypted value includes its own IV (initialization vector)
 * so decryption doesn't require a separate IV
 * Format: IV_HEX:ENCRYPTED_HEX
 */

const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'utf-8';
const CIPHER_ENCODING = 'hex';

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    // For development, generate a temporary key (WARNING: don't use in production)
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[ENCRYPTION] ENCRYPTION_KEY not set. Encryption disabled. DO NOT USE IN PRODUCTION.'
      );
      return Buffer.alloc(32); // 32 zero bytes
    }

    throw new Error(
      'ENCRYPTION_KEY environment variable is required for production'
    );
  }

  // Convert hex string to buffer (must be 64 hex chars for 256-bit key)
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (256-bit key)');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a string value
 * @param plaintext - Value to encrypt
 * @returns Encrypted value in format: IV_HEX:ENCRYPTED_HEX
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, ENCODING, CIPHER_ENCODING);
    encrypted += cipher.final(CIPHER_ENCODING);

    // Return IV + encrypted data so we can decrypt later
    return `${iv.toString(CIPHER_ENCODING)}:${encrypted}`;
  } catch (error) {
    console.error('[Encryption Error]', error);
    // In development, return plaintext; in production, throw
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    return plaintext;
  }
}

/**
 * Decrypt an encrypted string
 * @param ciphertext - Encrypted value in format: IV_HEX:ENCRYPTED_HEX
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;

  try {
    const key = getEncryptionKey();
    const parts = ciphertext.split(':');

    if (parts.length !== 2) {
      console.error('[Encryption Error] Invalid ciphertext format');
      return null;
    }

    const iv = Buffer.from(parts[0], CIPHER_ENCODING);
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, CIPHER_ENCODING, ENCODING);
    decrypted += decipher.final(ENCODING);

    return decrypted;
  } catch (error) {
    console.error('[Decryption Error]', error);
    // In development, return as-is; in production, throw
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    return ciphertext;
  }
}

/**
 * Generate a new encryption key (run this once, save to .env)
 * Usage: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Batch encrypt multiple fields
 */
export function encryptObject<T extends Record<string, any>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const encrypted = { ...obj };

  for (const field of fieldsToEncrypt) {
    const value = obj[field];
    if (value !== null && value !== undefined) {
      encrypted[field] = encrypt(String(value)) as any;
    }
  }

  return encrypted;
}

/**
 * Batch decrypt multiple fields
 */
export function decryptObject<T extends Record<string, any>>(
  obj: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const decrypted = { ...obj };

  for (const field of fieldsToDecrypt) {
    const value = obj[field];
    if (value !== null && value !== undefined) {
      decrypted[field] = decrypt(String(value)) as any;
    }
  }

  return decrypted;
}
