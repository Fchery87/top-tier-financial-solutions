import { renderGeneratedLetter, splitRenderedLetter } from '@/lib/letter-rendering/render-generated-letter';
import type { LetterConsumerIdentity } from '@/lib/letter-rendering/types';
import { describe, expect, it } from 'vitest';

const consumer: LetterConsumerIdentity = {
  fullName: 'Jane Sample',
  streetAddress: '100 Main St',
  city: 'Albany',
  state: 'NY',
  zip: '12207',
  dateOfBirth: '1985-03-07',
  ssnLast4: '1234',
};

const EXPERIAN = 'Experian\nP.O. Box 4500\nAllen, TX 75013';

const EXPECTED_HEADER = `Jane Sample
100 Main St
Albany, NY 12207
Date of Birth: 03/07/1985
SSN (last 4): XXX-XX-1234

October 8, 2026

Experian
P.O. Box 4500
Allen, TX 75013`;

// Verbatim DeepSeek (deepseek-flash) draft captured on 2026-10-08 from the
// pre-fix prompt. It carries its own sender, date and recipient header.
const REAL_DEEPSEEK_DRAFT = `Jane Sample
October 8, 2026

Experian
P.O. Box 4500
Allen, TX 75013

Subject: Factual Credit Report Dispute – Account ****7766

Dear Experian,

I am writing to dispute the accuracy and completeness of the following item in my credit report:

Account Name: Example Bank
Account Number: ****7766
Item Type: Collection
Reported Amount: $500.00
Date Reported: 4/30/2026

I am requesting documented verification of this account information. Under FCRA Section 611, I understand you are required to conduct a reasonable investigation and verify all data fields with the original furnisher.

Please verify the reported data for accuracy and completeness, including the account name, account number, item type, reported amount, and date reported. If the information cannot be verified as accurate and complete, please correct or remove this item as applicable.

Please send me the results of your investigation and an updated copy of my credit report if any changes are made.

Sincerely,
Jane Sample`;

describe('renderGeneratedLetter', () => {
  it('prepends the exact consumer header, the letter date and the recipient', () => {
    expect(renderGeneratedLetter({
      draftText: 'To Whom It May Concern:\n\nPlease investigate this account.\n\nSincerely,\n\nJane Sample',
      consumer,
      renderedOn: 'October 8, 2026',
      recipientAddress: EXPERIAN,
    })).toBe(`${EXPECTED_HEADER}

To Whom It May Concern:

Please investigate this account.

Sincerely,

Jane Sample`);
  });

  it('omits the date-of-birth and SSN lines when they are absent', () => {
    expect(renderGeneratedLetter({
      draftText: 'To Whom It May Concern:\n\nPlease investigate this account.\n\nSincerely,\n\nJane Sample',
      consumer: { fullName: 'Jane Sample', streetAddress: '100 Main St', city: 'Albany', state: 'NY', zip: '12207' },
      renderedOn: 'October 8, 2026',
      recipientAddress: EXPERIAN,
    })).toBe(`Jane Sample
100 Main St
Albany, NY 12207

October 8, 2026

${EXPERIAN}

To Whom It May Concern:

Please investigate this account.

Sincerely,

Jane Sample`);
  });

  it('removes the header a real model draft already wrote, so nothing is duplicated', () => {
    const letter = renderGeneratedLetter({
      draftText: REAL_DEEPSEEK_DRAFT,
      consumer,
      renderedOn: 'October 9, 2026',
      recipientAddress: EXPERIAN,
    });

    const body = REAL_DEEPSEEK_DRAFT.slice(REAL_DEEPSEEK_DRAFT.indexOf('Subject:'));
    expect(letter).toBe(`${EXPECTED_HEADER.replace('October 8, 2026', 'October 9, 2026')}\n\n${body}`);
    expect(letter.match(/Jane Sample/g)).toHaveLength(2);
    expect(letter.match(/P\.O\. Box 4500/g)).toHaveLength(1);
    expect(letter).not.toContain('October 8, 2026');
  });

  it('keeps an opening paragraph that is prose, not a header', () => {
    const draft = 'I am writing to dispute the accuracy of the Example Bank account.\n\nSincerely,\n\nJane Sample';
    const letter = renderGeneratedLetter({ draftText: draft, consumer, renderedOn: 'October 8, 2026', recipientAddress: EXPERIAN });

    expect(letter).toBe(`${EXPECTED_HEADER}\n\n${draft}`);
  });

  it('signs with the consumer name, replacing a bracketed placeholder', () => {
    const letter = renderGeneratedLetter({
      draftText: '[Your Name]\n[Your Address]\n\nRe: Dispute\n\nPlease investigate.\n\nSincerely,\n[Your Name]',
      consumer,
      renderedOn: 'October 8, 2026',
      recipientAddress: EXPERIAN,
    });

    expect(letter).toBe(`${EXPECTED_HEADER}\n\nRe: Dispute\n\nPlease investigate.\n\nSincerely,\nJane Sample`);
  });

  it('adds a signature block when the draft has none', () => {
    const letter = renderGeneratedLetter({
      draftText: 'Re: Dispute\n\nPlease investigate.',
      consumer,
      renderedOn: 'October 8, 2026',
      recipientAddress: EXPERIAN,
    });

    expect(letter).toBe(`${EXPECTED_HEADER}\n\nRe: Dispute\n\nPlease investigate.\n\nSincerely,\n\nJane Sample`);
  });
});

describe('splitRenderedLetter', () => {
  it('separates the code-rendered header from the body', () => {
    const letter = renderGeneratedLetter({
      draftText: 'Re: Dispute\n\nPlease investigate.\n\nSincerely,\n\nJane Sample',
      consumer,
      renderedOn: 'October 8, 2026',
      recipientAddress: EXPERIAN,
    });

    expect(splitRenderedLetter(letter)).toEqual({
      header: EXPECTED_HEADER,
      body: 'Re: Dispute\n\nPlease investigate.\n\nSincerely,\n\nJane Sample',
    });
  });

  it('returns null for a letter without a code-rendered header', () => {
    expect(splitRenderedLetter('August 9, 2026\n\nExperian\n\nPlease investigate.')).toBeNull();
  });
});
