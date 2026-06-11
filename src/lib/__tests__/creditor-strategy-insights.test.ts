import { describe, expect, it } from 'vitest';
import {
  buildCreditorStrategyInsights,
  getRecommendedMethodologyForCreditor,
  normalizeCreditorName,
  MIN_SAMPLE_SIZE,
} from '@/lib/creditor-strategy-insights';

describe('normalizeCreditorName', () => {
  it('collapses punctuation, casing, and whitespace variants', () => {
    expect(normalizeCreditorName('Midland  Credit Mgmt.')).toBe('MIDLAND CREDIT MGMT');
    expect(normalizeCreditorName('midland credit mgmt')).toBe('MIDLAND CREDIT MGMT');
  });
});

describe('buildCreditorStrategyInsights', () => {
  const outcomes = [
    // Midland: debt_validation works (3 of 4 deleted), factual does not
    { creditorName: 'Midland Credit Mgmt', methodology: 'debt_validation', outcome: 'deleted' },
    { creditorName: 'Midland Credit Mgmt.', methodology: 'debt_validation', outcome: 'deleted' },
    { creditorName: 'MIDLAND CREDIT MGMT', methodology: 'debt_validation', outcome: 'updated' },
    { creditorName: 'Midland Credit Mgmt', methodology: 'debt_validation', outcome: 'verified' },
    { creditorName: 'Midland Credit Mgmt', methodology: 'factual', outcome: 'verified' },
    { creditorName: 'Midland Credit Mgmt', methodology: 'factual', outcome: 'verified' },
    // Capital One: only 2 outcomes, below sample threshold
    { creditorName: 'Capital One', methodology: 'factual', outcome: 'deleted' },
    { creditorName: 'Capital One', methodology: 'factual', outcome: 'deleted' },
  ];

  it('groups name variants of the same creditor together', () => {
    const summary = buildCreditorStrategyInsights(outcomes);
    const midland = summary.creditors.find(c => c.normalizedName === 'MIDLAND CREDIT MGMT');
    expect(midland).toBeDefined();
    expect(midland!.total).toBe(6);
  });

  it('computes per-methodology success rates', () => {
    const summary = buildCreditorStrategyInsights(outcomes);
    const midland = summary.creditors.find(c => c.normalizedName === 'MIDLAND CREDIT MGMT')!;
    const dv = midland.byMethodology.find(m => m.methodology === 'debt_validation')!;
    expect(dv.total).toBe(4);
    expect(dv.successRate).toBeCloseTo(0.75);
    const factual = midland.byMethodology.find(m => m.methodology === 'factual')!;
    expect(factual.successRate).toBe(0);
  });

  it('recommends the highest-success methodology with enough samples', () => {
    const summary = buildCreditorStrategyInsights(outcomes);
    const midland = summary.creditors.find(c => c.normalizedName === 'MIDLAND CREDIT MGMT')!;
    expect(midland.recommendedMethodology).toBe('debt_validation');
  });

  it('withholds a recommendation below the minimum sample size', () => {
    const summary = buildCreditorStrategyInsights(outcomes);
    const capOne = summary.creditors.find(c => c.normalizedName === 'CAPITAL ONE')!;
    expect(capOne.total).toBeLessThan(MIN_SAMPLE_SIZE);
    expect(capOne.recommendedMethodology).toBeNull();
  });

  it('ignores rows without a creditor name', () => {
    const summary = buildCreditorStrategyInsights([
      { creditorName: null, methodology: 'factual', outcome: 'deleted' },
      { creditorName: '  ', methodology: 'factual', outcome: 'deleted' },
    ]);
    expect(summary.totalOutcomes).toBe(0);
    expect(summary.creditors).toHaveLength(0);
  });

  it('does not recommend a methodology that has never succeeded', () => {
    const summary = buildCreditorStrategyInsights([
      { creditorName: 'LVNV Funding', methodology: 'factual', outcome: 'verified' },
      { creditorName: 'LVNV Funding', methodology: 'factual', outcome: 'verified' },
      { creditorName: 'LVNV Funding', methodology: 'factual', outcome: 'no_response' },
    ]);
    const lvnv = summary.creditors.find(c => c.normalizedName === 'LVNV FUNDING')!;
    expect(lvnv.recommendedMethodology).toBeNull();
  });
});

describe('getRecommendedMethodologyForCreditor', () => {
  it('resolves recommendations through name normalization', () => {
    const summary = buildCreditorStrategyInsights([
      { creditorName: 'Portfolio Recovery', methodology: 'debt_validation', outcome: 'deleted' },
      { creditorName: 'Portfolio Recovery', methodology: 'debt_validation', outcome: 'deleted' },
      { creditorName: 'Portfolio Recovery', methodology: 'debt_validation', outcome: 'deleted' },
    ]);
    expect(getRecommendedMethodologyForCreditor('portfolio recovery.', summary)).toBe('debt_validation');
    expect(getRecommendedMethodologyForCreditor('Unknown Creditor', summary)).toBeNull();
  });
});
