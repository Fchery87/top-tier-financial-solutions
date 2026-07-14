import { beforeAll, describe, expect, it } from 'vitest';

let analyzeNegativeItem: typeof import('@/lib/ai-letter-generator').analyzeNegativeItem;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
  ({ analyzeNegativeItem } = await import('@/lib/ai-letter-generator'));
});

describe('analyzeNegativeItem balance rules', () => {
  it('does not flag a retained charge off with a balance', () => {
    const result = analyzeNegativeItem({
      id: 'neg-1',
      creditorName: 'Capital One',
      itemType: 'charge_off',
      accountStatus: 'charge_off',
      paymentStatus: 'charged_off',
      currentBalance: 125000,
      amount: 125000,
    });

    expect(result.metro2Violations).toEqual([]);
  });

  it('flags a paid account that still reports a balance', () => {
    const result = analyzeNegativeItem({
      id: 'neg-2',
      creditorName: 'Example Creditor',
      itemType: 'charge_off',
      accountStatus: 'paid',
      paymentStatus: 'paid',
      currentBalance: 5000,
      amount: 5000,
    });

    expect(result.metro2Violations).toHaveLength(1);
    expect(result.metro2Violations[0]).toContain('status "paid"');
  });

  it('flags a transferred account that still reports a balance', () => {
    const result = analyzeNegativeItem({
      id: 'neg-3',
      creditorName: 'Example Creditor',
      itemType: 'collection',
      accountStatus: 'transferred',
      paymentStatus: 'transferred',
      currentBalance: 8200,
      amount: 8200,
    });

    expect(result.metro2Violations).toHaveLength(1);
    expect(result.metro2Violations[0]).toContain('status "transferred"');
  });
});
