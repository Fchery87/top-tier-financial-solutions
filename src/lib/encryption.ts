import crypto from 'crypto';

/**
 * PII Encryption Service
 * Encrypts new values with AES-256-GCM. Decrypt still reads the older AES-256-CBC payload.
 *
 * Design: Each encrypted value includes its own IV (initialization vector)
 * so decryption doesn't require a separate IV
 * New format: v2:IV_HEX:TAG_HEX:CIPHER_HEX. Old format: IV_HEX:CIPHER_HEX.
 */

const CBC_ALGORITHM = 'aes-256-cbc';
const GCM_ALGORITHM = 'aes-256-gcm';
const ENCODING = 'utf-8';
const CIPHER_ENCODING = 'hex';
const V2_PREFIX = 'v2:';

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    // Tests can run without encryption config to keep unit tests deterministic.
    if (process.env.NODE_ENV === 'test') {
      return Buffer.alloc(32);
    }

    throw new Error('ENCRYPTION_KEY environment variable is required');
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
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(GCM_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, ENCODING),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${V2_PREFIX}${iv.toString(CIPHER_ENCODING)}:${tag.toString(CIPHER_ENCODING)}:${encrypted.toString(CIPHER_ENCODING)}`;
  } catch (error) {
    console.error('[Encryption Error]', error);
    throw error;
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
    if (ciphertext.startsWith(V2_PREFIX)) {
      const parts = ciphertext.slice(V2_PREFIX.length).split(':');
      if (parts.length !== 3) {
        console.error('[Encryption Error] Invalid ciphertext format');
        return null;
      }
      const iv = Buffer.from(parts[0], CIPHER_ENCODING);
      const tag = Buffer.from(parts[1], CIPHER_ENCODING);
      const encrypted = Buffer.from(parts[2], CIPHER_ENCODING);
      const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(ENCODING);
    }

    const parts = ciphertext.split(':');
    if (parts.length !== 2) {
      console.error('[Encryption Error] Invalid ciphertext format');
      return null;
    }
    const iv = Buffer.from(parts[0], CIPHER_ENCODING);
    const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key, iv);
    let decrypted = decipher.update(parts[1], CIPHER_ENCODING, ENCODING);
    decrypted += decipher.final(ENCODING);
    return decrypted;
  } catch (error) {
    console.error('[Decryption Error]', error);
    throw error;
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
export function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const encrypted = { ...obj };

  for (const field of fieldsToEncrypt) {
    const value = obj[field];
    if (value !== null && value !== undefined) {
      encrypted[field] = encrypt(String(value)) as T[keyof T];
    }
  }

  return encrypted;
}

/**
 * Batch decrypt multiple fields
 */
export function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const decrypted = { ...obj };

  for (const field of fieldsToDecrypt) {
    const value = obj[field];
    if (value !== null && value !== undefined) {
      decrypted[field] = decrypt(String(value)) as T[keyof T];
    }
  }

  return decrypted;
}
