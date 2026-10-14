import { describe, expect, it } from 'vitest';
import { buildAccountBalanceDiscrepancies } from '@/lib/credit-analysis-discrepancies';

const opened = new Date('2020-01-15T00:00:00.000Z');

describe('buildAccountBalanceDiscrepancies', () => {
  it('compares balances across the per-bureau rows of one tradeline', () => {
    const discrepancies = buildAccountBalanceDiscrepancies('client-1', 'report-1', [
      { creditorName: 'Capital Bank', accountNumber: '***1111', bureau: 'transunion', tradelineKey: 'report-1:identityiq-0', dateOpened: opened, balance: 500 },
      { creditorName: 'Capital Bank', accountNumber: '***2222', bureau: 'experian', tradelineKey: 'report-1:identityiq-0', dateOpened: opened, balance: 900 },
    ]);

    expect(discrepancies).toHaveLength(1);
    expect(discrepancies[0]).toMatchObject({
      clientId: 'client-1',
      creditReportId: 'report-1',
      discrepancyType: 'account_balance',
      field: 'balance',
      creditorName: 'Capital Bank',
      valueTransunion: '500',
      valueExperian: '900',
      valueEquifax: null,
      severity: 'medium',
      isDisputable: true,
    });
  });

  it('does not compare rows it cannot confidently match', () => {
    expect(buildAccountBalanceDiscrepancies('client-1', 'report-1', [
      { creditorName: 'Capital Bank', accountNumber: '***1111', bureau: 'transunion', tradelineKey: null, dateOpened: null, balance: 500 },
      { creditorName: 'Capital Bank', accountNumber: '***1111', bureau: 'experian', tradelineKey: null, dateOpened: null, balance: 900 },
    ])).toEqual([]);
  });

  it('does not flag matching balances', () => {
    expect(buildAccountBalanceDiscrepancies('client-1', 'report-1', [
      { creditorName: 'Capital Bank', accountNumber: '1234****', bureau: 'transunion', tradelineKey: null, dateOpened: opened, balance: 500 },
      { creditorName: 'Capital Bank', accountNumber: 'XXXX1234', bureau: 'equifax', tradelineKey: null, dateOpened: opened, balance: 500 },
    ])).toEqual([]);
  });
});
