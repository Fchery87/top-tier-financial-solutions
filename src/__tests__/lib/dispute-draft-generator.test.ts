import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = vi.hoisted(() => ({
  insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
  select: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock('@/db/client', () => ({ db: dbMock }));

const APPROVED_DECISION = {
  approved: true,
  reasonCodes: ['verification_required'],
  requiredEvidence: ['identity_document', 'proof_of_address'],
  claimRisk: 'ordinary' as const,
  targetRecipient: 'bureau' as const,
  violations: [],
};

describe('persistGeneratedDisputeDraft', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dbMock.transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
  });

  it('masks item account numbers and persists the first letter revision atomically', async () => {
    const { buildLetterContextSnapshot, persistGeneratedDisputeDraft } = await import('@/lib/dispute-draft-generator');

    const result = await persistGeneratedDisputeDraft({
      clientId: 'client-1',
      bureau: 'experian',
      disputeReason: 'verification_required',
      disputeType: 'standard',
      round: 1,
      reasonCodes: ['verification_required'],
      policyDecision: APPROVED_DECISION,
      letterContent: 'A compliant letter',
      accountNumber: '123456789',
      items: [{
        kind: 'tradeline',
        bureau: 'experian',
        creditorName: 'Example Bank',
        accountNumber: '123456789',
      }],
    });

    expect(result.revision).toBe(1);
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(txMock.insert).toHaveBeenCalledTimes(2);

    const disputeInsert = txMock.insert.mock.results[0]?.value;
    const disputeValues = disputeInsert.values.mock.calls[0]?.[0];
    expect(disputeValues.letterContextSnapshot).toBe(buildLetterContextSnapshot({
      reasonCodes: ['verification_required'],
      items: [{
        kind: 'tradeline',
        bureau: 'experian',
        creditorName: 'Example Bank',
        accountNumber: '123456789',
      }],
    }));
    expect(disputeValues.accountNumber).toBe('****6789');

    const revisionInsert = txMock.insert.mock.results[1]?.value;
    expect(revisionInsert.values.mock.calls[0]?.[0]).toMatchObject({
      disputeId: result.disputeId,
      revision: 1,
      source: 'generated',
    });
  });

  it('does not expose full account values in generation metadata or snapshots', async () => {
    const { buildLetterContextSnapshot } = await import('@/lib/dispute-draft-generator');

    const snapshot = buildLetterContextSnapshot({
      reasonCodes: ['identity_theft'],
      items: [{ kind: 'tradeline', accountNumber: '999988887777' }],
    });

    expect(snapshot).toContain('****7777');
    expect(snapshot).not.toContain('999988887777');
  });

  it('regenerates a supplied draft ID by appending one revision instead of inserting a duplicate dispute', async () => {
    const { persistGeneratedDisputeDraft } = await import('@/lib/dispute-draft-generator');
    const existingDraftQuery = {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: 'draft-1', status: 'draft' }]),
        })),
      })),
    };
    const latestRevisionQuery = {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ revision: 1 }]),
          })),
        })),
      })),
    };
    txMock.select
      .mockImplementationOnce(() => existingDraftQuery)
      .mockImplementationOnce(() => latestRevisionQuery);

    const result = await persistGeneratedDisputeDraft({
      draftId: 'draft-1',
      clientId: 'client-1',
      bureau: 'experian',
      disputeReason: 'verification_required',
      disputeType: 'standard',
      round: 1,
      reasonCodes: ['verification_required'],
      policyDecision: APPROVED_DECISION,
      letterContent: 'A regenerated letter',
      items: [{ kind: 'tradeline', bureau: 'experian', creditorName: 'Example Bank' }],
    });

    expect(result).toEqual({ disputeId: 'draft-1', revision: 2 });
    expect(txMock.insert).toHaveBeenCalledTimes(1);
    expect(txMock.update).toHaveBeenCalledTimes(1);
    expect(txMock.insert.mock.results[0]?.value.values.mock.calls[0]?.[0]).toMatchObject({
      disputeId: 'draft-1',
      revision: 2,
      source: 'generated',
    });
  });

  it('refuses to persist a draft whose policy decision is not approved', async () => {
    const { persistGeneratedDisputeDraft } = await import('@/lib/dispute-draft-generator');

    await expect(persistGeneratedDisputeDraft({
      clientId: 'client-1',
      bureau: 'experian',
      disputeReason: 'not_mine',
      disputeType: 'standard',
      round: 1,
      reasonCodes: ['not_mine'],
      policyDecision: { ...APPROVED_DECISION, approved: false, violations: ['High-risk claims require claim-specific evidence.'] },
      letterContent: 'A letter',
      items: [{ kind: 'tradeline', bureau: 'experian' }],
    })).rejects.toThrow('An approved dispute policy decision is required');
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });
});
