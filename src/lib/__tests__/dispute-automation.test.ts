import { describe, expect, it } from 'vitest';
import {
  buildEscalationPlan,
  calculateDisputeDeadlines,
  getEscalationHealthStatus,
  getDisputeSlaInstanceId,
  isDryRunRequested,
} from '@/lib/dispute-automation';

describe('dispute automation helpers', () => {
  it('calculates bureau deadlines as 30-day response and 35-day escalation', () => {
    const sentAt = new Date('2026-01-01T00:00:00.000Z');
    const { responseDeadline, escalationReadyAt } = calculateDisputeDeadlines(sentAt, 'bureau');

    expect(responseDeadline.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(escalationReadyAt.toISOString()).toBe('2026-02-05T00:00:00.000Z');
  });

  it('calculates creditor deadlines as 30-day response and 45-day escalation', () => {
    const sentAt = new Date('2026-01-01T00:00:00.000Z');
    const { responseDeadline, escalationReadyAt } = calculateDisputeDeadlines(sentAt, 'creditor');

    expect(responseDeadline.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(escalationReadyAt.toISOString()).toBe('2026-02-15T00:00:00.000Z');
  });

  it('builds verified-outcome escalation from round 1 to round 2', () => {
    const plan = buildEscalationPlan({
      currentRound: 1,
      trigger: 'verified',
      currentBureau: 'equifax',
    });

    expect(plan).toMatchObject({
      nextRound: 2,
      targetRecipient: 'bureau',
      disputeType: 'method_of_verification',
      methodology: 'method_of_verification',
    });

    expect(plan.reasonCodes).toEqual(['previously_disputed', 'request_verification_method']);
  });

  it('builds no-response escalation to cfpb from round 3', () => {
    const plan = buildEscalationPlan({
      currentRound: 3,
      trigger: 'no_response',
      currentBureau: 'transunion',
    });

    expect(plan).toMatchObject({
      nextRound: 4,
      targetRecipient: 'cfpb',
      disputeType: 'fcra_violation_notice',
      methodology: 'consumer_law',
    });

    expect(plan.reasonCodes).toContain('no_response');
  });

  it('builds deterministic dispute SLA instance IDs', () => {
    expect(getDisputeSlaInstanceId('disp-123')).toBe('sla-dispute-disp-123');
  });

  it('parses dry-run flag from query values', () => {
    expect(isDryRunRequested('true')).toBe(true);
    expect(isDryRunRequested('1')).toBe(true);
    expect(isDryRunRequested('yes')).toBe(true);
    expect(isDryRunRequested('false')).toBe(false);
    expect(isDryRunRequested(null)).toBe(false);
  });

  it('classifies escalation health based on run metadata', () => {
    const healthy = getEscalationHealthStatus({
      enabled: true,
      lastRunSuccess: true,
      lastRunAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      staleAfterHours: 24,
    });
    expect(healthy).toBe('healthy');

    const warning = getEscalationHealthStatus({
      enabled: true,
      lastRunSuccess: true,
      lastRunAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      staleAfterHours: 24,
    });
    expect(warning).toBe('warning');

    const error = getEscalationHealthStatus({
      enabled: true,
      lastRunSuccess: false,
      lastRunAt: new Date().toISOString(),
      staleAfterHours: 24,
    });
    expect(error).toBe('error');
  });
});
