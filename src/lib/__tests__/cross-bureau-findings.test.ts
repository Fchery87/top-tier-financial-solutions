import { describe, expect, it } from 'vitest';
import { findCrossBureauMismatches, type CrossBureauRow } from '@/lib/cross-bureau-findings';

const SEPT = new Date('2026-09-01T00:00:00.000Z');

function row(overrides: Partial<CrossBureauRow> & Pick<CrossBureauRow, 'id' | 'bureau'>): CrossBureauRow {
  return {
    tradelineKey: 'report-1:identityiq-0',
    creditorName: 'Apex Recovery',
    accountNumber: null,
    dateOpened: new Date('2018-03-01T00:00:00.000Z'),
    dateReported: SEPT,
    accountStatus: 'collection',
    paymentStatus: 'collection',
    balance: 120000,
    pastDueAmount: null,
    creditLimit: null,
    highCredit: null,
    originalCreditor: 'Sprint',
    dateOfFirstDelinquency: new Date('2018-01-15T00:00:00.000Z'),
    bureauStatedRemovalDate: null,
    dateOfLastPayment: null,
    remarks: null,
    paymentHistoryGrid: null,
    ...overrides,
  };
}

describe('findCrossBureauMismatches', () => {
  it('disputes a later date of first delinquency only with the bureaus reporting it', () => {
    const findings = findCrossBureauMismatches([
      row({ id: 'tu', bureau: 'transunion' }),
      row({ id: 'ex', bureau: 'experian', dateOfFirstDelinquency: new Date('2019-03-10T00:00:00.000Z') }),
      row({ id: 'eq', bureau: 'equifax' }),
    ]);

    expect(findings).toEqual([{
      field: 'date_of_first_delinquency',
      tier: 'objective',
      accountIds: ['tu', 'ex', 'eq'],
      values: { transunion: '1/2018', experian: '3/2019', equifax: '1/2018' },
      letterText: {
        experian: 'You report the date of first delinquency of this account as 3/2019, but TransUnion and Equifax report 1/2018. A later date makes this account look newer than it is and extends how long it can be reported. Only one date can be accurate.',
      },
    }]);
  });

  it('compares balances only when both bureaus reported in the same month', () => {
    const sameMonth = findCrossBureauMismatches([
      row({ id: 'tu', bureau: 'transunion', balance: 19700 }),
      row({ id: 'ex', bureau: 'experian', balance: 23700 }),
    ]);
    const differentMonths = findCrossBureauMismatches([
      row({ id: 'tu', bureau: 'transunion', balance: 19700 }),
      row({ id: 'ex', bureau: 'experian', balance: 23700, dateReported: new Date('2026-07-01T00:00:00.000Z') }),
    ]);

    expect(sameMonth.map(item => item.field)).toEqual(['balance']);
    expect(sameMonth[0].letterText.transunion).toBe('You report the balance of this account as $197.00, but Experian reports $237.00. These cannot all be accurate.');
    expect(differentMonths).toEqual([]);
  });

  it('flags a charge-off on one bureau and a late account on another', () => {
    const findings = findCrossBureauMismatches([
      row({ id: 'eq', bureau: 'equifax', accountStatus: 'derogatory', paymentStatus: '120_days_late' }),
      row({ id: 'ex', bureau: 'experian', accountStatus: 'charge_off', paymentStatus: 'charge_off' }),
    ]);

    expect(findings.map(item => [item.field, item.values])).toEqual([['status', { equifax: 'late', experian: 'charge-off' }]]);
  });

  it('compares the month opened, not the day each bureau prints', () => {
    expect(findCrossBureauMismatches([
      row({ id: 'eq', bureau: 'equifax', dateOpened: new Date('2016-04-01T00:00:00.000Z') }),
      row({ id: 'tu', bureau: 'transunion', dateOpened: new Date('2016-04-30T00:00:00.000Z') }),
    ])).toEqual([]);
  });

  it('ignores a one-month difference in the date of last payment but flags a wider one', () => {
    const lastPaid = (tu: string, eq: string) => findCrossBureauMismatches([
      row({ id: 'tu', bureau: 'transunion', dateOfLastPayment: new Date(tu) }),
      row({ id: 'eq', bureau: 'equifax', dateOfLastPayment: new Date(eq) }),
    ]).map(item => item.values);

    expect(lastPaid('2018-03-20T00:00:00.000Z', '2018-04-01T00:00:00.000Z')).toEqual([]);
    expect(lastPaid('2023-01-20T00:00:00.000Z', '2022-01-01T00:00:00.000Z')).toEqual([{ transunion: '1/2023', equifax: '1/2022' }]);
  });

  it('asks the bureau missing the dispute notation to add it', () => {
    const findings = findCrossBureauMismatches([
      row({ id: 'tu', bureau: 'transunion', remarks: 'Account information disputed by consumer' }),
      row({ id: 'ex', bureau: 'experian' }),
    ]);

    expect(findings.map(item => item.letterText)).toEqual([{
      experian: 'This account is not marked as disputed on your report, but TransUnion shows it as disputed by me. The reporting is incomplete without the dispute notation.',
    }]);
  });

  it('treats differing high credit and late-count summaries as interpretive', () => {
    const findings = findCrossBureauMismatches([
      row({ id: 'tu', bureau: 'transunion', highCredit: 43300, paymentHistoryGrid: JSON.stringify({ transunion: { '30': '2' } }) }),
      row({ id: 'ex', bureau: 'experian', highCredit: 13300, paymentHistoryGrid: JSON.stringify({ experian: { OK: '1' } }) }),
    ]);

    expect(findings.map(item => [item.field, item.tier])).toEqual([
      ['high_credit', 'interpretive'],
      ['payment_history', 'interpretive'],
    ]);
  });

  it('flags a month reported late on one bureau and on time on another', () => {
    const findings = findCrossBureauMismatches([
      row({ id: 'tu', bureau: 'transunion', paymentHistoryGrid: JSON.stringify({ transunion: { '2025-06': '30' } }) }),
      row({ id: 'eq', bureau: 'equifax', paymentHistoryGrid: JSON.stringify({ equifax: { '2025-06': 'OK' } }) }),
    ]);

    expect(findings.map(item => item.letterText)).toEqual([{
      transunion: 'You report 6/2025 on this account as 30, but Equifax reports on time for the same month. These cannot all be accurate.',
    }]);
  });

  it('never compares rows it cannot match', () => {
    expect(findCrossBureauMismatches([
      row({ id: 'tu', bureau: 'transunion', tradelineKey: null, dateOpened: null, balance: 1 }),
      row({ id: 'ex', bureau: 'experian', tradelineKey: null, dateOpened: null, balance: 2 }),
    ])).toEqual([]);
  });
});
