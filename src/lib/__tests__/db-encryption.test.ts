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
});

