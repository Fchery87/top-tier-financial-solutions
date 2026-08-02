import { describe, expect, it } from 'vitest';
import { assessCfpbEligibility } from '@/lib/cfpb-eligibility';

describe('assessCfpbEligibility', () => {
  const now = new Date('2026-08-02T12:00:00.000Z');

  it('requires a submitted CRA dispute', () => {
    expect(assessCfpbEligibility({ submittedToCra: false, sentAt: now, responseReceivedAt: null }, now).reason).toBe('missing_cra_dispute');
  });

  it('uses UTC calendar days and exposes the eligibility date', () => {
    const result = assessCfpbEligibility({ submittedToCra: true, sentAt: new Date('2026-06-18T23:30:00.000-04:00'), responseReceivedAt: null }, now);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('still_pending');
    expect(result.eligibleAt?.toISOString()).toBe('2026-08-03T00:00:00.000Z');
  });

  it('allows a received CRA response before day 45', () => {
    const result = assessCfpbEligibility({ submittedToCra: true, sentAt: new Date('2026-07-15T00:00:00.000Z'), responseReceivedAt: new Date('2026-07-20T00:00:00.000Z') }, now);
    expect(result).toMatchObject({ eligible: true, reason: 'eligible' });
  });

  it('rejects an unsent CRA dispute', () => {
    expect(assessCfpbEligibility({ submittedToCra: true, sentAt: null, responseReceivedAt: null }, now).reason).toBe('not_sent');
  });
});
