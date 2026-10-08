import { describe, expect, it } from 'vitest';
import { buildMultiItemDisputeLetterPrompt } from '@/lib/letter-rendering/build-multi-item-dispute-letter-prompt';

describe('buildMultiItemDisputeLetterPrompt', () => {
  it('projects approved multi-item facts and caps library citations', () => {
    const prompt = buildMultiItemDisputeLetterPrompt({
      round: 2,
      targetRecipient: 'bureau',
      clientData: { name: 'Alex Example' },
      items: [{
        creditorName: 'Example Creditor',
        accountNumber: '1234',
        itemType: 'collection',
      }],
      bureau: 'experian',
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
    });

    expect(prompt).toContain('Creditor: Example Creditor');
    expect(prompt).toContain('Account Number: ****1234');
    expect(prompt).toContain('Lead with the documented balance discrepancy.');
    expect(prompt).toContain('FCRA 611, FCRA 1681i');
    expect(prompt).not.toContain('FCRA 623');
  });
});
