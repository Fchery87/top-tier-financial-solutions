import { beforeAll, describe, expect, it } from 'vitest';

let convertToMetro2Format: typeof import('@/lib/ai-letter-generator').convertToMetro2Format;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
  ({ convertToMetro2Format } = await import('@/lib/ai-letter-generator'));
}, 30000);

describe('convertToMetro2Format', () => {
  it('does not label date reported as DOFD in Metro2 payloads', () => {
    const withOnlyDateReported = convertToMetro2Format(
      {
        id: 'neg-1234',
        creditorName: 'Example Creditor',
        itemType: 'charge_off',
        amount: 120000,
        dateReported: '2026-06-01',
      },
      'experian',
    );

    expect(withOnlyDateReported.dateOfFirstDelinquency).toBeUndefined();
    expect(withOnlyDateReported.accountNumberMasked).toBeUndefined();

    const withLastActivity = convertToMetro2Format(
      {
        id: 'neg-1234',
        creditorName: 'Example Creditor',
        itemType: 'charge_off',
        amount: 120000,
        dateReported: '2026-06-01',
        dateOfLastActivity: '2018-02-15',
      },
      'experian',
    );

    expect(withLastActivity.dateOfFirstDelinquency).toBeUndefined();
  });

  it('keeps the reported DOFD even when the bureau also states a removal date', () => {
    const withRemovalDate = convertToMetro2Format(
      {
        id: 'neg-1234',
        creditorName: 'Example Creditor',
        itemType: 'collection',
        dateOfFirstDelinquency: '2019-04-01',
        bureauStatedRemovalDate: '2026-04-01',
      },
      'experian',
    );

    expect(withRemovalDate.dateOfFirstDelinquency).toBe('2019-04-01');
  });

  it('preserves a real masked account number when present', () => {
    const withAccountNumber = convertToMetro2Format(
      {
        id: 'neg-1234',
        creditorName: 'Example Creditor',
        itemType: 'charge_off',
        amount: 120000,
        accountNumber: '****4321',
      },
      'experian',
    );

    expect(withAccountNumber.accountNumberMasked).toBe('****4321');
  });
});
