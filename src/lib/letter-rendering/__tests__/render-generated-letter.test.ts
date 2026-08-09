import { renderGeneratedLetter } from '@/lib/letter-rendering/render-generated-letter';
import { describe, expect, it } from 'vitest';

describe('renderGeneratedLetter', () => {
  it('adds the supplied date and recipient address to an undated provider draft', () => {
    expect(renderGeneratedLetter({
      draftText: 'To Whom It May Concern:\n\nPlease investigate this account.',
      renderedOn: 'August 9, 2026',
      recipientAddress: 'Experian\nP.O. Box 4500\nAllen, TX 75013',
    })).toBe(`August 9, 2026

Experian
P.O. Box 4500
Allen, TX 75013

To Whom It May Concern:

Please investigate this account.`);
  });

  it('does not duplicate a date or recipient already present in the provider draft', () => {
    const draftText = `August 9, 2026

Experian
P.O. Box 4500
Allen, TX 75013

Please investigate this account.`;

    expect(renderGeneratedLetter({
      draftText,
      renderedOn: 'August 9, 2026',
      recipientAddress: 'Experian\nP.O. Box 4500\nAllen, TX 75013',
    })).toBe(draftText);
  });
});
