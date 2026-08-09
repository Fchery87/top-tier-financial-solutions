import crypto from 'crypto';
import { logServerEvent } from '@/lib/server-logger';

const GCM_ALGORITHM = 'aes-256-gcm';
const LEGACY_CBC_ALGORITHM = 'aes-256-cbc';
const HEX_ENCODING = 'hex';
const TEXT_ENCODING = 'utf8';
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_PATTERN = /^[a-f0-9]{64}$/i;

type EncryptionKeyring = {
  activeKeyId: string;
  keys: ReadonlyMap<string, Buffer>;
  legacyKey: Buffer | undefined;
};

type GcmCiphertext = {
  keyId: string | undefined;
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
};

/**
 * Encrypts a value using the active AES-256-GCM key.
 *
 * New format: v3:<key-id>:<iv-hex>:<tag-hex>:<ciphertext-hex>
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;

  try {
    const keyring = getEncryptionKeyring();
    const activeKey = keyring.keys.get(keyring.activeKeyId);

    if (!activeKey) {
      throw new Error('Active encryption key is not available');
    }

    const iv = crypto.randomBytes(GCM_IV_BYTES);
    const cipher = crypto.createCipheriv(GCM_ALGORITHM, activeKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, TEXT_ENCODING), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `v3:${keyring.activeKeyId}:${iv.toString(HEX_ENCODING)}:${tag.toString(HEX_ENCODING)}:${ciphertext.toString(HEX_ENCODING)}`;
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.lib.encryption.error', error });
    throw error;
  }
}

/**
 * Decrypts active v3, historical v2 GCM, and legacy CBC ciphertext.
 * Callers handling database fields should first use `isCiphertextValue` so
 * true legacy plaintext is never treated as an encryption failure.
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;

  try {
    if (ciphertext.startsWith('v3:')) {
      const parsed = parseGcmCiphertext(ciphertext, true);
      const keyring = getEncryptionKeyring();

      if (!parsed.keyId || !keyring.keys.has(parsed.keyId)) {
        throw new Error('Encryption key ID is not available');
      }

      return decryptGcm(parsed, keyring.keys.get(parsed.keyId));
    }

    if (ciphertext.startsWith('v2:')) {
      const parsed = parseGcmCiphertext(ciphertext, false);
      return decryptGcm(parsed, getEncryptionKeyring().legacyKey);
    }

    return decryptLegacyCbc(ciphertext, getEncryptionKeyring().legacyKey);
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.lib.encryption.error', error });
    throw error;
  }
}

/** Returns true only for a strict recognized ciphertext shape. */
export function isCiphertextValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  if (value.startsWith('v3:')) {
    return isValidGcmShape(value, true);
  }

  if (value.startsWith('v2:')) {
    return isValidGcmShape(value, false);
  }

  return isValidLegacyCbcShape(value);
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString(HEX_ENCODING);
}

/** Returns the configured key ID used for newly encrypted values. */
export function getActiveEncryptionKeyId(): string {
  return getEncryptionKeyring().activeKeyId;
}

export function encryptObject(
  object: Record<string, unknown>,
  fieldsToEncrypt: readonly string[],
): Record<string, unknown> {
  const encrypted = { ...object };

  for (const field of fieldsToEncrypt) {
    const value = object[field];
    if (value !== null && value !== undefined) {
      encrypted[field] = encrypt(String(value));
    }
  }

  return encrypted;
}

export function decryptObject(
  object: Record<string, unknown>,
  fieldsToDecrypt: readonly string[],
): Record<string, unknown> {
  const decrypted = { ...object };

  for (const field of fieldsToDecrypt) {
    const value = object[field];
    if (value !== null && value !== undefined) {
      decrypted[field] = decrypt(String(value));
    }
  }

  return decrypted;
}

function getEncryptionKeyring(): EncryptionKeyring {
  const configuredKeyring = process.env.ENCRYPTION_KEYRING;
  const legacyKey = readOptionalKey(process.env.ENCRYPTION_KEY, 'ENCRYPTION_KEY');

  if (!configuredKeyring) {
    if (legacyKey) {
      return {
        activeKeyId: 'legacy',
        keys: new Map([['legacy', legacyKey]]),
        legacyKey,
      };
    }

    if (process.env.NODE_ENV === 'test') {
      const testKey = Buffer.alloc(32);
      return {
        activeKeyId: 'test',
        keys: new Map([['test', testKey]]),
        legacyKey: testKey,
      };
    }

    throw new Error('Encryption keyring is required');
  }

  const parsedKeyring = parseKeyring(configuredKeyring);
  const activeKeyId = process.env.ENCRYPTION_ACTIVE_KEY_ID;

  if (!activeKeyId || !KEY_ID_PATTERN.test(activeKeyId)) {
    throw new Error('ENCRYPTION_ACTIVE_KEY_ID is required and must be a valid key ID');
  }

  if (!parsedKeyring.has(activeKeyId)) {
    throw new Error('ENCRYPTION_ACTIVE_KEY_ID is not present in ENCRYPTION_KEYRING');
  }

  return {
    activeKeyId,
    keys: parsedKeyring,
    legacyKey: legacyKey ?? parsedKeyring.get('legacy'),
  };
}

function parseKeyring(rawKeyring: string): ReadonlyMap<string, Buffer> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawKeyring);
  } catch {
    throw new Error('ENCRYPTION_KEYRING must be valid JSON');
  }

  if (!isRecord(parsed)) {
    throw new Error('ENCRYPTION_KEYRING must be a JSON object');
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0 || entries.length > 100) {
    throw new Error('ENCRYPTION_KEYRING must contain between 1 and 100 keys');
  }

  const keys = new Map<string, Buffer>();

  for (const [keyId, keyValue] of entries) {
    if (!KEY_ID_PATTERN.test(keyId) || typeof keyValue !== 'string') {
      throw new Error('ENCRYPTION_KEYRING contains an invalid key entry');
    }

    keys.set(keyId, decodeKey(keyValue, 'ENCRYPTION_KEYRING'));
  }

  return keys;
}

function readOptionalKey(value: string | undefined, source: string): Buffer | undefined {
  return value === undefined || value === '' ? undefined : decodeKey(value, source);
}

function decodeKey(value: string, source: string): Buffer {
  if (!KEY_PATTERN.test(value)) {
    throw new Error(`${source} must be 64 hex characters (256-bit key)`);
  }

  return Buffer.from(value, HEX_ENCODING);
}

function decryptGcm(parsed: GcmCiphertext, key: Buffer | undefined): string {
  if (!key) {
    throw new Error('Legacy encryption key is not available');
  }

  const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, parsed.iv);
  decipher.setAuthTag(parsed.tag);
  return Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()]).toString(TEXT_ENCODING);
}

function decryptLegacyCbc(ciphertext: string, key: Buffer | undefined): string {
  if (!key || !isValidLegacyCbcShape(ciphertext)) {
    throw new Error('Invalid legacy encryption ciphertext');
  }

  const [ivHex, encryptedHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv(
    LEGACY_CBC_ALGORITHM,
    key,
    Buffer.from(ivHex, HEX_ENCODING),
  );
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, HEX_ENCODING)),
    decipher.final(),
  ]).toString(TEXT_ENCODING);
}

function parseGcmCiphertext(ciphertext: string, keyed: boolean): GcmCiphertext {
  if (!isValidGcmShape(ciphertext, keyed)) {
    throw new Error('Invalid authenticated encryption ciphertext');
  }

  const parts = ciphertext.split(':');
  const [keyId, ivHex, tagHex, encryptedHex] = keyed
    ? [parts[1], parts[2], parts[3], parts[4]]
    : [undefined, parts[1], parts[2], parts[3]];

  return {
    keyId,
    iv: Buffer.from(ivHex, HEX_ENCODING),
    tag: Buffer.from(tagHex, HEX_ENCODING),
    ciphertext: Buffer.from(encryptedHex, HEX_ENCODING),
  };
}

function isValidGcmShape(value: string, keyed: boolean): boolean {
  const parts = value.split(':');
  const expectedLength = keyed ? 5 : 4;

  if (parts.length !== expectedLength || parts[0] !== (keyed ? 'v3' : 'v2')) {
    return false;
  }

  const keyId = keyed ? parts[1] : undefined;
  const offset = keyed ? 2 : 1;
  const ivHex = parts[offset];
  const tagHex = parts[offset + 1];
  const encryptedHex = parts[offset + 2];

  return (keyId === undefined || KEY_ID_PATTERN.test(keyId))
    && isExactHex(ivHex, GCM_IV_BYTES)
    && isExactHex(tagHex, GCM_TAG_BYTES)
    && isNonEmptyHex(encryptedHex);
}

function isValidLegacyCbcShape(value: string): boolean {
  const [ivHex, encryptedHex, unexpectedPart] = value.split(':');
  return unexpectedPart === undefined && isExactHex(ivHex, 16) && isNonEmptyHex(encryptedHex);
}

function isExactHex(value: string | undefined, byteLength: number): boolean {
  return value !== undefined && value.length === byteLength * 2 && /^[a-f0-9]+$/i.test(value);
}

function isNonEmptyHex(value: string | undefined): boolean {
  return value !== undefined && value.length > 0 && value.length % 2 === 0 && /^[a-f0-9]+$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
