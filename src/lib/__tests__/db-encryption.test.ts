import { describe, expect, it } from 'vitest';
import {
  decryptClientData,
  decryptCreditAccountData,
  decryptDisputeData,
  decryptNegativeItemData,
  encryptClientData,
} from '@/lib/db-encryption';

describe('db-encryption safe decryption', () => {
  it('preserves original value when client decryption fails', () => {
    const result = decryptClientData({
      firstName: 'zzzz:ffff',
      lastName: null,
    });

    expect(result.firstName).toBe('zzzz:ffff');
    expect(result.lastName).toBeNull();
  });

  it('returns a display-safe sentinel for ciphertext-shaped values that cannot decrypt', () => {
    const result = decryptClientData({
      firstName: `${'a'.repeat(32)}:${'b'.repeat(32)}`,
    });

    expect(result.firstName).toBe('[decryption-failed]');
  });

  it('preserves original value when account/item/dispute decryption fails', () => {
    expect(decryptCreditAccountData({ creditorName: 'zzzz:ffff' }).creditorName).toBe('zzzz:ffff');
    expect(decryptNegativeItemData({ creditorName: 'zzzz:ffff' }).creditorName).toBe('zzzz:ffff');
    expect(decryptDisputeData({ creditorName: 'zzzz:ffff' }).creditorName).toBe('zzzz:ffff');
  });

  it('decrypts valid encrypted client values', () => {
    const encrypted = encryptClientData({
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '555-1111',
    });

    const decrypted = decryptClientData(encrypted);

    expect(decrypted.firstName).toBe('Jane');
    expect(decrypted.lastName).toBe('Doe');
    expect(decrypted.phone).toBe('555-1111');
  });

  it('decrypts versioned authenticated client values', () => {
    const encrypted = encryptClientData({
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
    });

    expect(encrypted.dateOfBirth).toMatch(/^v3:test:/);
    expect(decryptClientData(encrypted).dateOfBirth).toBe('1990-01-01');
  });

  it('reads client PII written in the earlier v2 GCM format', () => {
    // Literal written by b090e81's encrypt() with the all-zero test key.
    const v2FirstName = 'v2:dfe34b50cfb19f682dd7174c:1f60d4985a8c901a57fc5ae9dd1f4711:64282e';
    expect(decryptClientData({ firstName: v2FirstName }).firstName).toBe('Ada');
  });
});
