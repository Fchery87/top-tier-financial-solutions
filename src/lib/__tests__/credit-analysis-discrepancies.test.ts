import { describe, expect, it } from 'vitest';
import { buildAccountBalanceDiscrepancies } from '@/lib/credit-analysis-discrepancies';

describe('buildAccountBalanceDiscrepancies', () => {
  it('does not create a discrepancy for the same account across different pulls when each row only has one bureau value', () => {
    const discrepancies = buildAccountBalanceDiscrepancies('client-1', 'report-1', [
      {
        creditReportId: 'report-1',
        creditorName: 'Capital Bank',
        accountNumber: '***1111',
        onTransunion: true,
        onExperian: false,
        onEquifax: false,
        transunionBalance: 500,
        experianBalance: null,
        equifaxBalance: null,
      },
      {
        creditReportId: 'report-1',
        creditorName: 'Capital Bank',
        accountNumber: '***1111',
        onTransunion: false,
        onExperian: true,
        onEquifax: false,
        transunionBalance: null,
        experianBalance: 900,
        equifaxBalance: null,
      },
    ]);

    expect(discrepancies).toEqual([]);
  });

  it('creates a discrepancy when a single pull stores different per-bureau balances on one account row', () => {
    const discrepancies = buildAccountBalanceDiscrepancies('client-1', 'report-1', [
      {
        creditReportId: 'report-1',
        creditorName: 'Capital Bank',
        accountNumber: '***1111',
        onTransunion: true,
        onExperian: true,
        onEquifax: false,
        transunionBalance: 500,
        experianBalance: 900,
        equifaxBalance: null,
      },
    ]);

    expect(discrepancies).toHaveLength(1);
    expect(discrepancies[0]).toMatchObject({
      clientId: 'client-1',
      creditReportId: 'report-1',
      discrepancyType: 'account_balance',
      field: 'balance',
      creditorName: 'Capital Bank',
      accountNumber: '***1111',
      valueTransunion: '500',
      valueExperian: '900',
      valueEquifax: null,
      severity: 'medium',
      isDisputable: true,
    });
    expect(discrepancies[0].disputeRecommendation).toContain('within this report pull');
    expect(discrepancies[0].id).toBeTypeOf('string');
    expect(discrepancies[0].createdAt).toBeInstanceOf(Date);
  });
});
