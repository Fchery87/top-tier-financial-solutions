import { describe, expect, it } from 'vitest';
import { detectDuplicateLiability, detectReaging } from '@/lib/negative-item-detectors';
import { triageItems } from '@/lib/dispute-triage';
import { buildCreditorStrategyInsights, getRecommendedMethodologyForCreditor } from '@/lib/creditor-strategy-insights';

describe('phase 3 detectors', () => {
  it('detects re-aging from payment history vs DOFD', () => {
    const result = detectReaging([
      {
        id: 'item-1',
        creditorName: 'Debt Buyer',
        itemType: 'collection',
        bureau: 'transunion',
        dateOfFirstDelinquency: '2025-03-01T00:00:00.000Z',
        paymentHistoryGrid: { '2024-01': '30', '2024-02': '00' },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe('item-1');
  });

  it('detects duplicate liability from same creditor and account suffix', () => {
    const result = detectDuplicateLiability([
      { id: 'a', creditorName: 'Collector A', originalCreditor: 'Original Creditor', accountNumber: '123456', itemType: 'collection', bureau: 'experian' },
      { id: 'b', creditorName: 'Original Creditor', originalCreditor: 'Original Creditor', accountNumber: '123456', itemType: 'charge_off', bureau: 'equifax' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].itemIds).toEqual(['a', 'b']);
  });
});

describe('phase 3 triage recommendations', () => {
  it('prefers historical methodology for round 1 when provided', () => {
    const summary = buildCreditorStrategyInsights([
      { creditorName: 'Portfolio Recovery', methodology: 'debt_validation', outcome: 'deleted' },
      { creditorName: 'Portfolio Recovery', methodology: 'debt_validation', outcome: 'deleted' },
      { creditorName: 'Portfolio Recovery', methodology: 'debt_validation', outcome: 'deleted' },
    ]);
    expect(getRecommendedMethodologyForCreditor('Portfolio Recovery', summary)).toBe('debt_validation');
  });

  it('keeps round 2+ methodology as method_of_verification', () => {
    const summary = triageItems([
      { id: 'i1', creditorName: 'Test', itemType: 'collection', amount: 0, dateReported: null, riskSeverity: 'medium', recommendedAction: null, bureau: 'transunion' },
    ], 2);
    expect(summary.byStrategy.method_of_verification).toBe(1);
  });
});
