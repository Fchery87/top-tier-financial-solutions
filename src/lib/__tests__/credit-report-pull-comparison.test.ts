import { describe, expect, it } from 'vitest';
import { compareApprovedCreditReportPulls, compareCreditReportPulls } from '@/lib/credit-report-pull-comparison';

describe('compareCreditReportPulls', () => {
  it('classifies deleted, updated, unchanged, and new negative items between pulls', () => {
    const comparison = compareCreditReportPulls({
      olderNegativeItems: [
        { id: 'old-1', creditorName: 'Alpha Bank', itemType: 'collection', bureau: 'experian', amount: 500, status: 'open' },
        { id: 'old-2', creditorName: 'Beta Card', itemType: 'late_payment', bureau: 'experian', amount: 1000, status: 'late' },
        { id: 'old-3', creditorName: 'Gamma Loan', itemType: 'charge_off', bureau: 'equifax', amount: 2000, status: 'charged_off' },
      ],
      newerNegativeItems: [
        { id: 'new-2', creditorName: 'Beta Card', itemType: 'late_payment', bureau: 'experian', amount: 750, status: 'late' },
        { id: 'new-3', creditorName: 'Gamma Loan', itemType: 'charge_off', bureau: 'equifax', amount: 2000, status: 'charged_off' },
        { id: 'new-4', creditorName: 'Delta Collection', itemType: 'collection', bureau: 'transunion', amount: 300, status: 'open' },
      ],
    });

    expect(comparison).toEqual({
      deleted: [{ olderId: 'old-1', creditorName: 'Alpha Bank', itemType: 'collection', bureau: 'experian' }],
      updated: [{ olderId: 'old-2', newerId: 'new-2', creditorName: 'Beta Card', itemType: 'late_payment', bureau: 'experian', changedFields: ['amount'] }],
      unchanged: [{ olderId: 'old-3', newerId: 'new-3', creditorName: 'Gamma Loan', itemType: 'charge_off', bureau: 'equifax' }],
      added: [{ newerId: 'new-4', creditorName: 'Delta Collection', itemType: 'collection', bureau: 'transunion' }],
    });
  });

  it('requires both Credit Report Pull fact sets to be approved before comparison', () => {
    const result = compareApprovedCreditReportPulls({
      olderPull: { parserReviewStatus: 'approved' },
      newerPull: { parserReviewStatus: 'needs_review' },
      olderNegativeItems: [],
      newerNegativeItems: [],
    });

    expect(result).toMatchObject({
      approved: false,
      code: 'CREDIT_REPORT_PULL_REVIEW_REQUIRED',
    });
  });
});
