// @vitest-environment node

import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decrypt, encrypt, isCiphertextValue } from '@/lib/encryption';

const ACTIVE_KEY = 'a'.repeat(64);
const LEGACY_KEY = 'b'.repeat(64);
const originalEnvironment = {
  activeKeyId: process.env.ENCRYPTION_ACTIVE_KEY_ID,
  keyring: process.env.ENCRYPTION_KEYRING,
  legacyKey: process.env.ENCRYPTION_KEY,
};

describe('versioned encryption', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_ACTIVE_KEY_ID = 'current_2026';
    process.env.ENCRYPTION_KEYRING = JSON.stringify({ current_2026: ACTIVE_KEY });
    process.env.ENCRYPTION_KEY = LEGACY_KEY;
  });

  afterEach(() => {
    restoreEnvironmentVariable('ENCRYPTION_ACTIVE_KEY_ID', originalEnvironment.activeKeyId);
    restoreEnvironmentVariable('ENCRYPTION_KEYRING', originalEnvironment.keyring);
    restoreEnvironmentVariable('ENCRYPTION_KEY', originalEnvironment.legacyKey);
  });

  it('encrypts new values with the active keyed AES-GCM format', () => {
    const ciphertext = encrypt('sensitive client value');

    expect(ciphertext).toMatch(/^v3:current_2026:[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/);
    expect(decrypt(ciphertext)).toBe('sensitive client value');
  });

  it('decrypts a legacy CBC value while its legacy key remains configured', () => {
    const ciphertext = encryptLegacyCbc('legacy client value', LEGACY_KEY);

    expect(decrypt(ciphertext)).toBe('legacy client value');
  });

  it('decrypts the historical unkeyed v2 AES-GCM format while its legacy key remains configured', () => {
    const ciphertext = encryptLegacyGcm('legacy authenticated value', LEGACY_KEY);

    expect(decrypt(ciphertext)).toBe('legacy authenticated value');
  });

  // Literal ciphertexts produced by each writer this repo has shipped or staged:
  // CBC by a13d88a, unkeyed v2 GCM by b090e81, keyed v3 GCM by the current writer.
  // They must keep decrypting through the one decrypt path.
  it.each([
    ['legacy CBC (IV:CIPHER)', '92f1d32b685a355c121ea893286d4009:a0615ca2461ef5b129b283ffc1234c6cbd76d9d3798d4310dccddeaf01aa31b8', 'legacy cbc value 1990-01-01'],
    ['unkeyed v2 GCM', 'v2:3cfb5ae0466eea4f3f8b6c15:b909df2590dd47b16745124774196f33:80c823821c3cda0369f8bc0d94ec96a23a3d6fe5f401d078f92a9a8a6a66', 'dirty tree v2 value 1985-07-04'],
    ['keyed v3 GCM', 'v3:current_2026:25d1b714cb9dedcbc9c91409:536faa8986129c902f588cb6c90f3b18:ab918d1d762fae70880b72932a4175288ba42c8d2f9effdbcc', 'keyed v3 value 2001-12-31'],
  ])('decrypts a literal %s ciphertext', (_label, ciphertext, plaintext) => {
    expect(isCiphertextValue(ciphertext)).toBe(true);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('re-encrypts every historical format into v3 under the active key', () => {
    const historical = [
      '92f1d32b685a355c121ea893286d4009:a0615ca2461ef5b129b283ffc1234c6cbd76d9d3798d4310dccddeaf01aa31b8',
      'v2:3cfb5ae0466eea4f3f8b6c15:b909df2590dd47b16745124774196f33:80c823821c3cda0369f8bc0d94ec96a23a3d6fe5f401d078f92a9a8a6a66',
    ];
    for (const ciphertext of historical) {
      const plaintext = decrypt(ciphertext);
      const rotated = encrypt(plaintext);
      expect(rotated).toMatch(/^v3:current_2026:/);
      expect(decrypt(rotated)).toBe(plaintext);
    }
  });

  it('rejects a tampered authenticated ciphertext', () => {
    const ciphertext = encrypt('sensitive client value');
    const finalCharacter = ciphertext?.endsWith('0') ? '1' : '0';
    const tampered = `${ciphertext?.slice(0, -1)}${finalCharacter}`;

    expect(() => decrypt(tampered)).toThrow();
  });

  it('rejects a v3 ciphertext with an unknown key ID', () => {
    expect(() => decrypt(`v3:retired_key:${'c'.repeat(24)}:${'d'.repeat(32)}:${'e'.repeat(32)}`)).toThrow(
      'Encryption key ID is not available',
    );
  });
});

function encryptLegacyCbc(plaintext: string, hexKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(hexKey, 'hex'), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${ciphertext.toString('hex')}`;
}

function encryptLegacyGcm(plaintext: string, hexKey: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(hexKey, 'hex'), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v2:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ciphertext.toString('hex')}`;
}

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
