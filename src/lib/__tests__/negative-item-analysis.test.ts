import { beforeAll, describe, expect, it } from 'vitest';

let analyzeNegativeItem: typeof import('@/lib/ai-letter-generator').analyzeNegativeItem;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
  ({ analyzeNegativeItem } = await import('@/lib/ai-letter-generator'));
}, 30000);

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
    expect(result.metro2Violations[0]).toContain('status is "paid"');
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
    expect(result.metro2Violations[0]).toContain('status is "transferred"');
  });

  it('limits balance-over-limit violations to revolving accounts', () => {
    const installmentResult = analyzeNegativeItem({
      id: 'neg-4',
      creditorName: 'Auto Lender',
      itemType: 'charge_off',
      accountType: 'auto_loan',
      accountStatus: 'charge_off',
      paymentStatus: 'charge_off',
      currentBalance: 1500000,
      creditLimit: 1200000,
      amount: 1500000,
    });

    expect(installmentResult.metro2Violations).toEqual([]);

    const revolvingResult = analyzeNegativeItem({
      id: 'neg-5',
      creditorName: 'Card Issuer',
      itemType: 'charge_off',
      accountType: 'credit_card',
      accountStatus: 'charge_off',
      paymentStatus: 'charge_off',
      currentBalance: 150000,
      creditLimit: 120000,
      amount: 150000,
    });

    expect(revolvingResult.metro2Violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('exceeds credit limit'),
      ]),
    );
  });

  it('does not increase confidence just because the dispute round is higher', () => {
    const roundOne = analyzeNegativeItem({
      id: 'neg-6',
      creditorName: 'Card Issuer',
      itemType: 'charge_off',
      accountType: 'credit_card',
      accountStatus: 'charge_off',
      paymentStatus: 'charge_off',
      currentBalance: 150000,
      creditLimit: 120000,
      amount: 150000,
    }, 1);

    const roundThree = analyzeNegativeItem({
      id: 'neg-6',
      creditorName: 'Card Issuer',
      itemType: 'charge_off',
      accountType: 'credit_card',
      accountStatus: 'charge_off',
      paymentStatus: 'charge_off',
      currentBalance: 150000,
      creditLimit: 120000,
      amount: 150000,
    }, 3);

    expect(roundThree.confidence).toBe(roundOne.confidence);
    expect(roundThree.suggestedMethodology).toBe('factual');
  });

  it('flags current status when payment history shows late codes', () => {
    const result = analyzeNegativeItem({
      id: 'neg-7',
      creditorName: 'Example Creditor',
      itemType: 'late_payment',
      accountStatus: 'current',
      paymentStatus: 'current',
      paymentHistoryGrid: {
        '2024-01': '30',
        '2024-02': 'OK',
      },
    });

    expect(result.metro2Violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Payment history grid shows late or derogatory codes while the current status remains current'),
      ]),
    );
  });
});
