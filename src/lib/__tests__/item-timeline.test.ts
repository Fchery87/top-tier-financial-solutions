import { describe, expect, it } from 'vitest';
import { findTimelineFindings, type TimelinePull, type TimelineRow } from '@/lib/item-timeline';

const at = (date: string) => new Date(`${date}T00:00:00.000Z`);

const pulls: TimelinePull[] = [
  { id: 'p1', bureau: 'combined', pulledAt: at('2026-01-10') },
  { id: 'p2', bureau: 'combined', pulledAt: at('2026-04-10') },
  { id: 'p3', bureau: 'combined', pulledAt: at('2026-07-10') },
];

function row(reportId: string, overrides: Partial<TimelineRow> = {}): TimelineRow {
  return {
    id: `${reportId}-ex`,
    creditReportId: reportId,
    bureau: 'experian',
    creditorName: 'Apex Recovery',
    accountNumber: 'XXXX1234',
    dateOpened: at('2018-03-01'),
    dateOfFirstDelinquency: at('2018-01-15'),
    balance: 120000,
    pastDueAmount: 120000,
    accountStatus: 'collection',
    paymentStatus: 'collection',
    remarks: null,
    ...overrides,
  };
}

describe('findTimelineFindings', () => {
  it('flags a date of first delinquency that moved later on the same bureau', () => {
    const findings = findTimelineFindings({
      pulls,
      rows: [row('p1'), row('p2'), row('p3', { dateOfFirstDelinquency: at('2019-06-01') })],
      disputes: [],
    });

    expect(findings).toEqual([{
      kind: 'reaged',
      tier: 'objective',
      bureau: 'experian',
      creditorName: 'Apex Recovery',
      accountIds: ['p1-ex', 'p2-ex', 'p3-ex'],
      text: 'In my credit report from 1/2026 you reported the date of first delinquency for this account as 1/2018. You now report it as 6/2019. The date a delinquency began cannot move later, so the account has been re-aged.',
    }]);
  });

  it('flags an item that disappeared and came back, across all pulls rather than consecutive ones', () => {
    const findings = findTimelineFindings({ pulls, rows: [row('p1'), row('p3')], disputes: [] });

    expect(findings.map(item => [item.kind, item.bureau])).toEqual([['reinserted', 'experian']]);
    expect(findings[0].text).toContain('did not appear in my credit report from 4/2026');
    expect(findings[0].text).toContain('FCRA Section 611(a)(5)(B)');
  });

  it('does not count a pull that does not cover the bureau as a deletion', () => {
    const findings = findTimelineFindings({
      pulls: [pulls[0], { id: 'tu-only', bureau: 'transunion', pulledAt: at('2026-04-10') }, pulls[2]],
      rows: [row('p1'), row('p3')],
      disputes: [],
    });

    expect(findings).toEqual([]);
  });

  it('flags a field the bureau changed after verifying it, and a missing dispute notation while still disputed', () => {
    const findings = findTimelineFindings({
      pulls,
      rows: [row('p1'), row('p2', { balance: 95000 })],
      disputes: [{ creditAccountId: 'p1-ex', bureau: 'experian', outcome: 'verified', responseReceivedAt: at('2026-02-20'), stillDisputed: true }],
    });

    expect(findings.map(item => [item.kind, item.tier])).toEqual([
      ['changed_after_verification', 'objective'],
      ['missing_dispute_flag', 'interpretive'],
    ]);
    expect(findings[0].text).toBe('You told me this account was verified as accurate on 2/2026, but you have since changed the balance from $1,200.00 to $950.00. The information you verified was not accurate.');
  });

  it('does not ask for a dispute notation once the client stops disputing', () => {
    const findings = findTimelineFindings({
      pulls,
      rows: [row('p1'), row('p2')],
      disputes: [{ creditAccountId: 'p1-ex', bureau: 'experian', outcome: 'verified', responseReceivedAt: at('2026-02-20'), stillDisputed: false }],
    });

    expect(findings).toEqual([]);
  });
});
