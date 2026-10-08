import { describe, expect, it } from 'vitest';
import { requiresNormalizationReview } from '@/lib/credit-report-normalization/review-gate';

describe('requiresNormalizationReview', () => {
  it('requires staff review when normalization detects an unsupported bureau', () => {
    expect(requiresNormalizationReview([
      {
        code: 'unsupported_bureau',
        recordId: 'account:0:capital-bank:1234',
        value: 'other-credit-bureau',
      },
    ])).toBe(true);
  });

  it('allows fully normalized reports to continue to existing completeness review', () => {
    expect(requiresNormalizationReview([])).toBe(false);
  });
});
