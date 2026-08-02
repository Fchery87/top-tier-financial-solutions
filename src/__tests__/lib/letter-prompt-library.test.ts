import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/settings-service', () => ({
  DEFAULT_LLM_MODELS: { google: 'test', openai: 'test', anthropic: 'test', zhipu: 'test' },
  getLLMConfig: vi.fn(),
}));

vi.mock('@/lib/letter-library-repo', () => ({
  incrementLibraryUsage: vi.fn(),
}));

import { buildManualLetterPrompt } from '@/lib/ai-letter-generator';

const baseParams = {
  disputeType: 'standard',
  round: 2,
  targetRecipient: 'bureau' as const,
  clientData: { name: 'Alex Example' },
  itemData: {
    creditorName: 'Example Creditor',
    itemType: 'collection',
    bureau: 'experian',
  },
  reasonCodes: ['verification_required'],
};

describe('library strategy prompt enrichment', () => {
  it('preserves the existing round strategy when no library row is selected', () => {
    const prompt = buildManualLetterPrompt(baseParams);

    expect(prompt).toContain('ROUND STRATEGY\nThis is a method-of-verification follow-up. Request the prior investigation method under FCRA Section 611(a)(6)(B)(iii).');
    expect(prompt).not.toContain('RELEVANT AUTHORITY');
  });

  it('replaces the hardcoded strategy and caps authority at two citations', () => {
    const prompt = buildManualLetterPrompt({
      ...baseParams,
      librarySelection: {
        chosen: {
          id: 'library-1',
          methodology: 'factual',
          targetRecipient: 'bureau',
          round: 2,
          itemTypes: ['collection'],
          bureau: null,
          reasonCodes: ['verification_required'],
          promptContext: 'Lead with the documented balance discrepancy and request a complete investigation.',
          legalCitations: ['FCRA 611', 'FCRA 1681i', 'FCRA 623'],
          effectivenessRating: null,
          timesUsed: 0,
          lastUsedAt: null,
        },
        score: 100,
        rationale: ['Matches the requested reason code.'],
        runnersUp: [],
      },
    });

    expect(prompt).toContain('ROUND STRATEGY\nLead with the documented balance discrepancy and request a complete investigation.');
    expect(prompt).toContain('Ground the request in: FCRA 611, FCRA 1681i.');
    expect(prompt).not.toContain('FCRA 623.');
  });

  it('does not emit an authority block for empty citations', () => {
    const prompt = buildManualLetterPrompt({
      ...baseParams,
      librarySelection: {
        chosen: {
          id: 'library-1',
          methodology: 'factual',
          targetRecipient: 'bureau',
          round: 2,
          itemTypes: ['collection'],
          bureau: null,
          reasonCodes: ['verification_required'],
          promptContext: 'Use the selected factual strategy.',
          legalCitations: [],
          effectivenessRating: null,
          timesUsed: 0,
          lastUsedAt: null,
        },
        score: 100,
        rationale: [],
        runnersUp: [],
      },
    });

    expect(prompt).not.toContain('RELEVANT AUTHORITY');
  });
});
