import type { Selection } from '@/lib/letter-library-selector';
import { BUREAU_ADDRESSES, REASON_CODE_DESCRIPTIONS } from './letter-prompt-data';
import { formatCalendarDate } from './letter-dates';

export interface MultiItemDisputeLetterPromptInput {
  round: number;
  targetRecipient: 'bureau' | 'creditor' | 'collector' | 'furnisher' | 'cfpb';
  clientData: { name: string };
  items: Array<{
    creditorName: string;
    originalCreditor?: string;
    accountNumber?: string;
    itemType: string;
    amount?: number;
    dateReported?: string;
  }>;
  bureau: string;
  reasonCodes: string[];
  customReason?: string;
  metro2Violations?: string[];
  librarySelection?: Selection;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatItemType(type: string): string {
  return type.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function getReasonDescriptions(reasonCodes: string[]): string {
  return reasonCodes
    .map((code) => REASON_CODE_DESCRIPTIONS[code] || code)
    .join(' Additionally, ');
}

function buildMetro2ViolationsSection(violations?: string[]): string {
  if (!violations || violations.length === 0) return '';
  const uniqueViolations = [...new Set(violations.filter(Boolean))];
  if (uniqueViolations.length === 0) return '';

  return [
    '=== METRO 2 COMPLIANCE VIOLATIONS (MUST CITE THESE IN LETTER BODY) ===',
    'The AI analysis identified the following specific Metro 2 violations.',
    'You MUST integrate these into your dispute explanation section.',
    '',
    ...uniqueViolations.map((violation, index) => `${index + 1}. ${violation}`),
    '',
    '=== END OF VIOLATIONS - CITE ALL OF THESE IN LETTER ===',
  ].join('\n');
}

/**
 * Builds provider instructions solely from approved, already-selected facts.
 * It does not query data or decide policy, eligibility, or persistence.
 */
export function buildMultiItemDisputeLetterPrompt(params: MultiItemDisputeLetterPromptInput): string {
  const reasonDescription = getReasonDescriptions(params.reasonCodes);
  const metro2Section = buildMetro2ViolationsSection(params.metro2Violations);
  const recipientAddress = params.targetRecipient === 'bureau'
    ? (BUREAU_ADDRESSES[params.bureau.toLowerCase()] || BUREAU_ADDRESSES.transunion)
    : 'Credit Dispute Department';
  const itemsList = params.items.map((item, index) => {
    const maskedAccountNumber = item.accountNumber ? `****${item.accountNumber.slice(-4)}` : '';
    return `Account ${index + 1}:\n- Creditor: ${item.creditorName}\n${item.originalCreditor ? `- Original Creditor: ${item.originalCreditor}\n` : ''}${maskedAccountNumber ? `- Account Number: ${maskedAccountNumber}\n` : ''}- Type: ${formatItemType(item.itemType)}\n${item.amount ? `- Amount: ${formatCurrency(item.amount)}\n` : ''}${item.dateReported ? `- Date Reported: ${formatCalendarDate(item.dateReported)}` : ''}`.trim();
  }).join('\n\n');
  const defaultStrategy = params.targetRecipient !== 'bureau' && params.targetRecipient !== 'cfpb'
    ? 'This is a courtesy request sent directly to the furnisher. Ask it to review and correct its reporting. Do not claim the furnisher is legally required to investigate.'
    : params.round >= 3
    ? 'This is a repeat bureau dispute that raises information the earlier disputes did not include. Lead with that new information and request a new reinvestigation that considers it.'
    : params.round === 2
      ? 'This is a method-of-verification follow-up. Request a description of the prior reinvestigation procedure under FCRA Section 611(a)(7).'
      : 'This is an initial factual dispute. Request investigation and correction or removal if unverifiable.';
  const strategy = params.librarySelection?.chosen?.promptContext || defaultStrategy;
  const legalCitations = params.librarySelection?.chosen?.legalCitations?.filter(Boolean).slice(0, 2) || [];

  return `Write one factual credit dispute letter in plain text only for multiple disputed accounts.

RULES
- Do not threaten legal action, damages, or punishment.
- Do not claim identity theft, fraud, or ownership denial unless the provided reasons explicitly support it.
- Do not demand deletion as the only outcome; request investigation and correction or removal if unverifiable.
- Do not cite Metro 2 field numbers. Refer only to segment and field names when needed.
- Keep the tone professional, specific, and factual.
- For each disputed detail, name the reported value and why it is inaccurate or incomplete, using only values given in the account details, reasons, or violations above. Never state a reported value that is not provided. Do not fall back to a bare demand for verification when the data shows a specific problem.
- Do not demand original contracts, ledgers, or other documents from a credit bureau. The FCRA requires a reasonable reinvestigation, not production of documents.
- Begin at the "Re:" subject line or the salutation. Do not write a sender header, the client's address, a date line, or the recipient's address; those are added to the letter separately.
- End with "Sincerely," followed by the client's name.

LETTER CONTEXT
Recipient (for the salutation only):\n${recipientAddress}
Bureau: ${params.bureau.toUpperCase()}
Round: ${params.round}
Client Name: ${params.clientData.name}
Reason Description: ${reasonDescription}
${params.customReason ? `Additional Context: ${params.customReason}` : ''}
${metro2Section || 'No specific Metro 2 issue list was provided. Request verification of the reported data for accuracy and completeness.'}

DISPUTED ACCOUNTS
${itemsList}

If this is Round 2, request the method of verification. If this is Round 3 or later, lead with the information the earlier disputes did not include.

ROUND STRATEGY
${strategy}
${legalCitations.length > 0
    ? `RELEVANT AUTHORITY\nGround the request in: ${legalCitations.join(', ')}.\nCite at most two, in plain language. Do not stack citations.`
    : ''}

Return only the letter text, from the subject line or salutation through the signature.`;
}
