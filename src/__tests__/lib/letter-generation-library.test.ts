import { describe, expect, it, vi } from 'vitest';

const fetchCandidatesMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/letter-library-repo', () => ({
  fetchCandidates: fetchCandidatesMock,
}));

import { selectLibraryForGeneration } from '@/lib/letter-generation-library';

describe('selectLibraryForGeneration', () => {
  it('returns the pure selector result for a generation request', async () => {
    fetchCandidatesMock.mockResolvedValue([{
      id: 'library-1',
      methodology: 'factual',
      targetRecipient: 'bureau',
      round: 1,
      itemTypes: ['collection'],
      bureau: null,
      reasonCodes: ['verification_required'],
      promptContext: 'Use facts.',
      legalCitations: [],
      effectivenessRating: null,
      timesUsed: 0,
      lastUsedAt: null,
    }]);

    const selection = await selectLibraryForGeneration({
      round: 1,
      targetRecipient: 'bureau',
      bureau: 'experian',
      itemType: 'collection',
      reasonCodes: ['verification_required'],
      methodology: 'factual',
    });

    expect(selection.chosen?.id).toBe('library-1');
    expect(fetchCandidatesMock).toHaveBeenCalledWith(expect.objectContaining({
      targetRecipient: 'bureau',
      bureau: 'experian',
    }));
  });

  it('returns an empty selection when the library is unavailable', async () => {
    fetchCandidatesMock.mockRejectedValue(new Error('database unavailable'));

    await expect(selectLibraryForGeneration({
      round: 1,
      targetRecipient: 'bureau',
      bureau: 'experian',
      itemType: 'collection',
      reasonCodes: ['verification_required'],
    })).resolves.toMatchObject({ chosen: null, score: 0 });
  });
});
