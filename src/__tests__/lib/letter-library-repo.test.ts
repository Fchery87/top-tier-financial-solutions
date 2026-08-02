import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock('@/db/client', () => ({ db: queryMock }));

import { fetchCandidates, parseLibraryCandidate } from '@/lib/letter-library-repo';

describe('letter library repository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('parses JSON columns defensively', () => {
    const parsed = parseLibraryCandidate({
      id: 'library-1',
      methodology: 'factual',
      targetRecipient: 'bureau',
      round: 1,
      itemTypes: JSON.stringify(['collection']),
      bureau: null,
      reasonCodes: JSON.stringify(['wrong_balance']),
      promptContext: 'Use the balance discrepancy.',
      legalCitations: JSON.stringify(['FCRA 611']),
      effectivenessRating: 50,
      timesUsed: 12,
      lastUsedAt: new Date('2026-07-01T00:00:00Z'),
    });

    expect(parsed).toMatchObject({
      id: 'library-1',
      itemTypes: ['collection'],
      reasonCodes: ['wrong_balance'],
      legalCitations: ['FCRA 611'],
    });
  });

  it('skips rows with malformed JSON instead of throwing', () => {
    const parsed = parseLibraryCandidate({
      id: 'bad-row',
      methodology: 'factual',
      targetRecipient: 'bureau',
      round: 1,
      itemTypes: '{bad json',
      bureau: null,
      reasonCodes: JSON.stringify(['wrong_balance']),
      promptContext: null,
      legalCitations: JSON.stringify([]),
      effectivenessRating: null,
      timesUsed: 0,
      lastUsedAt: null,
    });

    expect(parsed).toBeNull();
  });

  it('queries active rows for the recipient and universal or matching bureau', async () => {
    const whereMock = vi.fn().mockResolvedValue([{
      id: 'library-1',
      methodology: 'factual',
      targetRecipient: 'bureau',
      round: 1,
      itemTypes: JSON.stringify(['collection']),
      bureau: null,
      reasonCodes: JSON.stringify(['verification_required']),
      promptContext: 'Use facts.',
      legalCitations: JSON.stringify([]),
      effectivenessRating: null,
      timesUsed: 0,
      lastUsedAt: null,
    }]);
    queryMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({ where: whereMock }),
    });

    const candidates = await fetchCandidates({
      round: 1,
      targetRecipient: 'bureau',
      bureau: 'experian',
      itemType: 'collection',
      reasonCodes: ['verification_required'],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.id).toBe('library-1');
    expect(whereMock).toHaveBeenCalledOnce();
  });
});
