import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildDisputeLetterPrompt } from '@/lib/letter-rendering/build-dispute-letter-prompt';
import { buildMultiItemDisputeLetterPrompt } from '@/lib/letter-rendering/build-multi-item-dispute-letter-prompt';

// Repro: a date-only dateReported printed one day early in zones west of UTC.
const originalTimeZone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/New_York'; });
afterAll(() => { process.env.TZ = originalTimeZone; });

describe('letter prompts', () => {
  it('render the reported date on its calendar day', () => {
    const single = buildDisputeLetterPrompt({
      round: 1,
      targetRecipient: 'bureau',
      clientData: { name: 'Jane Sample' },
      itemData: { creditorName: 'Example Bank', itemType: 'collection', dateReported: '2026-05-01', bureau: 'experian' },
      reasonCodes: ['verification_required'],
    });
    const multi = buildMultiItemDisputeLetterPrompt({
      round: 1,
      targetRecipient: 'bureau',
      clientData: { name: 'Jane Sample' },
      items: [{ creditorName: 'Example Bank', itemType: 'collection', dateReported: '2026-05-01' }],
      bureau: 'experian',
      reasonCodes: ['verification_required'],
    });

    expect(single).toContain('Date Reported: 5/1/2026');
    expect(multi).toContain('- Date Reported: 5/1/2026');
  });
});
