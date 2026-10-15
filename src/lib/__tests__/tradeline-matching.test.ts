import { describe, expect, it } from 'vitest';
import { groupAcrossBureaus, tradelineMatchKey } from '@/lib/tradeline-matching';

const opened = new Date('2020-01-15T00:00:00.000Z');

describe('tradelineMatchKey', () => {
  it("prefers the combined report's own grouping", () => {
    expect(tradelineMatchKey({ bureau: 'experian', tradelineKey: 'r1:identityiq-3', creditorName: 'A', accountNumber: null, dateOpened: null })).toBe('key:r1:identityiq-3');
  });

  it('uses the last four visible digits and the month opened', () => {
    expect(tradelineMatchKey({ bureau: 'experian', tradelineKey: null, creditorName: 'A', accountNumber: 'XXXX-5678', dateOpened: opened })).toBe('digits:5678|2020-01');
  });

  it('falls back to the creditor and month opened when the number is fully masked', () => {
    expect(tradelineMatchKey({ bureau: 'experian', tradelineKey: null, creditorName: 'Capital One, N.A.', accountNumber: '****', dateOpened: opened })).toBe('creditor:capital one n a|2020-01');
  });

  it('does not match without a month opened', () => {
    expect(tradelineMatchKey({ bureau: 'experian', tradelineKey: null, creditorName: 'A', accountNumber: '1234', dateOpened: null })).toBeNull();
  });
});

describe('groupAcrossBureaus', () => {
  it('drops a group with two rows from the same bureau', () => {
    const row = { tradelineKey: null, creditorName: 'A', accountNumber: '***1234', dateOpened: opened };
    expect(groupAcrossBureaus([
      { ...row, bureau: 'experian' },
      { ...row, bureau: 'experian' },
      { ...row, bureau: 'equifax' },
    ])).toEqual([]);
  });

  it('groups one account across bureaus', () => {
    const row = { tradelineKey: null, creditorName: 'A', accountNumber: '***1234', dateOpened: opened };
    const groups = groupAcrossBureaus([{ ...row, bureau: 'experian' }, { ...row, bureau: 'equifax' }]);
    expect(groups.map(group => [...group.keys()])).toEqual([['experian', 'equifax']]);
  });
});
