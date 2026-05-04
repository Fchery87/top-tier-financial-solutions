import { describe, expect, it } from 'vitest';
import { buildProgressReportInputs } from '@/lib/progress-report-inputs';

describe('buildProgressReportInputs', () => {
  it('combines pull comparison and reviewed outcomes for progress reporting', () => {
    const inputs = buildProgressReportInputs({
      pullComparison: {
        deleted: [{ olderId: 'old-1', creditorName: 'Alpha Bank', itemType: 'collection', bureau: 'experian' }],
        updated: [{ olderId: 'old-2', newerId: 'new-2', creditorName: 'Beta Card', itemType: 'late_payment', bureau: 'equifax', changedFields: ['amount'] }],
        unchanged: [],
        added: [{ newerId: 'new-3', creditorName: 'Gamma Collection', itemType: 'collection', bureau: 'transunion' }],
      },
      reviewedOutcomes: [
        { disputeId: 'dispute-1', outcome: 'deleted', bureau: 'experian', creditorName: 'Alpha Bank' },
        { disputeId: 'dispute-2', outcome: 'verified', bureau: 'equifax', creditorName: 'Beta Card' },
      ],
    });

    expect(inputs).toEqual({
      pull_comparison: {
        deleted_count: 1,
        updated_count: 1,
        new_negative_count: 1,
      },
      reviewed_outcomes: {
        deleted_count: 1,
        updated_count: 0,
        verified_count: 1,
      },
      client_visible_highlights: [
        '1 negative item no longer appears on the newer report pull.',
        '1 reporting item changed between report pulls.',
        '1 reviewed dispute outcome confirmed a deletion.',
      ],
    });
  });
});
