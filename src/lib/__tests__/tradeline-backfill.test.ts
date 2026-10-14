import { describe, expect, it } from 'vitest';
import { planTradelineBackfill } from '@/lib/tradeline-backfill';
import type { ParsedAccount } from '@/lib/parsers/pdf-parser';

const transunionAccount: ParsedAccount = {
  creditorName: 'Collection Agency',
  accountNumber: '***1111',
  bureau: 'transunion',
  bureauEvidence: { transunion: { accountNumber: '***1111' } },
  tradelineGroup: 'identityiq-0',
  originalCreditor: 'Sprint',
  dateOfFirstDelinquency: new Date('2018-01-15T00:00:00.000Z'),
  isNegative: true,
};
const experianAccount: ParsedAccount = {
  ...transunionAccount,
  accountNumber: '***2222',
  bureau: 'experian',
  bureauEvidence: { experian: { accountNumber: '***2222' } },
  dateOfFirstDelinquency: new Date('2018-02-20T00:00:00.000Z'),
};

describe('planTradelineBackfill', () => {
  it("fills each stored row from its own bureau's parsed tradeline", () => {
    expect(planTradelineBackfill({
      reportId: 'report-1',
      reportBureau: 'combined',
      rows: [
        { id: 'row-tu', bureau: 'transunion', creditorName: 'Collection Agency', accountNumber: '***1111' },
        { id: 'row-ex', bureau: null, creditorName: 'Collection Agency', accountNumber: '***2222' },
      ],
      parsedAccounts: [transunionAccount, experianAccount],
    })).toEqual([
      { id: 'row-tu', set: { tradelineKey: 'report-1:identityiq-0', originalCreditor: 'Sprint', dateOfFirstDelinquency: new Date('2018-01-15T00:00:00.000Z') } },
      { id: 'row-ex', set: { bureau: 'experian', tradelineKey: 'report-1:identityiq-0', originalCreditor: 'Sprint', dateOfFirstDelinquency: new Date('2018-02-20T00:00:00.000Z') } },
    ]);
  });

  it('leaves a row alone when more than one parsed tradeline could be it', () => {
    expect(planTradelineBackfill({
      reportId: 'report-1',
      reportBureau: 'combined',
      rows: [{ id: 'row-1', bureau: null, creditorName: 'Collection Agency', accountNumber: '***1111' }],
      parsedAccounts: [transunionAccount, { ...experianAccount, accountNumber: '***1111', bureauEvidence: { experian: { accountNumber: '***1111' } } }],
    })).toEqual([]);
  });
});
