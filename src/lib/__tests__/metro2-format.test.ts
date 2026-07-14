import { beforeAll, describe, expect, it } from 'vitest';

let convertToMetro2Format: typeof import('@/lib/ai-letter-generator').convertToMetro2Format;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
  ({ convertToMetro2Format } = await import('@/lib/ai-letter-generator'));
});

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

    expect(withLastActivity.dateOfFirstDelinquency).toBe('2018-02-15');
  });
});
