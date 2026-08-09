// @vitest-environment node

import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '@/lib/encryption';

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

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
