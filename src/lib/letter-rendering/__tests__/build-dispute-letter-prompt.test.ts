import { buildDisputeLetterPrompt } from '@/lib/letter-rendering/build-dispute-letter-prompt';
import { describe, expect, it } from 'vitest';

const params = {
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
  librarySelection: {
    chosen: {
      id: 'library-1',
      methodology: 'factual',
      targetRecipient: 'bureau',
      round: 2,
      itemTypes: ['collection'],
      bureau: null,
      reasonCodes: ['verification_required'],
      promptContext: 'Lead with the documented balance discrepancy.',
      legalCitations: ['FCRA 611', 'FCRA 1681i', 'FCRA 623'],
      effectivenessRating: null,
      timesUsed: 0,
      lastUsedAt: null,
    },
    score: 100,
    rationale: [],
    runnersUp: [],
  },
};

describe('buildDisputeLetterPrompt', () => {
  it('preserves selected library context while capping citations', () => {
    const prompt = buildDisputeLetterPrompt(params);

    expect(prompt).toContain(
      'ROUND STRATEGY\nLead with the documented balance discrepancy.',
    );
    expect(prompt).toContain('Ground the request in: FCRA 611, FCRA 1681i.');
    expect(prompt).not.toContain('FCRA 623.');
    expect(prompt).toContain('Do not threaten legal action, damages, or punishment.');
  });
});
