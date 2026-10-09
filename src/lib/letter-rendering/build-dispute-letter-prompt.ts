import type { Selection } from '@/lib/letter-library-selector';
import { BUREAU_ADDRESSES, REASON_CODE_DESCRIPTIONS } from './letter-prompt-data';
import { formatCalendarDate, formatLetterDate } from './letter-dates';

export interface DisputeLetterPromptInput {
  round: number;
  targetRecipient: 'bureau' | 'creditor' | 'collector' | 'furnisher' | 'cfpb';
  clientData: { name: string };
  itemData: {
    creditorName: string;
    originalCreditor?: string;
    accountNumber?: string;
    itemType: string;
    amount?: number;
    dateReported?: string;
    bureau: string;
  };
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

function formatRecipientAddress(input: DisputeLetterPromptInput): string {
  if (input.targetRecipient === 'bureau') {
    return BUREAU_ADDRESSES[input.itemData.bureau.toLowerCase()] || BUREAU_ADDRESSES.transunion;
  }

  return `${input.itemData.creditorName}\nCredit Dispute Department`;
}

/**
 * Produces provider instructions exclusively from already-approved letter facts.
 * It has no database, policy, or provider dependency.
 */
export function buildDisputeLetterPrompt(params: DisputeLetterPromptInput): string {
  const reasonDescription = getReasonDescriptions(params.reasonCodes);
  const metro2Section = buildMetro2ViolationsSection(params.metro2Violations);
  const recipientAddress = formatRecipientAddress(params);
  const targetLabel = params.targetRecipient === 'bureau'
    ? params.itemData.bureau.toUpperCase()
    : params.itemData.creditorName;
  const defaultStrategy = params.round >= 3
    ? 'This is a direct furnisher escalation. Keep the tone factual and request investigation under FCRA Section 623(a)(8).'
    : params.round === 2
      ? 'This is a method-of-verification follow-up. Request the prior investigation method under FCRA Section 611(a)(6)(B)(iii).'
      : 'This is an initial factual dispute. Request investigation and correction or removal if unverifiable.';
  const strategy = params.librarySelection?.chosen?.promptContext ?? defaultStrategy;
  const legalCitations = params.librarySelection?.chosen?.legalCitations?.filter(Boolean).slice(0, 2) || [];
  const libraryAuthority = legalCitations.length > 0
    ? `\nRELEVANT AUTHORITY\nGround the request in: ${legalCitations.join(', ')}.\nCite at most two, in plain language. Do not stack citations.\n`
    : '';

  return `Write a factual credit dispute letter in plain text only.

RULES
- Do not threaten legal action, damages, or punishment.
- Do not claim identity theft, fraud, or ownership denial unless the provided reasons explicitly support it.
- Do not cite Metro 2 field numbers. Refer only to segment and field names when needed.
- Keep the tone professional, specific, and factual.
- Ask for investigation, verification, and correction or removal if the information cannot be verified.
- If this is Round 2, include a request for the method of verification.
- If this is Round 3 or later, keep the focus on a direct furnisher investigation request.

LETTER CONTEXT
Date: ${formatLetterDate()}
Recipient:
${recipientAddress}
Target: ${targetLabel}
Round: ${params.round}
Client Name: ${params.clientData.name}
Account Name: ${params.itemData.creditorName}
${params.itemData.originalCreditor ? `Original Creditor: ${params.itemData.originalCreditor}` : ''}
${params.itemData.accountNumber ? `Account Number: ****${params.itemData.accountNumber.slice(-4)}` : ''}
Item Type: ${formatItemType(params.itemData.itemType)}
${params.itemData.amount ? `Reported Amount: ${formatCurrency(params.itemData.amount)}` : ''}
${params.itemData.dateReported ? `Date Reported: ${formatCalendarDate(params.itemData.dateReported)}` : ''}
Reason Description: ${reasonDescription}
${params.customReason ? `Additional Context: ${params.customReason}` : ''}
${metro2Section || 'No specific Metro 2 issue list was provided. Request verification of the reported data for accuracy and completeness.'}

ROUND STRATEGY
${strategy}
${libraryAuthority}

Return only the completed letter text.`;
}
