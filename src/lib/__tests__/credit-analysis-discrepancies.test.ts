import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/client', () => ({ db: {} }));

import { buildCrossBureauDiscrepancies } from '@/lib/credit-analysis-discrepancies';
import { comparableReportIds } from '@/lib/cross-bureau-loader';
import type { CrossBureauRow } from '@/lib/cross-bureau-findings';

const reported = new Date('2026-09-01T00:00:00.000Z');

function row(overrides: Partial<CrossBureauRow> & Pick<CrossBureauRow, 'id' | 'bureau'>): CrossBureauRow {
  return {
    tradelineKey: 'report-1:identityiq-0', creditorName: 'Capital Bank', accountNumber: '***1111',
    dateOpened: new Date('2020-01-15T00:00:00.000Z'), dateReported: reported, accountStatus: 'open', paymentStatus: 'current',
    balance: 500, pastDueAmount: null, creditLimit: null, highCredit: null, originalCreditor: null,
    dateOfFirstDelinquency: null, bureauStatedRemovalDate: null, dateOfLastPayment: null, remarks: null, paymentHistoryGrid: null,
    ...overrides,
  };
}

describe('buildCrossBureauDiscrepancies', () => {
  it('stores a balance mismatch across bureau rows at medium severity', () => {
    const [discrepancy, ...rest] = buildCrossBureauDiscrepancies('client-1', 'report-1', [
      row({ id: 'tu', bureau: 'transunion', balance: 500 }),
      row({ id: 'ex', bureau: 'experian', balance: 900 }),
    ]);

    expect(rest).toEqual([]);
    expect(discrepancy).toMatchObject({
      clientId: 'client-1',
      creditReportId: 'report-1',
      discrepancyType: 'account_balance',
      field: 'balance',
      creditorName: 'Capital Bank',
      valueTransunion: '$5.00',
      valueExperian: '$9.00',
      valueEquifax: null,
      severity: 'medium',
      isDisputable: true,
      disputeRecommendation: 'Objective cross-bureau mismatch. Dispute with TransUnion, Experian.',
    });
  });

  it('never stores a high-severity discrepancy, which would block letters', () => {
    const discrepancies = buildCrossBureauDiscrepancies('client-1', 'report-1', [
      row({ id: 'tu', bureau: 'transunion', highCredit: 100, dateOfFirstDelinquency: new Date('2018-01-01T00:00:00.000Z') }),
      row({ id: 'ex', bureau: 'experian', highCredit: 900, dateOfFirstDelinquency: new Date('2019-05-01T00:00:00.000Z') }),
    ]);

    expect(discrepancies.map(item => [item.field, item.severity])).toEqual([
      ['date_of_first_delinquency', 'medium'],
      ['high_credit', 'low'],
    ]);
  });
});

describe('comparableReportIds', () => {
  const at = (date: string) => new Date(`${date}T00:00:00.000Z`);

  it('compares a combined report only with itself', () => {
    expect(comparableReportIds({ id: 'c', bureau: 'combined', reportDate: at('2026-09-01'), createdAt: null }, [])).toEqual(['c']);
  });

  it("pairs a single-bureau report with each other bureau's nearest report within 30 days", () => {
    expect(comparableReportIds(
      { id: 'tu', bureau: 'transunion', reportDate: at('2026-09-01'), createdAt: null },
      [
        { id: 'ex-near', bureau: 'experian', reportDate: at('2026-09-10'), createdAt: null },
        { id: 'ex-far', bureau: 'experian', reportDate: at('2026-09-25'), createdAt: null },
        { id: 'eq-old', bureau: 'equifax', reportDate: at('2026-06-01'), createdAt: null },
        { id: 'tu-other', bureau: 'transunion', reportDate: at('2026-09-02'), createdAt: null },
      ],
    )).toEqual(['tu', 'ex-near']);
  });
});
