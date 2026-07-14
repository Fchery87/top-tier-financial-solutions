import { describe, expect, it } from 'vitest';
import { buildCreditAccountDerivedFields } from '@/lib/credit-account-ingest';

describe('buildCreditAccountDerivedFields', () => {
  it('preserves parsed remarks and stores completeness separately', () => {
    const result = buildCreditAccountDerivedFields({
      creditorName: 'Example Creditor',
      accountNumber: '****1234',
      accountType: 'credit_card',
      accountStatus: 'charge_off',
      balance: 125000,
      creditLimit: undefined,
      highCredit: undefined,
      dateOpened: undefined,
      dateReported: new Date('2026-07-01T00:00:00.000Z'),
      paymentStatus: 'charge_off',
      remarks: 'Account sold to another lender',
    });

    expect(result.remarks).toBe('Account sold to another lender');
    expect(result.completenessScore).toBeLessThan(100);
    expect(result.missingFields).toContain('creditLimit');
  });
});
