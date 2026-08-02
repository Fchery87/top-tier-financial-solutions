import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/client', () => ({ db: {} }));

import {
  createSaveDisputeLetter,
  type DisputeLetterWorkflowRepository,
  type DisputeWorkflowRow,
} from '@/lib/dispute-letter-workflow';

function makeRepository(row: Partial<DisputeWorkflowRow> = {}, revision = 1) {
  const transaction = {
    lockDispute: vi.fn(async () => ({
      id: 'dispute-1',
      status: 'draft',
      sentAt: null,
      letterContent: 'Original letter',
      reasonCodes: ['not_mine'],
      creditorName: 'Acme Bank',
      originalCreditor: null,
      accountNumber: '****1234',
      bureau: 'experian',
      identityTheftFlag: false,
      letterContextSnapshot: null,
      ...row,
    })),
    getLatestRevision: vi.fn(async () => revision),
    updateLetter: vi.fn(async () => undefined),
    insertRevision: vi.fn(async () => undefined),
  };
  const repository: DisputeLetterWorkflowRepository = {
    transaction: vi.fn(async (operation) => operation(transaction)),
  };
  return { repository, transaction };
}

describe('saveDisputeLetter', () => {
  it('blocks unsupported identity-theft language without writing', async () => {
    const { repository, transaction } = makeRepository();
    const save = createSaveDisputeLetter(repository);

    const result = await save({
      disputeId: 'dispute-1',
      content: 'This fraudulent account is identity theft.',
      source: 'manual',
      actorUserId: 'operator-1',
      acknowledgeWarnings: false,
    });

    expect(result.kind).toBe('blocked');
    expect(transaction.updateLetter).not.toHaveBeenCalled();
    expect(transaction.insertRevision).not.toHaveBeenCalled();
  });

  it('returns warnings until the operator explicitly acknowledges them', async () => {
    const { repository, transaction } = makeRepository();
    const save = createSaveDisputeLetter(repository);

    const result = await save({
      disputeId: 'dispute-1',
      content: 'Please review this legal action request for Acme Bank.',
      source: 'manual',
      actorUserId: 'operator-1',
      acknowledgeWarnings: false,
    });

    expect(result.kind).toBe('warnings');
    expect(transaction.updateLetter).not.toHaveBeenCalled();
  });

  it('saves an acknowledged warning as the next revision with source metadata', async () => {
    const { repository, transaction } = makeRepository();
    const save = createSaveDisputeLetter(repository);

    const result = await save({
      disputeId: 'dispute-1',
      content: 'Please review this legal action request for Acme Bank.',
      source: 'ai_rewrite',
      actorUserId: 'operator-1',
      acknowledgeWarnings: true,
      expectedRevision: 1,
      toneLabel: 'demanding',
      promptUsed: 'rewrite selection',
      generationMetadata: { libraryId: 'library-1', selectionScore: 8, rationale: ['bureau match'], runnersUp: [] },
    });

    expect(result.kind).toBe('saved');
    if (result.kind === 'saved') expect(result.revision).toBe(2);
    expect(transaction.updateLetter).toHaveBeenCalledWith('dispute-1', 'Please review this legal action request for Acme Bank.', expect.any(Date));
    expect(transaction.insertRevision).toHaveBeenCalledWith(expect.objectContaining({
      revision: 2,
      source: 'ai_rewrite',
      toneLabel: 'demanding',
      promptUsed: 'rewrite selection',
      generationMetadata: expect.objectContaining({ libraryId: 'library-1' }),
      acknowledgedBy: 'operator-1',
      warningsAcknowledged: true,
    }));
  });

  it('returns immutable for sent disputes', async () => {
    const { repository, transaction } = makeRepository({ status: 'sent', sentAt: new Date() });
    const save = createSaveDisputeLetter(repository);

    const result = await save({
      disputeId: 'dispute-1',
      content: 'Updated letter',
      source: 'manual',
      actorUserId: 'operator-1',
      acknowledgeWarnings: true,
    });

    expect(result).toEqual({ kind: 'immutable' });
    expect(transaction.updateLetter).not.toHaveBeenCalled();
  });

  it('returns a conflict for a stale expected revision', async () => {
    const { repository, transaction } = makeRepository({ letterContent: 'Current letter' }, 3);
    const save = createSaveDisputeLetter(repository);

    const result = await save({
      disputeId: 'dispute-1',
      content: 'Stale update',
      source: 'manual',
      actorUserId: 'operator-1',
      acknowledgeWarnings: true,
      expectedRevision: 2,
    });

    expect(result).toEqual({ kind: 'conflict', currentContent: 'Current letter', currentRevision: 3 });
    expect(transaction.updateLetter).not.toHaveBeenCalled();
  });

  it('propagates revision insertion failures so the transaction can roll back', async () => {
    const { repository, transaction } = makeRepository();
    transaction.insertRevision.mockRejectedValue(new Error('revision insert failed'));
    const save = createSaveDisputeLetter(repository);

    await expect(save({
      disputeId: 'dispute-1',
      content: 'Clean letter for Acme Bank.',
      source: 'manual',
      actorUserId: 'operator-1',
      acknowledgeWarnings: true,
    })).rejects.toThrow('revision insert failed');
  });
});
