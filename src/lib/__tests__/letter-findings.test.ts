import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/client', () => ({ db: {} }));

import { applyLetterFindings } from '@/lib/letter-findings';

describe('applyLetterFindings', () => {
  it('adds objective findings and their reason codes to the letter', () => {
    expect(applyLetterFindings([
      { tier: 'objective', reasonCode: 'reinserted_item', text: 'This account did not appear in my credit report from 4/2026 and has since reappeared.', review: null },
      { tier: 'objective', reasonCode: 'dofd_cross_bureau_mismatch', text: 'You report the date of first delinquency as 3/2019.', review: null },
    ], { reasonCodes: ['inaccurate_reporting'], metro2Violations: ['existing'] })).toEqual({
      reasonCodes: ['inaccurate_reporting', 'reinserted_item', 'dofd_cross_bureau_mismatch'],
      metro2Violations: [
        'existing',
        'This account did not appear in my credit report from 4/2026 and has since reappeared.',
        'You report the date of first delinquency as 3/2019.',
      ],
    });
  });

  it('adds an interpretive finding only after staff approve it', () => {
    const finding = { tier: 'interpretive' as const, reasonCode: 'missing_dispute_flag', text: 'not marked as disputed' };

    expect(applyLetterFindings([{ ...finding, review: null }], { reasonCodes: ['inaccurate_reporting'] })).toEqual({ reasonCodes: ['inaccurate_reporting'] });
    expect(applyLetterFindings([{ ...finding, review: 'dropped' }], { reasonCodes: ['inaccurate_reporting'] })).toEqual({ reasonCodes: ['inaccurate_reporting'] });
    expect(applyLetterFindings([{ ...finding, review: 'approved' }], { reasonCodes: ['inaccurate_reporting'] })).toEqual({
      reasonCodes: ['inaccurate_reporting', 'missing_dispute_flag'],
      metro2Violations: ['not marked as disputed'],
    });
  });
});
