import { describe, expect, it } from 'vitest';
import { sealAccount } from '@/lib/payment-authorization/account';
import { AccountInputException } from '@/lib/payment-authorization/types';

describe('sealAccount', () => {
  it('seals a valid ABA routing number and keeps the digits off the result', () => {
    const sealed = sealAccount({
      bankName: '  First Bank  ',
      routingNumber: '021000021',
      accountNumber: '123456789',
      accountType: 'checking',
    });

    expect(sealed.bankName).toBe('First Bank');
    expect(sealed.accountLast4).toBe('6789');
    expect(sealed.accountType).toBe('checking');
    expect(sealed.routingNumberEncrypted).not.toBe('021000021');
    expect(sealed.accountNumberEncrypted).not.toBe('123456789');
    expect(sealed.routingNumberEncrypted.startsWith('v2:')).toBe(true);
    expect(Object.keys(sealed)).not.toContain('routingNumber');
    expect(Object.keys(sealed)).not.toContain('accountNumber');
  });

  it('rejects a routing number that fails the ABA checksum', () => {
    expect(() => sealAccount({
      bankName: 'First Bank',
      routingNumber: '021000022',
      accountNumber: '1234',
      accountType: 'savings',
    })).toThrow(AccountInputException);
  });

  it('rejects a 3-digit account number and accepts 4 digits', () => {
    expect(() => sealAccount({
      bankName: 'First Bank',
      routingNumber: '021000021',
      accountNumber: '123',
      accountType: 'checking',
    })).toThrow(AccountInputException);

    const sealed = sealAccount({
      bankName: 'First Bank',
      routingNumber: '021000021',
      accountNumber: '1234',
      accountType: 'checking',
    });
    expect(sealed.accountLast4).toBe('1234');
    expect(sealed.accountNumberEncrypted).not.toBe('1234');
  });
});
