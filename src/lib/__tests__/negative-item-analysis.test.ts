import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('analyzeNegativeItem obsolescence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags an item still reporting after the bureau stated removal date', () => {
    const result = analyzeNegativeItem({
      id: 'neg-8',
      creditorName: 'Midland Credit Management',
      itemType: 'collection',
      dateOfFirstDelinquency: '2018-01-15',
      bureauStatedRemovalDate: '2025-02-01',
    });

    expect(result.autoReasonCodes).toContain('obsolete');
    expect(result.metro2Violations).toContain(
      "This collection is still reporting after its reporting period ended on 2/1/2025 (the bureau's own stated removal date)",
    );
  });

  it('does not call a collection obsolete inside the 180-day grace of 1681c(c)', () => {
    const collection = analyzeNegativeItem({
      id: 'neg-9',
      creditorName: 'Example Creditor',
      originalCreditor: 'Example Bank',
      itemType: 'collection',
      dateOfFirstDelinquency: '2019-06-01',
    });
    const latePayment = analyzeNegativeItem({
      id: 'neg-10',
      creditorName: 'Example Bank',
      itemType: 'late_payment',
      dateOfFirstDelinquency: '2019-06-01',
    });

    expect(collection.autoReasonCodes).not.toContain('obsolete');
    expect(latePayment.autoReasonCodes).toContain('obsolete');
  });

  it('flags a stale inquiry without citing a statute the FCRA does not contain', () => {
    const result = analyzeNegativeItem({
      id: 'neg-11',
      creditorName: 'Example Lender',
      itemType: 'inquiry',
      dateReported: '2023-09-01',
    });

    expect(result.metro2Violations).toContain(
      "Hard inquiry dated 9/1/2023 is still displayed more than two years later, past the bureaus' two-year inquiry display period",
    );
    expect(result.fcraIssues.join(' ')).not.toContain('605(a)(3)');
  });
});

describe('analyzeNegativeItem medical debt', () => {
  it("states the client's state rule as a finding for a medical collection", () => {
    const result = analyzeNegativeItem({
      id: 'neg-med-1',
      creditorName: 'Apex Recovery',
      originalCreditor: 'Northwell Health',
      itemType: 'collection',
      accountStatus: 'collection',
      amount: 120000,
      dateOfFirstDelinquency: '2023-01-15',
      clientState: 'NY',
    });

    expect(result.metro2Violations).toContain(
      'This account is medical debt and I live in New York. New York General Business Law § 380-j bars consumer reporting agencies from reporting medical debt.',
    );
    expect(result.autoReasonCodes).toContain('medical_state_rule');
    expect(result.analysisNotes).toContain('Medical Debt State Rule wording has not been reviewed by counsel yet');
  });

  it('holds a creditor-name-only medical match for client confirmation', () => {
    const result = analyzeNegativeItem({
      id: 'neg-med-2',
      creditorName: 'Medical Data Systems',
      itemType: 'collection',
      accountStatus: 'collection',
      amount: 120000,
      dateOfFirstDelinquency: '2023-01-15',
      clientState: 'NY',
    });

    expect(result.autoReasonCodes).not.toContain('medical_state_rule');
    expect(result.analysisNotes).toContain('Possible medical debt: only the creditor name suggests it. Confirm with the client before using medical-debt rules.');
  });
});
