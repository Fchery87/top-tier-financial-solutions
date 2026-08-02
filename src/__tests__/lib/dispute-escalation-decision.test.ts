import { describe, expect, it, vi } from 'vitest';
import { buildEscalationPlan } from '@/lib/dispute-automation';
import { decideEscalation, type DisputeHistoryEntry } from '@/lib/dispute-escalation-decision';

vi.mock('@/db/client', () => ({ db: {} }));

function entry(overrides: Partial<DisputeHistoryEntry> = {}): DisputeHistoryEntry {
  return {
    id: 'current', clientId: 'client-1', negativeItemId: 'item-1', priorDisputeId: null,
    targetRecipient: 'creditor', status: 'sent', sentAt: new Date('2026-01-01T00:00:00Z'), responseReceivedAt: null,
    ...overrides,
  };
}

describe('decideEscalation', () => {
  const plan = buildEscalationPlan({ currentRound: 3, trigger: 'no_response', currentBureau: 'experian' });

  it('blocks CFPB escalation before CRA exhaustion', () => {
    const result = decideEscalation({ plan, history: [entry()], now: new Date('2026-01-20T00:00:00Z') });
    expect(result.kind).toBe('blocked');
    if (result.kind === 'blocked') expect(result.eligibility.reason).toBe('missing_cra_dispute');
  });

  it('uses the most recent matching CRA dispute and allows a response before day 45', () => {
    const result = decideEscalation({
      plan,
      history: [entry(), entry({ id: 'cra-1', targetRecipient: 'bureau', sentAt: new Date('2026-01-01T00:00:00Z'), responseReceivedAt: new Date('2026-01-05T00:00:00Z') })],
      now: new Date('2026-01-20T00:00:00Z'),
    });
    expect(result.kind).toBe('ready');
  });

  it('does not treat a direct furnisher dispute as the CRA prerequisite', () => {
    const result = decideEscalation({
      plan,
      history: [entry({ targetRecipient: 'creditor' }), entry({ id: 'older-creditor', targetRecipient: 'creditor' })],
      now: new Date('2026-08-01T00:00:00Z'),
    });
    expect(result.kind).toBe('blocked');
  });
});
