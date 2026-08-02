import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

const setSettingMock = vi.hoisted(() => vi.fn());
const decideEscalationMock = vi.hoisted(() => vi.fn());
const loadDisputeChainMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/settings-service', () => ({ setSetting: setSettingMock }));
vi.mock('@/lib/dispute-escalation-decision', () => ({
  decideEscalation: decideEscalationMock,
  loadDisputeChain: loadDisputeChainMock,
}));
vi.mock('@/lib/ai-letter-generator', () => ({ generateUniqueDisputeLetter: vi.fn() }));
vi.mock('@/lib/letter-generation-library', () => ({ selectLibraryForGeneration: vi.fn() }));
vi.mock('@/lib/dispute-draft-generator', () => ({ persistGeneratedDisputeDraft: vi.fn() }));

function query(result: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve(result)),
    })),
  };
}

function limitedQuery(result: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(result),
      })),
    })),
  };
}

describe('runDisputeEscalationAutomation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setSettingMock.mockResolvedValue(undefined);
    loadDisputeChainMock.mockResolvedValue([]);
  });

  it('defers an ineligible CFPB candidate and records its next eligibility date', async () => {
    const eligibleAt = new Date('2026-09-01T00:00:00.000Z');
    const candidate = {
      id: 'dispute-3',
      clientId: 'client-1',
      negativeItemId: 'item-1',
      bureau: 'experian',
      round: 3,
      status: 'sent',
      responseReceivedAt: null,
      escalationReadyAt: new Date('2026-08-01T00:00:00.000Z'),
      priorDisputeId: null,
      outcome: 'no_response',
    };

    dbMock.select
      .mockReturnValueOnce(query([candidate]))
      .mockReturnValueOnce(limitedQuery([]))
      .mockReturnValueOnce(limitedQuery([{ id: 'client-1', firstName: 'Jane', lastName: 'Client' }]))
      .mockReturnValueOnce(limitedQuery([{ id: 'item-1', creditAccountId: null, creditorName: 'Example Bank', originalCreditor: null, itemType: 'collection', amount: 100, dateReported: null }]));
    decideEscalationMock.mockReturnValue({
      kind: 'blocked',
      message: 'CFPB complaint is not yet eligible',
      eligibility: { eligible: false, reason: 'still_pending', eligibleAt },
    });

    const { runDisputeEscalationAutomation } = await import('@/lib/dispute-escalation-runner');
    const result = await runDisputeEscalationAutomation({ dryRun: false });

    expect(result).toMatchObject({
      checked: 1,
      escalated: 0,
      skipped: 0,
      deferred: 1,
      next_eligibility_at: eligibleAt.toISOString(),
    });
    expect(setSettingMock).toHaveBeenCalledWith(
      'automation.dispute_escalations.last_run',
      expect.objectContaining({ deferred: 1, nextEligibilityAt: eligibleAt.toISOString() }),
      'json',
      'compliance',
      expect.any(String),
    );
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe('buildEscalationLetterParams', () => {
  it('keeps the selected plan and bureau item data intact for generation', async () => {
    const { buildEscalationLetterParams } = await import('@/lib/dispute-escalation-runner');
    const result = buildEscalationLetterParams({
      client: { firstName: 'Jane', lastName: 'Client' },
      dispute: { bureau: 'experian' },
      negativeItem: {
        id: 'item-1',
        creditorName: 'Example Bank',
        originalCreditor: 'Original Bank',
        itemType: 'collection',
        amount: 125,
        dateReported: new Date('2026-01-01T00:00:00.000Z'),
      },
      creditAccount: { accountNumber: '123456789' },
      plan: {
        nextRound: 3,
        targetRecipient: 'creditor',
        disputeType: 'direct_creditor',
        methodology: 'factual',
        reasonCodes: ['verification_required'],
        customReason: 'Prior verification was insufficient',
      },
    });

    expect(result).toMatchObject({
      round: 3,
      targetRecipient: 'creditor',
      clientData: { name: 'Jane Client' },
      itemData: {
        creditorName: 'Example Bank',
        originalCreditor: 'Original Bank',
        accountNumber: '123456789',
        bureau: 'experian',
      },
      reasonCodes: ['verification_required'],
    });
  });
});
