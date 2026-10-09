import { getObsolescenceClock } from './fcra-clock';
import { getLLMConfig, type LLMConfig } from './settings-service';
import { lintGeneratedLetter } from './letter-lint';
import type { Selection } from './letter-library-selector';
import { logServerEvent } from '@/lib/server-logger';
import { renderGeneratedLetter as renderGeneratedLetterDeterministically } from './letter-rendering/render-generated-letter';
import { buildDisputeLetterPrompt } from './letter-rendering/build-dispute-letter-prompt';
import { BUREAU_ADDRESSES, REASON_CODE_DESCRIPTIONS } from './letter-rendering/letter-prompt-data';
import { generateLetterDraft, LetterDraftError } from './letter-rendering/provider-adapter';
import type { LetterResponseFormat } from './letter-rendering/types';
import { buildMultiItemDisputeLetterPrompt } from './letter-rendering/build-multi-item-dispute-letter-prompt';
import { formatCalendarDate, formatLetterDate } from './letter-rendering/letter-dates';

export { renderGeneratedLetter } from './letter-rendering/render-generated-letter';
export { buildDisputeLetterPrompt } from './letter-rendering/build-dispute-letter-prompt';
export { REASON_CODE_DESCRIPTIONS } from './letter-rendering/letter-prompt-data';

export async function generateWithLLM(prompt: string, config: LLMConfig, responseFormat: LetterResponseFormat): Promise<string> {
  return generateLetterDraft({ prompt, config, responseFormat });
}

/**
 * Why a letter request fell back to the deterministic template:
 * - missing_api_key: no provider key is configured
 * - configuration: the provider configuration is unusable
 * - truncated: the provider stopped at its token limit
 * - empty_response: the provider returned no text
 * - provider_error: the provider call failed
 * - lint_failed: the AI draft failed deterministic output linting
 */
export type LetterFallbackReason =
  | 'missing_api_key'
  | 'configuration'
  | 'truncated'
  | 'empty_response'
  | 'provider_error'
  | 'lint_failed';

export type LetterGenerationSource = 'ai' | 'template_fallback';

export interface LetterGenerationResult {
  letter: string;
  source: LetterGenerationSource;
  failureReason?: LetterFallbackReason;
}

function providerFailureReason(error: unknown): LetterFallbackReason {
  return error instanceof LetterDraftError ? error.reason : 'provider_error';
}

/**
 * Runs the provider then renders and lints its draft. Any failure falls back
 * to the deterministic template, and the result says so truthfully.
 */
async function renderWithFallback(options: {
  llmConfig: LLMConfig;
  buildPrompt: () => string;
  render: (draft: string) => string;
  fallback: () => string;
  lint: (letter: string) => void;
  librarySelection?: Selection;
}): Promise<LetterGenerationResult> {
  const fallbackResult = (failureReason: LetterFallbackReason, error?: unknown): LetterGenerationResult => {
    logServerEvent({ level: failureReason === 'missing_api_key' ? 'warn' : 'error', event: 'server.lib.ai.letter.generator.template_fallback', error: error ?? failureReason });
    const letter = options.fallback();
    options.lint(letter);
    return { letter, source: 'template_fallback', failureReason };
  };

  const result = await generateOrFallBack(options, fallbackResult);
  await recordLibraryUsage(options.librarySelection);
  return result;
}

async function generateOrFallBack(
  options: { llmConfig: LLMConfig; buildPrompt: () => string; render: (draft: string) => string; lint: (letter: string) => void },
  fallbackResult: (failureReason: LetterFallbackReason, error?: unknown) => LetterGenerationResult,
): Promise<LetterGenerationResult> {
  if (!options.llmConfig.apiKey) return fallbackResult('missing_api_key');

  let draft: string;
  try {
    draft = await generateWithLLM(options.buildPrompt(), options.llmConfig, 'text');
  } catch (error) {
    return fallbackResult(providerFailureReason(error), error);
  }

  try {
    const letter = options.render(draft);
    options.lint(letter);
    return { letter, source: 'ai' };
  } catch (error) {
    return fallbackResult('lint_failed', error);
  }
}

interface ClientInfo {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  ssnLastFour?: string;
  dateOfBirth?: string;
}

interface NegativeItemInfo {
  creditorName: string;
  originalCreditor?: string;
  accountNumber?: string;
  itemType: string;
  amount?: number;
  dateReported?: string;
  bureau: string;
}

interface EvidenceEnclosure {
  documentType: string;
  documentName: string;
}

interface GenerateLetterParams {
  disputeType: string;
  round: number;
  targetRecipient: 'bureau' | 'creditor' | 'collector' | 'furnisher' | 'cfpb';
  clientData: ClientInfo;
  itemData: NegativeItemInfo;
  reasonCodes: string[];
  customReason?: string;
  methodology?: string;
  metro2Violations?: string[];
  priorDisputeDate?: string;
  priorDisputeResult?: string;
  enclosures?: EvidenceEnclosure[];
  librarySelection?: Selection;
}

async function recordLibraryUsage(selection?: Selection): Promise<void> {
  const libraryId = selection?.chosen?.id;
  if (!libraryId) return;

  await import('./letter-library-repo')
    .then(({ incrementLibraryUsage }) => incrementLibraryUsage(libraryId))
    .catch(error => logServerEvent({ level: 'error', event: 'server.lib.ai.letter.generator.error', error: error }));
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatItemType(type: string): string {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function buildEnclosuresSection(enclosures?: EvidenceEnclosure[]): string {
  if (!enclosures || enclosures.length === 0) {
    return `Enclosures:
- Copy of government-issued identification
- Proof of current address`;
  }
  const enclosureLines = enclosures.map(e => `- ${e.documentName || e.documentType}`);
  const hasId = enclosures.some(e => e.documentType === 'id_document');
  const hasProof = enclosures.some(e => e.documentType === 'proof_of_address');
  if (!hasId) enclosureLines.unshift('- Copy of government-issued identification');
  if (!hasProof) enclosureLines.splice(hasId ? 1 : 2, 0, '- Proof of current address');
  return `Enclosures:
${enclosureLines.join('\n')}`;
}

function buildMetro2ViolationsSection(violations?: string[]): string {
  if (!violations || violations.length === 0) return '';
  const uniqueViolations = [...new Set(violations.filter(Boolean))];
  if (uniqueViolations.length === 0) return '';
  return ['=== METRO 2 COMPLIANCE VIOLATIONS (MUST CITE THESE IN LETTER BODY) ===', 'The AI analysis identified the following specific Metro 2 violations.', 'You MUST integrate these into your dispute explanation section.', '', ...uniqueViolations.map((v, i) => `${i + 1}. ${v}`), '', '=== END OF VIOLATIONS - CITE ALL OF THESE IN YOUR LETTER ==='].join('\n');
}

export function getReasonDescriptions(reasonCodes: string[]): string {
  return reasonCodes
    .map(code => REASON_CODE_DESCRIPTIONS[code] || code)
    .join(' Additionally, ');
}

function formatRecipientAddress(targetRecipient: GenerateLetterParams['targetRecipient'], bureau: string, creditorName: string): string {
  if (targetRecipient === 'bureau') {
    return BUREAU_ADDRESSES[bureau.toLowerCase()] || BUREAU_ADDRESSES.transunion;
  }
  return `${creditorName}\nCredit Dispute Department`;
}

function buildNeutralFallbackLetter(params: GenerateLetterParams): string {
  const currentDate = formatLetterDate();
  const reasonDescription = getReasonDescriptions(params.reasonCodes);
  const metro2ViolationsRaw = params.metro2Violations && params.metro2Violations.length > 0
    ? params.metro2Violations.filter(Boolean)
    : [];
  const recipientAddress = formatRecipientAddress(params.targetRecipient, params.itemData.bureau, params.itemData.creditorName);
  const maskedAccountNumber = params.itemData.accountNumber
    ? `****${params.itemData.accountNumber.slice(-4)}`
    : '';
  const actionRequest = params.round >= 3
    ? 'Please review this dispute as a direct furnisher investigation request under FCRA Section 623(a)(8) and provide a written response with the results of your review.'
    : params.round === 2
      ? 'Please provide the method of verification used in the prior investigation, including how the disputed information was reviewed and with whom.'
      : 'Please investigate the disputed information and confirm whether each reported detail is complete and accurate.';
  let metro2ViolationsText = '';
  if (metro2ViolationsRaw.length > 0) {
    metro2ViolationsText = `\nSPECIFIC REPORTING CONCERNS IDENTIFIED:\n${metro2ViolationsRaw.map((v, i) => `${i + 1}. ${v}`).join('\n')}`;
  }

  return `${currentDate}

${recipientAddress}

Re: FCRA Dispute - Request for Investigation and Verification
Account: ${params.itemData.creditorName}
${maskedAccountNumber ? `Account Number: ${maskedAccountNumber}` : ''}
Dispute Round: ${params.round}

To Whom It May Concern:

I am writing to dispute the accuracy and completeness of the account information listed below and to request a reasonable investigation under the Fair Credit Reporting Act.

DISPUTED ACCOUNT INFORMATION:
Creditor Name: ${params.itemData.creditorName}
${params.itemData.originalCreditor ? `Original Creditor: ${params.itemData.originalCreditor}` : ''}
${maskedAccountNumber ? `Account Number: ${maskedAccountNumber}` : ''}
Item Type: ${formatItemType(params.itemData.itemType)}
${params.itemData.amount ? `Reported Amount: ${formatCurrency(params.itemData.amount)}` : ''}
${params.itemData.dateReported ? `Date Reported: ${formatCalendarDate(params.itemData.dateReported)}` : ''}

REASON FOR DISPUTE:
${reasonDescription}

${params.customReason ? `Additional Information: ${params.customReason}` : ''}
${metro2ViolationsText}

REQUEST FOR REVIEW:
1. Investigate the disputed information with the furnisher or the records you maintain
2. Verify that the reported account details are complete and accurate
3. Provide a written response describing the results of your review
4. Correct or remove any information that cannot be verified as accurate

${actionRequest}

Please respond within the time allowed by the Fair Credit Reporting Act.

Sincerely,

${params.clientData.name}
${params.clientData.address ? params.clientData.address : ''}
${params.clientData.city && params.clientData.state && params.clientData.zip ? `${params.clientData.city}, ${params.clientData.state} ${params.clientData.zip}` : ''}

${buildEnclosuresSection(params.enclosures)}`;
}

export function buildManualLetterPrompt(params: GenerateLetterParams): string {
  return buildDisputeLetterPrompt(params);
}

function buildLetterLintContext(params: GenerateLetterParams) {
  return {
    reasonCodes: params.reasonCodes,
    items: [{
      creditorName: params.itemData.creditorName,
      originalCreditor: params.itemData.originalCreditor,
      accountNumber: params.itemData.accountNumber,
      amount: params.itemData.amount,
      bureau: params.itemData.bureau,
    }],
    identityTheftFlag: params.reasonCodes.includes('identity_theft'),
  };
}

function buildMultiItemLetterLintContext(params: GenerateMultiItemLetterParams) {
  return {
    reasonCodes: params.reasonCodes,
    items: params.items.map(item => ({
      creditorName: item.creditorName,
      originalCreditor: item.originalCreditor,
      accountNumber: item.accountNumber,
      amount: item.amount,
      bureau: params.bureau,
    })),
    identityTheftFlag: params.reasonCodes.includes('identity_theft'),
  };
}

function assertLetterLint(letter: string, context: ReturnType<typeof buildLetterLintContext> | ReturnType<typeof buildMultiItemLetterLintContext>): void {
  const lintResult = lintGeneratedLetter(letter, context);
  if (lintResult.blocked) {
    throw new Error(`Letter lint failed: ${lintResult.findings.filter(finding => finding.severity === 'block').map(finding => finding.message).join(' ')}`);
  }
}

export function safeParseJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || trimmed;
  const objectStart = candidate.indexOf('{');
  const objectEnd = candidate.lastIndexOf('}');
  if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) return null;

  const jsonSlice = candidate.slice(objectStart, objectEnd + 1);
  try {
    return JSON.parse(jsonSlice) as T;
  } catch {
    return null;
  }
}

function postProcessLetter(letter: string, params: GenerateLetterParams): string {
  return renderGeneratedLetterDeterministically({
    draftText: letter,
    renderedOn: formatLetterDate(),
    recipientAddress: params.targetRecipient === 'bureau'
      ? BUREAU_ADDRESSES[params.itemData.bureau.toLowerCase()]
      : undefined,
  });
}

export async function generateUniqueDisputeLetter(params: GenerateLetterParams): Promise<LetterGenerationResult> {
  return renderWithFallback({
    llmConfig: await getLLMConfig(),
    buildPrompt: () => buildManualLetterPrompt(params),
    render: (draft) => postProcessLetter(draft, params),
    fallback: () => buildNeutralFallbackLetter(params),
    lint: (letter) => assertLetterLint(letter, buildLetterLintContext(params)),
    librarySelection: params.librarySelection,
  });
}

export const DISPUTE_REASON_CODES = [
  // === RECOMMENDED: METRO 2 COMPLIANCE-BASED FACTUAL DISPUTES ===
  // These focus on verification and accuracy without making ownership claims
  { code: 'verification_required', label: 'Verification Required', description: 'Demanding documented verification of account data under FCRA 611', category: 'factual' },
  { code: 'inaccurate_reporting', label: 'Inaccurate Reporting', description: 'Information contains inaccuracies requiring investigation', category: 'factual' },
  { code: 'metro2_violation', label: 'Metro 2 Violation', description: 'Account fails Metro 2 format compliance standards', category: 'factual' },
  { code: 'incomplete_data', label: 'Incomplete Data', description: 'Missing required Metro 2 data fields', category: 'factual' },
  { code: 'missing_dofd', label: 'Missing DOFD', description: 'Derogatory account lacks required Date of First Delinquency', category: 'factual' },
  { code: 'status_inconsistency', label: 'Status Inconsistency', description: 'Account status conflicts with payment history data', category: 'factual' },
  { code: 'balance_discrepancy', label: 'Balance Discrepancy', description: 'Reported balance inconsistent with account records', category: 'factual' },
  
  // === SITUATIONAL: Use when specific conditions apply ===
  { code: 'obsolete', label: 'Obsolete (7+ Years)', description: 'Information exceeds FCRA reporting period', category: 'situational' },
  { code: 'duplicate', label: 'Duplicate Entry', description: 'Account appears multiple times on report', category: 'situational' },
  { code: 'paid_collection', label: 'Paid Collection', description: 'Paid in full but still showing unpaid', category: 'situational' },
  { code: 'closed_by_consumer', label: 'Closed by Consumer', description: 'Account closure status reported incorrectly', category: 'situational' },
  { code: 'wrong_balance', label: 'Wrong Balance/Amount', description: 'Reported amounts are incorrect', category: 'situational' },
  { code: 'wrong_status', label: 'Wrong Status', description: 'Account status is inaccurate', category: 'situational' },
  { code: 'wrong_dates', label: 'Wrong Dates', description: 'Dates are reported incorrectly', category: 'situational' },
  { code: 'unauthorized_inquiry', label: 'Unauthorized Inquiry', description: 'Inquiry lacks documented permissible purpose', category: 'situational' },
  
  // === CAUTION: Only use when client confirms these specific facts ===
  // WARNING: Using these falsely is fraudulent and could result in legal liability
  { code: 'not_mine', label: '⚠️ Not My Account (Requires Confirmation)', description: 'Client confirms they never opened this account', category: 'ownership_claim' },
  { code: 'identity_theft', label: '⚠️ Identity Theft (Requires Police Report)', description: 'Account opened fraudulently - requires documentation', category: 'ownership_claim' },
  { code: 'mixed_file', label: '⚠️ Mixed File (Wrong Person)', description: 'Account belongs to different consumer with similar info', category: 'ownership_claim' },
  { code: 'never_late', label: '⚠️ Never Late (Client Must Verify)', description: 'Client confirms all payments were on time', category: 'ownership_claim' },
];

// Multi-item letter generation for combined disputes
interface GenerateMultiItemLetterParams {
  disputeType: string;
  round: number;
  targetRecipient: 'bureau' | 'creditor' | 'collector' | 'furnisher' | 'cfpb';
  clientData: ClientInfo;
  items: NegativeItemInfo[];
  bureau: string;
  reasonCodes: string[];
  customReason?: string;
  methodology?: string;
  metro2Violations?: string[];
  enclosures?: EvidenceEnclosure[];
  librarySelection?: Selection;
}

export async function generateMultiItemDisputeLetter(params: GenerateMultiItemLetterParams): Promise<LetterGenerationResult> {
  return renderWithFallback({
    llmConfig: await getLLMConfig(),
    buildPrompt: () => buildMultiItemDisputeLetterPrompt(params),
    render: (draft) => postProcessMultiItemLetter(draft, params),
    fallback: () => generateMultiItemFallbackLetter(params),
    lint: (letter) => assertLetterLint(letter, buildMultiItemLetterLintContext(params)),
    librarySelection: params.librarySelection,
  });
}

function postProcessMultiItemLetter(letter: string, params: GenerateMultiItemLetterParams): string {
  return renderGeneratedLetterDeterministically({
    draftText: letter,
    renderedOn: formatLetterDate(),
    recipientAddress: params.targetRecipient === 'bureau'
      ? BUREAU_ADDRESSES[params.bureau.toLowerCase()]
      : undefined,
  });
}

function generateMultiItemFallbackLetter(params: GenerateMultiItemLetterParams): string {
  const currentDate = formatLetterDate();
  const reasonDescription = getReasonDescriptions(params.reasonCodes);
  const metro2ViolationsRaw = params.metro2Violations && params.metro2Violations.length > 0 
    ? params.metro2Violations.filter(Boolean) 
    : [];
  let recipientAddress = '';
  if (params.targetRecipient === 'bureau') {
    recipientAddress = BUREAU_ADDRESSES[params.bureau.toLowerCase()] || BUREAU_ADDRESSES.transunion;
  } else {
    recipientAddress = `Credit Dispute Department`;
  }
  const itemsSection = params.items.map((item, index) => {
    const maskedAccountNumber = item.accountNumber ? `****${item.accountNumber.slice(-4)}` : '';
    return `
ACCOUNT ${index + 1}:
Creditor Name: ${item.creditorName}
${item.originalCreditor ? `Original Creditor: ${item.originalCreditor}` : ''}
${maskedAccountNumber ? `Account Number: ${maskedAccountNumber}` : ''}
Item Type: ${formatItemType(item.itemType)}
${item.amount ? `Reported Amount: ${formatCurrency(item.amount)}` : ''}
${item.dateReported ? `Date Reported: ${formatCalendarDate(item.dateReported)}` : ''}`;
  }).join('\n');
  const creditorList = params.items.map(item => item.creditorName).join(', ');
  let metro2ViolationsText = '';
  if (metro2ViolationsRaw.length > 0) {
    metro2ViolationsText = `\nSPECIFIC REPORTING CONCERNS IDENTIFIED:\n${metro2ViolationsRaw.map((v, i) => `${i + 1}. ${v}`).join('\n')}`;
  }
  return `${currentDate}

${recipientAddress}

Re: FCRA Dispute - Request for Investigation and Verification of Multiple Accounts
Disputed Accounts: ${creditorList}
Number of Accounts: ${params.items.length}
Dispute Round: ${params.round}

To Whom It May Concern:

I am writing to dispute the accuracy and completeness of the following account information and to request a reasonable investigation under the Fair Credit Reporting Act.

DISPUTED ACCOUNTS:
${itemsSection}

REASON FOR DISPUTE (APPLIES TO ALL ACCOUNTS):
${reasonDescription}

${params.customReason ? `Additional Information: ${params.customReason}` : ''}
${metro2ViolationsText}

REQUEST FOR REVIEW:
1. Investigate each disputed account with the furnisher or the records you maintain
2. Verify that the reported account details are complete and accurate
3. Provide a written response describing the results of your review for each account
4. Correct or remove any information that cannot be verified as accurate

If this letter follows a prior dispute, please also provide the method of verification used in the earlier investigation.

Please respond within the time allowed by the Fair Credit Reporting Act.

Sincerely,

${params.clientData.name}
${params.clientData.address ? params.clientData.address : ''}
${params.clientData.city && params.clientData.state && params.clientData.zip ? `${params.clientData.city}, ${params.clientData.state} ${params.clientData.zip}` : ''}

${buildEnclosuresSection(params.enclosures)}`;
}

// ============================================
// AI ITEM ANALYSIS - Auto-determine dispute strategy
// ============================================

export interface ItemAnalysisResult {
  itemId: string;
  creditorName: string;
  itemType: string;
  suggestedMethodology: string;
  autoReasonCodes: string[];
  metro2Violations: string[];
  fcraIssues: string[];
  confidence: number;
  analysisNotes: string;
}

interface AnalyzeItemParams {
  id: string;
  creditorName: string;
  originalCreditor?: string | null;
  itemType: string;
  amount?: number | null;
  dateReported?: string | null;
  dateOfLastActivity?: string | null;
  dateOfFirstDelinquency?: string | null;
  bureauStatedRemovalDate?: string | null;
  bureau?: string | null;
  riskSeverity?: string | null;
  // Metro 2 relevant fields from credit account
  accountStatus?: string | null; // 'open' | 'closed' | 'collection' | 'charge_off' | 'paid'
  accountType?: string | null; // 'credit_card' | 'auto_loan' | 'mortgage' | 'collection' | etc.
  currentBalance?: number | null;
  creditLimit?: number | null;
  highCredit?: number | null;
  pastDueAmount?: number | null;
  chargeOffAmount?: number | null;
  paymentStatus?: string | null; // 'current' | '30_days_late' | '60_days_late' | etc.
  paymentHistory?: Record<string, string> | null;
  paymentHistoryGrid?: Record<string, string> | null;
  dateOpened?: string | null;
  remarks?: string | null;
}

/**
 * P3.5 Enhanced: Analyze a negative item using Metro 2 compliance checklist
 *
 * This function performs FACTUAL analysis based on the Metro 2 data categories:
 * 1. Balance and amount checks - balance vs status consistency
 * 2. Status and payment history consistency - status code vs payment pattern
 * 3. Delinquency timing and obsolescence - DOFD accuracy, 7-year limits
 * 4. Third-party collector issues - missing original creditor for debt buyers
 * 5. Data completeness - required fields that are missing
 * 6. Payment status progression validation - late payment aging patterns
 * 7. Account type vs status compatibility - item type validation
 *
 * P3.5 Enhancements:
 * - More robust confidence scoring based on violation count and severity
 * - Extended Metro 2 violation detection patterns
 * - Enhanced FCRA citation accuracy
 * - Support for analysisAggressiveness parameter affecting violation threshold
 *
 * IMPORTANT: Only flags issues that can be PROVEN from the actual data provided.
 * Does NOT fabricate or assume violations.
 */
export function analyzeNegativeItem(item: AnalyzeItemParams, round: number = 1, aggressiveness: 'conservative' | 'balanced' | 'aggressive' = 'balanced'): ItemAnalysisResult {
  const metro2Violations: string[] = [];
  const fcraIssues: string[] = [];
  const reasonCodes: string[] = [];
  const notes: string[] = [];
  let methodology = 'factual';
  let confidence = 0.5;
  
  // P3.5: Track violation severity scores for enhanced confidence calculation
  const violationSeverities: number[] = []; // 0.1 to 1.0 per violation
  
  const itemType = item.itemType.toLowerCase();
  const accountStatus = item.accountStatus?.toLowerCase();
  const paymentStatus = item.paymentStatus?.toLowerCase();
  const amount = item.currentBalance ?? item.amount ?? 0;
  const creditLimit = item.creditLimit ?? 0;
  const pastDue = item.pastDueAmount ?? 0;
  const paymentHistory = item.paymentHistory || item.paymentHistoryGrid || undefined;
  const now = new Date();

  // ---- CHECK 1: Balance and Status Consistency ----
  // Metro 2 Base Segment requires balance to align with status codes
  
  // 1A. Paid/closed accounts should not show balance
  // EXCEPTION: Charge-offs can legitimately retain a balance after charge-off
  // Only flag if status is paid/closed/transferred/etc, NOT charge_off or collection
  if (amount > 0) {
    const zeroBalanceStatuses = ['paid', 'closed', 'transferred', 'sold', 'included_in_bankruptcy'];
    const shouldHaveZeroBalance = accountStatus && zeroBalanceStatuses.includes(accountStatus);
    
    if (shouldHaveZeroBalance) {
      metro2Violations.push(`Account reports a balance of ${formatCurrency(amount)} while account status is "${accountStatus}" - current balance and account status are inconsistent`);
      reasonCodes.push('balance_discrepancy');
      notes.push(`Positive balance conflicts with status "${accountStatus}"`);
      violationSeverities.push(0.8); // High severity - clear contradiction
    }
  }

  // 1B. Balance exceeds credit limit (revolving accounts only)
  // IMPORTANT: For installment/auto/mortgage loans, balance naturally exceeds or differs from any original amount.
  // This check only applies to revolving credit where a limit exists and should bound utilization.
  const normalizedAccountType = item.accountType?.toLowerCase() || '';
  const isRevolvingAccount = [
    'credit_card',
    'revolving',
    'line_of_credit',
    'charge_card',
    'store_card',
  ].includes(normalizedAccountType);
  if (isRevolvingAccount && creditLimit > 0 && amount > creditLimit * 1.1) { // 10% tolerance
    metro2Violations.push(`Reported balance of ${formatCurrency(amount)} exceeds credit limit of ${formatCurrency(creditLimit)} - possible over-limit or reporting error`);
    reasonCodes.push('wrong_balance');
    notes.push(`Balance exceeds credit limit by ${formatCurrency(amount - creditLimit)}`);
    violationSeverities.push(0.6); // Medium-high severity
  }

  // P3.5: Additional balance checks
  if (amount < 0) {
    metro2Violations.push(`Account reports a negative balance (${formatCurrency(amount)}) - verify whether this is a credit balance or reporting error`);
    reasonCodes.push('wrong_balance');
    violationSeverities.push(0.4);
  }

  if (pastDue > amount && amount > 0) {
    metro2Violations.push(`Past due amount (${formatCurrency(pastDue)}) exceeds total balance (${formatCurrency(amount)}) - amounts are internally inconsistent`);
    reasonCodes.push('balance_discrepancy');
    violationSeverities.push(0.7); // High severity - impossible numbers
  }

  // 1C. Closed account with credit limit but no balance (might be okay, but note it)
  if (accountStatus === 'closed' && creditLimit > 0 && amount === 0) {
    notes.push('Account is closed with retained credit limit - may be normal depending on furnisher reporting practices');
  }

  // ---- CHECK 2: Status and Payment History Consistency ----
  
  // Current status but has past due amount
  if ((accountStatus === 'current' || paymentStatus === 'current') && pastDue > 0) {
    metro2Violations.push(`Account status shows current but past due amount is ${formatCurrency(pastDue)} - status and delinquency fields conflict`);
    reasonCodes.push('status_inconsistency');
    notes.push('Current status conflicts with past due amount');
    violationSeverities.push(0.75); // High severity
  }

  // Charged off but no balance or charge-off amount
  if (accountStatus === 'charge_off') {
    if (amount === 0 && !item.chargeOffAmount) {
      notes.push('Charged-off account reports no balance - verify whether debt was transferred or paid');
    }
  }

  // P3.5: Paid status but recent payment status
  if ((accountStatus === 'paid' || accountStatus === 'closed') && paymentStatus?.includes('late')) {
    metro2Violations.push(`Account marked as "${accountStatus}" but payment status still shows late payments - status fields are contradictory`);
    reasonCodes.push('status_inconsistency');
    violationSeverities.push(0.2);
  }

  if (paymentHistory && Object.keys(paymentHistory).length > 0) {
    const normalizedCodes = Object.values(paymentHistory).map((code) => String(code).toUpperCase());
    const hasLateHistory = normalizedCodes.some((code) => ['30', '60', '90', '120', '150', '180', 'CO', 'COL'].includes(code));
    const allHistoryCurrent = normalizedCodes.every((code) => code === 'OK' || code === 'UNK');

    if (hasLateHistory && (accountStatus === 'current' || paymentStatus === 'current')) {
      metro2Violations.push('Payment history grid shows late or derogatory codes while the current status remains current.');
      reasonCodes.push('status_inconsistency');
      violationSeverities.push(0.7);
    }

    if (allHistoryCurrent && ['charge_off', 'collection'].includes(accountStatus || '')) {
      metro2Violations.push('Payment history grid shows only current/unknown codes while the account status is reported as charge-off or collection.');
      reasonCodes.push('status_inconsistency');
      violationSeverities.push(0.55);
    }
  }

  const reportDate = item.dateReported ? new Date(item.dateReported) : null;
  const lastActivityDate = item.dateOfLastActivity ? new Date(item.dateOfLastActivity) : null;
  const dofdDate = item.dateOfFirstDelinquency ? new Date(item.dateOfFirstDelinquency) : null;
  const bureauRemovalDate = item.bureauStatedRemovalDate ? new Date(item.bureauStatedRemovalDate) : null;
  const openedDate = item.dateOpened ? new Date(item.dateOpened) : null;
  const effectiveDate = bureauRemovalDate || dofdDate || lastActivityDate || reportDate;

  if (effectiveDate) {
    const yearsSinceActivity = (now.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

    const isBankruptcy = itemType === 'bankruptcy';
    const reportingLimit = isBankruptcy ? 10 : 7;

    if (yearsSinceActivity >= reportingLimit) {
      metro2Violations.push(`This ${itemType} has been reporting for ${Math.floor(yearsSinceActivity)} years - exceeds FCRA ${reportingLimit}-year limit (last activity: ${formatCalendarDate(effectiveDate)})`);
      fcraIssues.push(`FCRA § 605(a): Negative information exceeds ${reportingLimit}-year reporting limit`);
      reasonCodes.push('obsolete');
      notes.push(`Item is ${Math.floor(yearsSinceActivity)} years old - past FCRA reporting limit`);
      violationSeverities.push(0.95); // Extremely high severity - clear FCRA violation
    } else if (yearsSinceActivity >= (reportingLimit - 1)) {
      notes.push(`Item is ${Math.floor(yearsSinceActivity)} years old - approaching ${reportingLimit}-year limit`);
    }

    if (itemType === 'inquiry' && yearsSinceActivity >= 2) {
      metro2Violations.push(`Hard inquiry from ${formatCalendarDate(effectiveDate)} exceeds 2-year reporting limit`);
      fcraIssues.push('FCRA § 605(a)(3): Hard inquiries exceeding 2-year period must be removed');
      reasonCodes.push('obsolete');
      violationSeverities.push(0.85); // Very high severity
    }

    const monthsSinceActivity = yearsSinceActivity * 12;
    if (itemType === 'collection' && monthsSinceActivity > (reportingLimit * 12)) {
      notes.push(`P3.5: Collection item is ${Math.floor(monthsSinceActivity)} months old - significantly exceeds reporting period`);
      violationSeverities.push(0.3);
    }
  }

  if (openedDate && reportDate && (itemType === 'collection' || itemType === 'charge_off')) {
    const yearsBetween = (reportDate.getTime() - openedDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (yearsBetween > 2) {
      notes.push(`Account opened ${formatCalendarDate(openedDate)} but reported ${formatCalendarDate(reportDate)} - ${Math.floor(yearsBetween)} year gap may require DOFD verification`);
    }
  }

  const isThirdPartyCollector = itemType === 'collection' && isLikelyCollectionAgency(item.creditorName);
  
  if (isThirdPartyCollector && !item.originalCreditor) {
    metro2Violations.push(`Third-party collection agency "${item.creditorName}" is not reporting Original Creditor Name in the K1 segment - required for debt validation`);
    fcraIssues.push('FCRA § 623(a)(2): Debt collectors must identify the original creditor upon request');
    reasonCodes.push('incomplete_data');
    notes.push('Collection agency account missing required original creditor information');
    violationSeverities.push(0.2); // Medium severity - required field missing
  }

  // P3.5: Additional collection agency checks
  if (isThirdPartyCollector && item.remarks && item.remarks.toLowerCase().includes('sold')) {
    notes.push('P3.5: Collection account marked as sold - may require original creditor identity for validation');
    violationSeverities.push(0.15);
  }

  // ---- CHECK 5: Data Completeness ----
  // Check for missing critical fields based on item type
  
  // Collection/charge-off without a balance amount
  if ((itemType === 'collection' || itemType === 'charge_off') && !amount) {
    notes.push('No balance amount reported for derogatory account - request verification of amount owed');
  }

  // ---- METHODOLOGY SELECTION ----
  // Based on item type and round number
  
  switch (itemType) {
    case 'collection':
      methodology = round === 1 ? 'debt_validation' : 'method_of_verification';
      if (!reasonCodes.includes('verification_required')) {
        reasonCodes.push('verification_required');
      }
      if (notes.length === 0) {
        notes.push('Collection account - requesting debt validation and verification of reporting accuracy');
      }
      break;

    case 'charge_off':
      methodology = 'factual';
      if (!reasonCodes.includes('verification_required')) {
        reasonCodes.push('verification_required');
      }
      if (notes.length === 0) {
        notes.push('Charge-off account - requesting verification of balance, status, and DOFD accuracy');
      }
      break;

    case 'late_payment':
      methodology = 'factual';
      if (!reasonCodes.includes('verification_required')) {
        reasonCodes.push('verification_required');
      }
      if (notes.length === 0) {
        notes.push('Late payment record - requesting verification of payment history accuracy');
      }
      break;

    case 'inquiry':
      methodology = 'factual';
      fcraIssues.push('FCRA § 604: Permissible purpose must be documented');
      reasonCodes.push('verification_required');
      if (notes.length === 0) {
        notes.push('Inquiry - requesting documentation of permissible purpose');
      }
      break;

    default:
      methodology = 'factual';
      if (!reasonCodes.includes('verification_required')) {
        reasonCodes.push('verification_required');
      }
      if (notes.length === 0) {
        notes.push('Requesting verification of account data accuracy and completeness');
      }
  }

  // ---- ROUND-BASED STRATEGY SHIFT ----
  if (round >= 2) {
    methodology = 'method_of_verification';
    fcraIssues.push('FCRA § 611(a)(6)(B)(iii): Consumer entitled to description of method of verification');
    notes.push(`Round ${round}: Requesting method of verification from prior investigation`);
  }

  if (round >= 3) {
    methodology = 'factual';
    fcraIssues.push('FCRA § 623(a)(8): Consumer may dispute directly with the furnisher');
    notes.push('Round 3+: Escalating to direct furnisher investigation based on prior unresolved reporting concerns');
  }

  // ---- P3.5: ENHANCED CONFIDENCE CALCULATION ----
  // Uses violation severity scores instead of simple increments
  // Factors: violation count, severity scores, aggressiveness level

  const hasSpecificIssues = metro2Violations.length > 0;

  if (violationSeverities.length > 0) {
    // Calculate confidence based on violation severities
    const avgSeverity = violationSeverities.reduce((a, b) => a + b, 0) / violationSeverities.length;
    // P3.5: Aggressiveness affects confidence thresholds
    // Confidence = base (0.4) + violation contribution
    // Scale: average severity * multiplier based on count
    const violationBoost = Math.min(avgSeverity * (violationSeverities.length * 0.15), 0.5);
    confidence = 0.4 + violationBoost;
  } else {
    // No specific violations found - generic verification request
    confidence = 0.5 + (aggressiveness === 'conservative' ? 0 : aggressiveness === 'aggressive' ? 0.05 : 0.02);
    if (!hasSpecificIssues) {
      notes.unshift('No specific data inconsistencies identified - requesting general verification');
    }
  }

  // Deduplicate
  const uniqueReasonCodes = [...new Set(reasonCodes)];
  const uniqueMetro2 = [...new Set(metro2Violations)];
  const uniqueFcra = [...new Set(fcraIssues)];

  return {
    itemId: item.id,
    creditorName: item.creditorName,
    itemType: item.itemType,
    suggestedMethodology: methodology,
    autoReasonCodes: uniqueReasonCodes,
    metro2Violations: uniqueMetro2,
    fcraIssues: uniqueFcra,
    confidence: Math.min(Math.max(confidence, 0.3), 1), // Clamp between 0.3 and 1.0
    analysisNotes: notes.join('. '),
  };
}

/**
 * Determines if a creditor name is likely a third-party collection agency
 * vs an original creditor reporting their own account.
 * 
 * Original creditors (NOT collection agencies):
 * - Banks: Chase, Capital One, Discover, Citi, etc.
 * - Telecoms: Verizon, AT&T, T-Mobile, etc.
 * - Utilities: Power companies, gas companies
 * - Retailers: Macy's, Amazon, Target, etc.
 * - Credit card issuers
 * 
 * Collection agencies (third-party):
 */
export function isLikelyCollectionAgency(creditorName: string): boolean {
  const name = creditorName.toUpperCase();
  
  // Common collection agency indicators
  const collectionIndicators = [
    'COLLECTION',
    'RECOVERY',
    'ACQUISITIONS',
    'SERVICES',
    'PORTFOLIO',
    'FINANCIAL RECOVERY',
    'DEBT',
    'RECEIVABLE',
    'CREDENCE',
    'MIDLAND',
    'PRA',
    'PORTFOLIO RECOVERY',
    'LVNV',
    'RESURGENT',
    'CAVALRY',
    'ENHANCED RECOVERY',
    'IC SYSTEM',
    'AFNI',
    'ALLIED INTERSTATE',
    'CBCS',
    'CONVERGENT',
    'ERC',
    'GC SERVICES',
    'MEDICREDIT',
    'JEFFERSON CAPITAL',
    'SECOND ROUND',
    'TRANSWORLD',
    'NCO',
    'AMSHER',
    'CREDIT MANAGEMENT',
    'HALSTED',
    'PENDRICK',
    'WAKEFIELD',
    'FMS',
    'PHOENIX FINANCIAL',
    'RADIUS GLOBAL',
    'NORTHLAND',
    'NATIONAL CREDIT',
    'NATIONAL ENTERPRISE',
    'GLOBAL CREDIT',
    'HRS ACCOUNT',
    'SUNRISE CREDIT',
    'CREDIT BUREAU',
  ];
  
  for (const indicator of collectionIndicators) {
    if (name.includes(indicator)) {
      return true;
    }
  }
  
  // Known original creditors (NOT collection agencies)
  const originalCreditorPatterns = [
    // Banks
    'CHASE', 'CAPITAL ONE', 'CITI', 'DISCOVER', 'WELLS FARGO', 'BANK OF AMERICA',
    'SYNCHRONY', 'BARCLAYS', 'AMERICAN EXPRESS', 'AMEX', 'US BANK',
    // Credit cards
    'CREDITONE', 'CREDIT ONE', 'CREDITONEBNK',
    // Telecoms
    'VERIZON', 'AT&T', 'T-MOBILE', 'SPRINT', 'COMCAST', 'XFINITY',
    // Retailers
    'MACY', 'MACYS', 'TARGET', 'WALMART', 'AMAZON', 'KOHLS', 'JC PENNEY',
    'BEST BUY', 'HOME DEPOT', 'LOWES',
    // Auto
    'TOYOTA', 'HONDA', 'FORD', 'GM FINANCIAL', 'ALLY', 'SANTANDER',
    // Fintech/Online lenders
    'KIKOFF', 'SELF LENDER', 'CHIME', 'SOFI', 'UPSTART', 'AVANT', 'LENDING CLUB',
    // Utilities
    'ELECTRIC', 'GAS', 'WATER', 'POWER', 'ENERGY', 'UTILITY',
    // Student loans
    'NAVIENT', 'NELNET', 'SALLIE MAE', 'GREAT LAKES', 'MOHELA',
    // Medical (original providers, not collectors)
    'HOSPITAL', 'MEDICAL CENTER', 'CLINIC', 'HEALTH SYSTEM',
  ];
  
  for (const pattern of originalCreditorPatterns) {
    if (name.includes(pattern)) {
      return false; // This is an original creditor, not a collection agency
    }
  }
  
  // Default: if we can't determine, assume it might be original creditor
  // to avoid false claims about missing original creditor info
  return false;
}

/**
 * Analyze multiple negative items and return consolidated analysis
 */
// P3.5: Enhanced function signature to support aggressiveness parameter
export function analyzeNegativeItems(items: AnalyzeItemParams[], round: number = 1, aggressiveness: 'conservative' | 'balanced' | 'aggressive' = 'balanced'): ItemAnalysisResult[] {
  return items.map(item => analyzeNegativeItem(item, round, aggressiveness));
}

/**
 * Get the best overall methodology for a batch of items
 */
export function getBestMethodologyForBatch(analyses: ItemAnalysisResult[]): string {
  // Priority order for methodologies
  const methodologyPriority: Record<string, number> = {
    'method_of_verification': 4,
    'debt_validation': 3,
    'metro2_compliance': 2,
    'factual': 1,
  };

  let bestMethodology = 'factual';
  let highestPriority = 0;

  for (const analysis of analyses) {
    const priority = methodologyPriority[analysis.suggestedMethodology] || 0;
    if (priority > highestPriority) {
      highestPriority = priority;
      bestMethodology = analysis.suggestedMethodology;
    }
  }

  return bestMethodology;
}

/**
 * Consolidate all reason codes from multiple item analyses
 */
export function consolidateReasonCodes(analyses: ItemAnalysisResult[]): string[] {
  const allCodes = analyses.flatMap(a => a.autoReasonCodes);
  return [...new Set(allCodes)];
}

export type { ClientInfo, NegativeItemInfo, GenerateLetterParams, GenerateMultiItemLetterParams };

// ============================================
// METRO 2 STRUCTURED ANALYSIS SYSTEM
// Factual, evidence-based dispute generation
// ============================================

/**
 * Structured negative item data for Metro 2 analysis
 */
export interface Metro2NegativeItem {
  itemId: string;
  bureauName: string;
  furnisherName: string;
  accountNumberMasked?: string;
  accountType: string; // revolving, installment, mortgage, collection
  ownershipType?: string; // individual, joint, authorized_user
  openDate?: string;
  closeDate?: string;
  originalAmount?: number;
  creditLimit?: number;
  currentBalance?: number;
  monthlyPayment?: number;
  accountStatusCode: string; // current, 30, 60, 90, charge_off, collection
  pastDueAmount?: number;
  chargeOffAmount?: number;
  dateOfFirstDelinquency?: string;
  paymentHistory?: Record<string, string>; // { "2024-01": "OK", "2024-02": "30" }
  paymentHistoryGrid?: Record<string, string>;
  specialComments?: string[];
  consumerInformationIndicator?: string;
  complianceConditionCode?: string;
}

/**
 * Issue found during Metro 2 analysis
 */
export interface Metro2Issue {
  issueType: string;
  description: string;
  affectedFields: string[];
  severity: 'high' | 'medium' | 'low';
}

/**
 * Result of analyzing a single item
 */
export interface Metro2AnalysisResult {
  itemId: string;
  issueFound: boolean;
  issueTypes: string[];
  issues: Metro2Issue[];
  explanation: string;
}

/**
 * Full analysis output with letter
 */
export interface Metro2DisputeOutput {
  analysisSummary: Metro2AnalysisResult[];
  disputeLetter: string | null;
  itemsWithIssues: number;
  totalItems: number;
}

// Metro 2 Structured Analysis System Prompt
const METRO2_ANALYSIS_SYSTEM_PROMPT = `You are an AI assistant that helps consumers dispute specific, factual
inaccuracies in their personal credit reports. Your job is to:
(1) analyze each negative item for accuracy and Metro 2®-style reporting issues,
and (2) draft clear, professional dispute letters that point out only
well-supported errors or inconsistencies.

IMPORTANT LEGAL & ETHICAL RULES
--------------------------------
- You are NOT a lawyer. Do NOT give legal advice, do NOT tell the consumer
  what legal actions to take, and do NOT guarantee any outcome.
- Do NOT fabricate, exaggerate, or assume violations. Only state issues you
  can derive directly from:
    • the structured credit report data provided
    • any supporting facts explicitly given by the user.
- If the data does not clearly support a specific inaccuracy or violation,
  you must:
    • either state that no clear inaccuracy can be identified, OR
    • frame the issue as a request for verification rather than an accusation.
- NEVER claim an account "does not belong to me" or "I never opened this account"
  unless the consumer has explicitly confirmed this with documentation.
- Never instruct the furnisher or bureau to take actions beyond what the law
  generally allows (no threats, no demands for compensation).

CRITICAL COMPLIANCE RULES
--------------------------
1. NEVER fabricate ownership denial claims ("not my account", "never authorized")
2. NEVER claim identity theft unless explicitly documented by consumer
3. NEVER assume violations - only cite what you can SEE in the data
4. ALWAYS frame disputes around DATA ACCURACY and VERIFICATION
5. If no clear issue exists, state that and do NOT generate dispute language for that item
6. Do not cite Metro 2 field numbers; use segment and field names only when needed

ANALYSIS CHECKLIST
-------------------
For EACH negative item, check:

1) Balance and amount checks:
   - Does current_balance make sense with reported status?
   - Is balance > 0 on a paid or closed account?
   - Does past_due_amount conflict with status or history?

2) Status and payment history consistency:
   - Does account_status_code align with payment_history grid?
   - Is account marked late/charge-off while history shows OK?
   - Are conflicting statuses?

3) Delinquency timing and obsolescence:
   - Is DOFD consistent with first delinquency in payment history?
   - Has DOFD been moved forward (re-aging)?
   - Is negative info past 7-year window from DOFD?

4) Metro 2-style coding / special indicators:
   - Is account missing dispute indicator when previously disputed?
   - Are special conditions (bankruptcy, settlement) accurate?

5) Duplicate or inconsistent tradelines:
   - Is same debt reported multiple times?
   - Are original creditor AND collector both showing active balances?

Only mark an item as having an issue if you can point to:
- specific fields in the data (dates, balances, statuses), AND
- a clear, logical inconsistency, inaccuracy, or missing information.

OUTPUT FORMAT
--------------
Return a JSON object with this exact structure:
{
  "analysis_summary": [
    {
      "item_id": "string",
      "issue_found": true/false,
      "issue_types": ["wrong_balance", "status_mismatch"],
      "explanation": "Brief explanation citing specific fields"
    }
  ],
  "dispute_letter": "Full letter text if any issues found, or null if no issues"
}

For the dispute_letter (if issues found):
- Write in consumer's voice ("I am writing to dispute...")
- Include consumer identifying info (name, address, SSN last 4, DOB)
- Clearly identify each account with issues
- For EACH issue, cite specific data points (dates, balances, statuses)
- Request investigation and correction/removal if unverifiable
- Be factual, respectful, and specific - no threats or legal advice
- Request a response within 30 days under FCRA

STYLE REQUIREMENTS
-------------------
- Use plain, professional English
- No legal jargon beyond neutral references
- No promises, threats, or guarantees
- Be factual and specific:
    WRONG: "This is illegal and must be deleted immediately."
    RIGHT: "Based on the data provided, the reported balance of $X appears
            inconsistent with the account status showing paid/closed.
            I am requesting investigation and correction or removal if unverifiable."`;

/**
 * Generate a factual Metro 2 dispute letter using structured analysis
 * Only generates letters for items where issues can be PROVEN from the data
 */
export async function generateFactualMetro2DisputeLetter(params: {
  consumerName: string;
  consumerAddress?: string;
  consumerDob?: string;
  consumerSsnLast4?: string;
  recipientType: 'bureau' | 'furnisher';
  recipientName: string;
  bureau: string;
  round: number;
  negativeItems: Metro2NegativeItem[];
  userExplanations?: string;
}): Promise<Metro2DisputeOutput> {
  const llmConfig = await getLLMConfig();
  
  if (!llmConfig.apiKey) {
    logServerEvent({ level: 'warn', event: 'server.lib.ai.letter.generator.warn' });
    return {
      analysisSummary: params.negativeItems.map(item => ({
        itemId: item.itemId,
        issueFound: false,
        issueTypes: [],
        issues: [],
        explanation: 'AI analysis unavailable - API key not configured',
      })),
      disputeLetter: null,
      itemsWithIssues: 0,
      totalItems: params.negativeItems.length,
    };
  }

  try {
    // Build structured data for the AI
    const negativeItemsJson = JSON.stringify(params.negativeItems, null, 2);
    
    const bureauAddress = BUREAU_ADDRESSES[params.bureau.toLowerCase()] || '';
    
    const userPrompt = `Analyze the following credit report data and generate a dispute letter ONLY for
items where you can identify specific, factual issues based on the data provided.

DISPUTE CONTEXT
----------------
Recipient Type: ${params.recipientType}
Recipient Name: ${params.recipientName}
Recipient Address: ${bureauAddress}
Bureau: ${params.bureau.toUpperCase()}
Dispute Round: ${params.round}

CONSUMER PROFILE
-----------------
Full Name: ${params.consumerName}
Address: ${params.consumerAddress || 'On file'}
Date of Birth: ${params.consumerDob || 'On file'}
SSN Last 4: ${params.consumerSsnLast4 || 'On file'}

NEGATIVE ITEMS DATA (STRUCTURED)
---------------------------------
${negativeItemsJson}

USER-PROVIDED CONTEXT
----------------------
${params.userExplanations || 'No additional context provided'}

INSTRUCTIONS
-------------
1. Review ALL negative items using the analysis checklist in the system prompt
2. For each item, determine if there is a clearly supported inaccuracy from the DATA
3. Produce JSON output with:
   (a) analysis_summary - describing issues per item
   (b) dispute_letter - ONE well-structured letter covering all items with CONFIRMED issues

CRITICAL REMINDERS:
- ONLY rely on data provided - do NOT fabricate issues
- If you cannot confirm a specific inaccuracy from the data, mark issue_found=false
- Do NOT generate dispute text for items without confirmed, data-supported issues
- Do NOT claim accounts don't belong to consumer unless explicitly documented
- Focus on DATA ACCURACY and VERIFICATION, not ownership denial
- Each issue must cite specific data fields that show the inconsistency

Return ONLY the JSON object, no markdown formatting.`;

    // Combine system prompt with user prompt
    const fullPrompt = METRO2_ANALYSIS_SYSTEM_PROMPT + '\n\n---\n\n' + userPrompt;
    let responseText = '';

    responseText = await generateWithLLM(fullPrompt, llmConfig, 'json');
    
    responseText = responseText.trim();

    // Parse the JSON response
    const parsedResponse = safeParseJsonObject<{
      analysis_summary: Array<{
        item_id: string;
        issue_found: boolean;
        issue_types: string[];
        explanation: string;
      }>;
      dispute_letter: string | null;
    }>(responseText);

    if (!parsedResponse || !Array.isArray(parsedResponse.analysis_summary)) {
      logServerEvent({ level: 'error', event: 'server.lib.ai.letter.generator.error', error: responseText });
      return {
        analysisSummary: params.negativeItems.map(item => ({
          itemId: item.itemId,
          issueFound: false,
          issueTypes: [],
          issues: [],
          explanation: 'Analysis failed - could not parse AI response',
        })),
        disputeLetter: null,
        itemsWithIssues: 0,
        totalItems: params.negativeItems.length,
      };
    }

    // Transform to our output format
    const analysisSummary: Metro2AnalysisResult[] = parsedResponse.analysis_summary.map(item => ({
      itemId: item.item_id,
      issueFound: item.issue_found,
      issueTypes: item.issue_types || [],
      issues: (item.issue_types || []).map(type => ({
        issueType: type,
        description: item.explanation,
        affectedFields: [],
        severity: 'medium' as const,
      })),
      explanation: item.explanation,
    }));

    const itemsWithIssues = analysisSummary.filter(a => a.issueFound).length;

    // Post-process the letter if it exists
    let disputeLetter = parsedResponse.dispute_letter;
    if (disputeLetter && itemsWithIssues > 0) {
      // Add date if missing
      const currentDate = formatLetterDate();
      if (!disputeLetter.includes(currentDate) && !disputeLetter.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/)) {
        disputeLetter = currentDate + '\n\n' + disputeLetter;
      }
      // Add bureau address if missing
      if (bureauAddress && !disputeLetter.includes(bureauAddress.split('\n')[0])) {
        const lines = disputeLetter.split('\n');
        lines.splice(1, 0, '', bureauAddress);
        disputeLetter = lines.join('\n');
      }
      const lintResult = lintGeneratedLetter(disputeLetter, {
        reasonCodes: ['verification_required'],
        items: params.negativeItems.map(item => ({
          creditorName: item.furnisherName,
          accountNumber: item.accountNumberMasked,
          bureau: params.bureau,
        })),
        identityTheftFlag: false,
      });
      if (lintResult.blocked) {
        return {
          analysisSummary,
          disputeLetter: null,
          itemsWithIssues,
          totalItems: params.negativeItems.length,
        };
      }
    }

    return {
      analysisSummary,
      disputeLetter: itemsWithIssues > 0 ? disputeLetter : null,
      itemsWithIssues,
      totalItems: params.negativeItems.length,
    };

  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.lib.ai.letter.generator.error', error: error });
    return {
      analysisSummary: params.negativeItems.map(item => ({
        itemId: item.itemId,
        issueFound: false,
        issueTypes: [],
        issues: [],
        explanation: `Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })),
      disputeLetter: null,
      itemsWithIssues: 0,
      totalItems: params.negativeItems.length,
    };
  }
}

/**
 * Convert legacy NegativeItem format to Metro2NegativeItem format
 */
export function convertToMetro2Format(item: {
  id: string;
  creditorName: string;
  originalCreditor?: string | null;
  itemType: string;
  amount?: number | null;
  dateReported?: string | null;
  dateOfLastActivity?: string | null;
  dateOfFirstDelinquency?: string | null;
  bureauStatedRemovalDate?: string | null;
  accountNumber?: string | null;
  bureau?: string | null;
  accountStatus?: string | null;
  paymentStatus?: string | null;
  paymentHistory?: Record<string, string>;
  paymentHistoryGrid?: Record<string, string>;
}, bureau: string): Metro2NegativeItem {
  const obsolescenceClock = getObsolescenceClock({
    bureauStatedRemovalDate: item.bureauStatedRemovalDate,
    dateOfFirstDelinquency: item.dateOfFirstDelinquency,
    dateOfLastActivity: item.dateOfLastActivity,
    dateReported: item.dateReported,
  });

  const dateOfFirstDelinquency =
    obsolescenceClock.confidence === 'dofd' || obsolescenceClock.confidence === 'last_activity'
      ? item.dateOfFirstDelinquency || item.dateOfLastActivity || undefined
      : undefined;

  return {
    itemId: item.id,
    bureauName: bureau,
    furnisherName: item.creditorName,
    accountNumberMasked: item.accountNumber || undefined,
    accountType: item.itemType,
    currentBalance: item.amount ?? undefined,
    accountStatusCode: item.accountStatus || item.paymentStatus || 'unknown',
    dateOfFirstDelinquency,
    paymentHistory: item.paymentHistory || item.paymentHistoryGrid,
  };
}
