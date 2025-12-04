import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  loadPromptConfig,
  getMethodology,
  getBureauConfig,
  buildLegalCitationsString,
  getAllReasonCodesFlat,
  type PromptConfig,
} from './dispute-config-loader';

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

interface GenerateLetterParams {
  disputeType: string;
  round: number;
  targetRecipient: 'bureau' | 'creditor' | 'collector' | 'furnisher';
  clientData: ClientInfo;
  itemData: NegativeItemInfo;
  reasonCodes: string[];
  customReason?: string;
  methodology?: string; // NEW: Methodology selection
  metro2Violations?: string[]; // NEW: Specific Metro 2 field violations
  priorDisputeDate?: string; // NEW: For method of verification letters
  priorDisputeResult?: string; // NEW: Result of prior dispute
}

const BUREAU_ADDRESSES: Record<string, string> = {
  transunion: `TransUnion Consumer Solutions
P.O. Box 2000
Chester, PA 19016-2000`,
  experian: `Experian
P.O. Box 4500
Allen, TX 75013`,
  equifax: `Equifax Information Services LLC
P.O. Box 740256
Atlanta, GA 30374-0256`,
};

const REASON_CODE_DESCRIPTIONS: Record<string, string> = {
  // === FACTUAL/METRO 2 COMPLIANCE REASON CODES (USE THESE BY DEFAULT) ===
  unverified_account: 'I am requesting verification of this account under FCRA Section 611. The furnisher must provide documented proof that this information is complete and accurate per Metro 2 reporting standards.',
  inaccurate_reporting: 'The information being reported contains inaccuracies that do not reflect the true status of this account. I am disputing the accuracy of this data under FCRA Section 623.',
  incomplete_data: 'This account is being reported with incomplete information, missing required Metro 2 data fields necessary for accurate credit reporting.',
  metro2_violation: 'This account contains Metro 2 format compliance violations. The reported data does not meet the "maximum possible accuracy" standard required under FCRA Section 607(b).',
  missing_dofd: 'This derogatory account lacks the required Date of First Delinquency (DOFD) field. Per FCRA Section 605 and Metro 2 requirements, DOFD is mandatory for calculating the 7-year reporting period.',
  status_inconsistency: 'The Account Status Code is inconsistent with the Payment Rating and payment history pattern. This internal data inconsistency violates Metro 2 format requirements.',
  balance_discrepancy: 'The reported balance information is inaccurate or inconsistent with other account data fields. This discrepancy indicates a data integrity failure.',
  verification_required: 'I am demanding documented verification of this account information. Under FCRA Section 611, you must conduct a reasonable investigation and verify all data fields with the original furnisher.',
  
  // === LEGACY CODES (ONLY USE WHEN CLIENT SPECIFICALLY CONFIRMS) ===
  not_mine: 'This account does not belong to me. I have never opened, authorized, or used this account.',
  never_late: 'The reported late payment history is inaccurate. I have always made payments on time for this account.',
  wrong_balance: 'The reported balance and/or payment amounts are incorrect and do not reflect accurate account information.',
  closed_by_consumer: 'This account was closed at my request, but it is being reported incorrectly.',
  obsolete: 'This information is obsolete and has exceeded the 7-year reporting period mandated by law.',
  duplicate: 'This account appears multiple times on my credit report, which is a duplicate entry.',
  paid_collection: 'This collection account has been paid in full but is still being reported as unpaid.',
  identity_theft: 'This account was opened fraudulently as a result of identity theft.',
  wrong_status: 'The account status being reported is inaccurate and requires verification.',
  wrong_dates: 'The dates associated with this account are being reported incorrectly and require verification.',
  mixed_file: 'This account belongs to another consumer and has been incorrectly placed on my file.',
  unauthorized_inquiry: 'This inquiry was made without my authorization or permissible purpose.',
};

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatItemType(type: string): string {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function buildMetro2ViolationsSection(violations?: string[]): string {
  if (!violations || violations.length === 0) return '';
  const uniqueViolations = [...new Set(violations.filter(Boolean))];
  if (uniqueViolations.length === 0) return '';
  return [
    'Metro 2 violations identified:',
    ...uniqueViolations.map(v => `- ${v}`),
  ].join('\n');
}

function getReasonDescriptions(reasonCodes: string[]): string {
  return reasonCodes
    .map(code => REASON_CODE_DESCRIPTIONS[code] || code)
    .join(' Additionally, ');
}

function buildComplianceContext(targetRecipient: string, round: number): string {
  const fcraRights = `
FAIR CREDIT REPORTING ACT (FCRA) VIOLATIONS:
- Section 611 (15 U.S.C. § 1681i): You must conduct a reasonable investigation within 30 days
- Section 623 (15 U.S.C. § 1681s-2): Furnishers must report accurate information
- Section 609 (15 U.S.C. § 1681g): Consumer's right to disclosure of information
- Section 605 (15 U.S.C. § 1681c): Obsolete information must not be reported after 7 years`;

  const metro2Standards = `
METRO 2 FORMAT COMPLIANCE VIOLATIONS:
- Data furnishers must report complete and accurate information in Metro 2 format
- Account status codes, payment ratings, and balance information must be verified
- Failure to maintain Metro 2 compliance constitutes willful non-compliance`;

  const crsaRights = `
CREDIT REPAIR SERVICES ACT (CRSA) & CONSUMER PROTECTIONS:
- Consumers have the right to dispute inaccurate information
- Credit bureaus cannot report unverifiable information
- Failure to delete unverifiable items constitutes a violation`;

  let context = fcraRights;
  
  if (targetRecipient === 'bureau') {
    context += '\n' + metro2Standards;
  }
  
  if (round >= 2) {
    context += '\n' + crsaRights;
    context += `
    
ESCALATION NOTICE:
This is Round ${round} of my dispute. Previous investigations have failed to properly verify this information.
Continued reporting of unverifiable information may constitute willful non-compliance, exposing you to
statutory damages of $100-$1,000 per violation, plus punitive damages under 15 U.S.C. § 1681n.`;
  }

  return context;
}

const AI_PROMPT_TEMPLATE = `You are a credit repair specialist writing a formal dispute letter based on METRO 2 COMPLIANCE and FCRA VERIFICATION requirements.

CRITICAL COMPLIANCE RULES - YOU MUST FOLLOW THESE:
===============================================
1. NEVER claim "this account does not belong to me" or "I never opened this account" - this is FRAUDULENT if untrue
2. NEVER claim the consumer "never authorized" or "never used" the account unless explicitly stated in the reason
3. NEVER claim identity theft or fraud unless the reason explicitly mentions identity theft
4. Focus ONLY on: verification requirements, data accuracy, Metro 2 compliance violations
5. The dispute is about DATA ACCURACY and VERIFICATION, not account ownership

WHAT THIS LETTER MUST DO:
========================
- Request VERIFICATION of the account data under FCRA Section 611
- Challenge the ACCURACY and COMPLETENESS of reported information
- Cite Metro 2 format compliance requirements
- Demand documented proof that information meets "maximum possible accuracy" standard
- Request deletion of UNVERIFIED information (not "fraudulent" information)

1. WRITING STYLE:
- Write at a 12th grade reading level
- Professional and assertive, like a knowledgeable consumer exercising legal rights
- Avoid AI-generated patterns and repetitive phrases
- Sound like a consumer demanding their legal rights to accurate credit reporting

2. LEGAL FRAMEWORK:
{compliance_context}

3. KEY DISPUTE APPROACH (Metro 2 Compliance Based):
- The consumer is DISPUTING THE ACCURACY of the reported information
- The consumer is REQUESTING VERIFICATION with documented proof
- The consumer is challenging whether data meets FCRA Section 607(b) "maximum possible accuracy"
- The consumer demands deletion if information CANNOT BE VERIFIED with documentation
- DO NOT claim the accounts are fraudulent or don't belong to the consumer

4. LETTER DETAILS:
- Target Recipient: {target_recipient}
- Dispute Round: {round}
- Client Name: {client_name}
- Creditor/Account: {creditor_name}
- Account Number: {account_number}
- Item Type: {item_type}
- Amount: {amount}
- Bureau: {bureau}
- Dispute Basis: {reason_description}
{custom_reason}
- Metro 2 Findings:
{metro2_violations}

5. REQUIRED STRUCTURE:
- Current date and recipient address
- Subject: "FCRA Section 611 Dispute - Request for Verification and Deletion"
- Opening: State this is a formal dispute requesting verification under FCRA
- Account Details: List the account(s) being disputed
- Dispute Basis: Explain you are challenging accuracy/completeness, requesting verification
- Metro 2 Requirements: Reference that furnishers must report in Metro 2 format with complete data
- Legal Demands: Request verification, documentation of investigation method, deletion if unverified
- 30-day deadline per FCRA Section 611(a)(1)
- Warning about statutory damages for willful non-compliance
- Signature block

REMEMBER: This is a VERIFICATION dispute, NOT a fraud/identity theft dispute. The consumer is exercising their FCRA right to demand proof that reported information is accurate and complete.

Generate the dispute letter now. Output plain text only - no markdown.`;

export async function generateUniqueDisputeLetter(params: GenerateLetterParams): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  // If methodology is specified, use the new YAML-based system
  if (params.methodology) {
    return generateMethodologyBasedLetter(params);
  }
  
  if (!apiKey) {
    console.warn('GOOGLE_AI_API_KEY not set, falling back to template-based letter');
    return generateFallbackLetter(params);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const complianceContext = buildComplianceContext(params.targetRecipient, params.round);
    const reasonDescription = getReasonDescriptions(params.reasonCodes);
    const metro2Section = buildMetro2ViolationsSection(params.metro2Violations);
    
    const prompt = AI_PROMPT_TEMPLATE
      .replace('{compliance_context}', complianceContext)
      .replace('{target_recipient}', params.targetRecipient.toUpperCase())
      .replace('{round}', params.round.toString())
      .replace('{client_name}', params.clientData.name)
      .replace('{creditor_name}', params.itemData.creditorName)
      .replace('{account_number}', params.itemData.accountNumber ? `****${params.itemData.accountNumber.slice(-4)}` : 'Not Available')
      .replace('{item_type}', formatItemType(params.itemData.itemType))
      .replace('{amount}', params.itemData.amount ? formatCurrency(params.itemData.amount) : 'Not Specified')
      .replace('{bureau}', params.itemData.bureau.toUpperCase())
      .replace('{reason_description}', reasonDescription)
      .replace('{custom_reason}', params.customReason ? `- Additional Context: ${params.customReason}` : '')
      .replace('{metro2_violations}', metro2Section || 'No specific Metro 2 violations provided; verify all Metro 2 fields for accuracy.');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const letterText = response.text();

    // Post-process to ensure proper formatting
    return postProcessLetter(letterText, params);
  } catch (error) {
    console.error('AI letter generation failed:', error);
    return generateFallbackLetter(params);
  }
}

// NEW: Generate letter using YAML-based methodology configuration
async function generateMethodologyBasedLetter(params: GenerateLetterParams): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const methodology = params.methodology || 'factual';
  
  // Load methodology-specific prompt config
  const promptConfig = loadPromptConfig(methodology);
  const methodologyConfig = getMethodology(methodology);
  const bureauConfig = getBureauConfig(params.itemData.bureau);
  
  if (!apiKey) {
    console.warn('GOOGLE_AI_API_KEY not set, falling back to template-based letter');
    return generateFallbackLetter(params);
  }
  
  if (!promptConfig || !methodologyConfig) {
    console.warn(`Config not found for methodology: ${methodology}, using default`);
    return generateFallbackLetter(params);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Build the prompt using YAML configuration
    const prompt = buildMethodologyPrompt(params, promptConfig, methodologyConfig, bureauConfig);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const letterText = response.text();

    return postProcessLetter(letterText, params);
  } catch (error) {
    console.error('Methodology-based letter generation failed:', error);
    return generateFallbackLetter(params);
  }
}

// Build prompt using YAML configuration
function buildMethodologyPrompt(
  params: GenerateLetterParams,
  promptConfig: PromptConfig,
  methodologyConfig: ReturnType<typeof getMethodology>,
  bureauConfig: ReturnType<typeof getBureauConfig>
): string {
  const reasonDescription = getReasonDescriptions(params.reasonCodes);
  const legalCitations = buildLegalCitationsString(params.methodology || 'factual');
  const metro2ViolationsSection = buildMetro2ViolationsSection(params.metro2Violations);
  
  // Get round-specific variation if available
  let roundContext = '';
  if (promptConfig.round_variations && promptConfig.round_variations[`round_${params.round}`]) {
    const variation = promptConfig.round_variations[`round_${params.round}`];
    roundContext = variation.additional_context;
  }
  
  // Get target-specific variation if available
  let targetContext = '';
  if (promptConfig.target_variations && promptConfig.target_variations[params.targetRecipient]) {
    const variation = promptConfig.target_variations[params.targetRecipient];
    targetContext = `Opening approach: ${variation.opening}\nLegal focus: ${variation.legal_focus.join(', ')}`;
  }
  
  // Build account details string
  const accountDetails = `
Creditor Name: ${params.itemData.creditorName}
${params.itemData.originalCreditor ? `Original Creditor: ${params.itemData.originalCreditor}` : ''}
${params.itemData.accountNumber ? `Account Number: ****${params.itemData.accountNumber.slice(-4)}` : ''}
Item Type: ${formatItemType(params.itemData.itemType)}
${params.itemData.amount ? `Amount: ${formatCurrency(params.itemData.amount)}` : ''}
  ${params.itemData.dateReported ? `Date Reported: ${new Date(params.itemData.dateReported).toLocaleDateString()}` : ''}
Bureau: ${params.itemData.bureau.toUpperCase()}
`.trim();

  // Build prior dispute section for method of verification
  let priorDisputeSection = '';
  if (params.priorDisputeDate) {
    priorDisputeSection = `
## PRIOR DISPUTE DETAILS
- Prior Dispute Date: ${params.priorDisputeDate}
- Prior Result: ${params.priorDisputeResult || 'Verified without documentation'}
`;
  }

  // Build client address
  const clientAddress = params.clientData.address 
    ? `${params.clientData.address}\n${params.clientData.city}, ${params.clientData.state} ${params.clientData.zip}`
    : 'Address on file';

  const templateIncludesViolationSlot = promptConfig.prompt_template.includes('{metro2_violations}') 
    || promptConfig.prompt_template.includes('{violation_descriptions}');

  let promptTemplate = promptConfig.prompt_template
    .replace('{legal_citations}', legalCitations)
    .replace('{target_recipient}', params.targetRecipient.toUpperCase())
    .replace('{bureau}', params.itemData.bureau.toUpperCase())
    .replace('{bureau_or_creditor}', params.targetRecipient === 'bureau' ? params.itemData.bureau : params.itemData.creditorName)
    .replace('{round}', params.round.toString())
    .replace('{client_name}', params.clientData.name)
    .replace('{client_address}', clientAddress)
    .replace('{client_state}', params.clientData.state || 'State')
    .replace('{account_details}', accountDetails)
    .replace('{reason_descriptions}', reasonDescription)
    .replace('{reason_description}', reasonDescription)
    .replace('{violation_descriptions}', metro2ViolationsSection || 'See reason codes above')
    .replace('{metro2_violations}', metro2ViolationsSection || 'See reason codes above')
    .replace('{custom_reason}', params.customReason ? `Additional Context: ${params.customReason}` : '')
    .replace('{prior_dispute_details}', priorDisputeSection)
    .replace('{prior_dispute_date}', params.priorDisputeDate || 'Previous dispute')
    .replace('{prior_result}', params.priorDisputeResult || 'Verified');

  // If the template doesn't surface Metro 2 violations, append them so they appear in the final letter
  if (metro2ViolationsSection && !templateIncludesViolationSlot) {
    promptTemplate += `\n\n${metro2ViolationsSection}`;
  }

  // Combine system context with prompt template
  const fullPrompt = `
${promptConfig.system_context}

## WRITING GUIDELINES
Tone: ${promptConfig.writing_guidelines.tone}
Reading Level: ${promptConfig.writing_guidelines.reading_level}
Avoid: ${promptConfig.writing_guidelines.avoid.join(', ')}
Include: ${promptConfig.writing_guidelines.include.join(', ')}

${roundContext ? `## ROUND-SPECIFIC INSTRUCTIONS\n${roundContext}\n` : ''}
${targetContext ? `## TARGET-SPECIFIC APPROACH\n${targetContext}\n` : ''}

${promptTemplate}

${bureauConfig ? `
## BUREAU-SPECIFIC REQUIREMENTS FOR ${bureauConfig.name.toUpperCase()}
Address: ${bureauConfig.address}
Requirements: ${bureauConfig.specific_requirements.join('; ')}
` : ''}

Generate a unique, professional dispute letter now. Output plain text only - no markdown formatting.
`.trim();

  return fullPrompt;
}

function postProcessLetter(letter: string, params: GenerateLetterParams): string {
  // Ensure the letter has proper date if missing
  const currentDate = formatDate();
  if (!letter.includes(currentDate) && !letter.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/)) {
    letter = currentDate + '\n\n' + letter;
  }

  // Ensure bureau address is included for bureau disputes
  if (params.targetRecipient === 'bureau') {
    const bureauAddress = BUREAU_ADDRESSES[params.itemData.bureau.toLowerCase()];
    if (bureauAddress && !letter.includes(bureauAddress.split('\n')[0])) {
      const dateMatch = letter.match(/^.*?\d{4}/);
      if (dateMatch) {
        letter = letter.replace(dateMatch[0], dateMatch[0] + '\n\n' + bureauAddress);
      }
    }
  }

  return letter.trim();
}

function generateFallbackLetter(params: GenerateLetterParams): string {
  const currentDate = formatDate();
  const reasonDescription = getReasonDescriptions(params.reasonCodes);
  const complianceContext = buildComplianceContext(params.targetRecipient, params.round);
  const metro2Section = buildMetro2ViolationsSection(params.metro2Violations);
  
  let recipientAddress = '';
  if (params.targetRecipient === 'bureau') {
    recipientAddress = BUREAU_ADDRESSES[params.itemData.bureau.toLowerCase()] || BUREAU_ADDRESSES.transunion;
  } else {
    recipientAddress = `${params.itemData.creditorName}\nCredit Dispute Department`;
  }

  return `${currentDate}

${recipientAddress}

Re: FORMAL DISPUTE - DEMAND FOR DELETION
Account: ${params.itemData.creditorName}
${params.itemData.accountNumber ? `Account Number: ****${params.itemData.accountNumber.slice(-4)}` : ''}
Dispute Round: ${params.round}

To Whom It May Concern:

I am writing to formally dispute the following account appearing on my credit report. After careful review of my credit file, I have identified information that is inaccurate, unverifiable, and in violation of federal reporting standards. I am demanding the COMPLETE DELETION of this account from my credit report.

DISPUTED ACCOUNT INFORMATION:
Creditor Name: ${params.itemData.creditorName}
${params.itemData.originalCreditor ? `Original Creditor: ${params.itemData.originalCreditor}` : ''}
${params.itemData.accountNumber ? `Account Number: ****${params.itemData.accountNumber.slice(-4)}` : ''}
Item Type: ${formatItemType(params.itemData.itemType)}
${params.itemData.amount ? `Reported Amount: ${formatCurrency(params.itemData.amount)}` : ''}
${params.itemData.dateReported ? `Date Reported: ${new Date(params.itemData.dateReported).toLocaleDateString()}` : ''}

REASON FOR DISPUTE:
${reasonDescription}

${params.customReason ? `Additional Information: ${params.customReason}` : ''}

${metro2Section ? `${metro2Section}\n` : ''}

LEGAL BASIS FOR DELETION:
${complianceContext}

DEMAND FOR ACTION:
Pursuant to my rights under the Fair Credit Reporting Act, I am demanding that you:

1. Conduct a thorough and reasonable investigation of this disputed information
2. Contact the original data furnisher to verify the accuracy and completeness of this account
3. Provide me with documentation of your investigation method and findings
4. DELETE this account in its entirety if it cannot be fully verified with documentation

I am NOT requesting a simple "correction" or "update" to this account. The information is fundamentally inaccurate and unverifiable, and I am demanding its complete removal from my credit file.

You have 30 days from receipt of this letter to complete your investigation and respond in writing. Failure to investigate and respond within this timeframe, or continued reporting of unverifiable information, may result in legal action for willful non-compliance under 15 U.S.C. § 1681n, which provides for statutory damages of $100-$1,000 per violation plus punitive damages.

I expect a written response detailing the results of your investigation and confirmation of deletion.

Sincerely,

${params.clientData.name}
${params.clientData.address ? params.clientData.address : ''}
${params.clientData.city && params.clientData.state && params.clientData.zip ? `${params.clientData.city}, ${params.clientData.state} ${params.clientData.zip}` : ''}

Enclosures:
- Copy of identification
- Proof of address`;
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
  targetRecipient: 'bureau' | 'creditor' | 'collector' | 'furnisher';
  clientData: ClientInfo;
  items: NegativeItemInfo[];
  bureau: string;
  reasonCodes: string[];
  customReason?: string;
  methodology?: string; // Methodology selection
  metro2Violations?: string[]; // Specific Metro 2 field violations to cite in letter
}

const MULTI_ITEM_AI_PROMPT_TEMPLATE = `You are a credit repair specialist writing a formal dispute letter for MULTIPLE accounts based on METRO 2 COMPLIANCE and FCRA VERIFICATION requirements.

CRITICAL COMPLIANCE RULES - YOU MUST FOLLOW THESE:
===============================================
1. NEVER claim "this account does not belong to me" or "I never opened this account" - this is FRAUDULENT if untrue
2. NEVER claim the consumer "never authorized" or "never used" any account unless explicitly stated in the reason
3. NEVER claim identity theft or fraud unless the reason explicitly mentions identity theft
4. Focus ONLY on: verification requirements, data accuracy, Metro 2 compliance violations
5. The dispute is about DATA ACCURACY and VERIFICATION, not account ownership
6. Each account's dispute reason should focus on VERIFICATION, not ownership denial

WHAT THIS LETTER MUST DO:
========================
- Request VERIFICATION of ALL account data under FCRA Section 611
- Challenge the ACCURACY and COMPLETENESS of reported information for each account
- Cite Metro 2 format compliance requirements
- Demand documented proof that ALL information meets "maximum possible accuracy" standard
- Request deletion of ANY information that CANNOT BE VERIFIED with documentation

1. WRITING STYLE:
- Write at a 12th grade reading level
- Professional and assertive, like a knowledgeable consumer exercising legal rights
- Avoid AI-generated patterns and repetitive phrases
- Sound like a consumer demanding their legal rights to accurate credit reporting

2. LEGAL FRAMEWORK:
{compliance_context}

3. KEY DISPUTE APPROACH (Metro 2 Compliance Based):
- The consumer is DISPUTING THE ACCURACY of the reported information
- The consumer is REQUESTING VERIFICATION with documented proof for ALL accounts
- The consumer is challenging whether data meets FCRA Section 607(b) "maximum possible accuracy"
- The consumer demands deletion of ANY account that CANNOT BE VERIFIED with documentation
- DO NOT claim any accounts are fraudulent or don't belong to the consumer

4. LETTER DETAILS:
- Target Recipient: {target_recipient}
- Dispute Round: {round}
- Client Name: {client_name}
- Bureau: {bureau}
- Number of Accounts to Dispute: {item_count}
- Dispute Basis: {reason_description}
{custom_reason}

5. ACCOUNTS REQUIRING VERIFICATION:
{items_list}

Metro 2 violations from analysis (cite these explicitly in the letter):
{metro2_violations}

For EACH account listed above, the dispute basis is:
- Requesting documented verification that data is accurate and complete
- Challenging Metro 2 format compliance for this tradeline
- Demanding proof that information meets FCRA "maximum possible accuracy" standard

6. REQUIRED STRUCTURE:
- Current date and recipient address
- Subject: "FCRA Section 611 Dispute - Request for Verification of Multiple Accounts"
- Opening: State this is a formal dispute requesting verification of {item_count} accounts under FCRA
- Account List: List ALL accounts being disputed with their details
- Dispute Basis: For EACH account, state you are challenging accuracy/completeness and requesting verification
- Metro 2 Requirements: Reference that furnishers must report in Metro 2 format with complete, verified data
- Legal Demands: Request verification, documentation of investigation method, deletion of ANY unverified accounts
- 30-day deadline per FCRA Section 611(a)(1)
- Warning about statutory damages for willful non-compliance
- Signature block

CRITICAL REMINDER: This is a VERIFICATION dispute, NOT a fraud/identity theft dispute. For EACH account, the consumer is demanding proof that the reported information is accurate and verifiable. DO NOT claim any account "does not belong" to the consumer.

Generate the dispute letter now. Output plain text only - no markdown.`;

export async function generateMultiItemDisputeLetter(params: GenerateMultiItemLetterParams): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    console.warn('GOOGLE_AI_API_KEY not set, falling back to template-based letter');
    return generateMultiItemFallbackLetter(params);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const complianceContext = buildComplianceContext(params.targetRecipient, params.round);
    const reasonDescription = getReasonDescriptions(params.reasonCodes);
    const metro2Section = buildMetro2ViolationsSection(params.metro2Violations);
    
    // Build items list for the prompt
    const itemsList = params.items.map((item, index) => `
Account ${index + 1}:
- Creditor: ${item.creditorName}
${item.originalCreditor ? `- Original Creditor: ${item.originalCreditor}` : ''}
${item.accountNumber ? `- Account Number: ****${item.accountNumber.slice(-4)}` : ''}
- Type: ${formatItemType(item.itemType)}
${item.amount ? `- Amount: ${formatCurrency(item.amount)}` : ''}
${item.dateReported ? `- Date Reported: ${new Date(item.dateReported).toLocaleDateString()}` : ''}`).join('\n');

    const prompt = MULTI_ITEM_AI_PROMPT_TEMPLATE
      .replace('{compliance_context}', complianceContext)
      .replace('{target_recipient}', params.targetRecipient.toUpperCase())
      .replace('{round}', params.round.toString())
      .replace('{client_name}', params.clientData.name)
      .replace('{bureau}', params.bureau.toUpperCase())
      .replace('{item_count}', params.items.length.toString())
      .replace('{reason_description}', reasonDescription)
      .replace('{metro2_violations}', metro2Section || 'No specific Metro 2 violations provided; verify all Metro 2 fields for each item.')
      .replace('{custom_reason}', params.customReason ? `- Additional Context: ${params.customReason}` : '')
      .replace('{items_list}', itemsList);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const letterText = response.text();

    return postProcessMultiItemLetter(letterText, params);
  } catch (error) {
    console.error('AI multi-item letter generation failed:', error);
    return generateMultiItemFallbackLetter(params);
  }
}

function postProcessMultiItemLetter(letter: string, params: GenerateMultiItemLetterParams): string {
  const currentDate = formatDate();
  if (!letter.includes(currentDate) && !letter.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/)) {
    letter = currentDate + '\n\n' + letter;
  }

  if (params.targetRecipient === 'bureau') {
    const bureauAddress = BUREAU_ADDRESSES[params.bureau.toLowerCase()];
    if (bureauAddress && !letter.includes(bureauAddress.split('\n')[0])) {
      const dateMatch = letter.match(/^.*?\d{4}/);
      if (dateMatch) {
        letter = letter.replace(dateMatch[0], dateMatch[0] + '\n\n' + bureauAddress);
      }
    }
  }

  return letter.trim();
}

function generateMultiItemFallbackLetter(params: GenerateMultiItemLetterParams): string {
  const currentDate = formatDate();
  const reasonDescription = getReasonDescriptions(params.reasonCodes);
  const complianceContext = buildComplianceContext(params.targetRecipient, params.round);
  const metro2Section = buildMetro2ViolationsSection(params.metro2Violations);
  
  let recipientAddress = '';
  if (params.targetRecipient === 'bureau') {
    recipientAddress = BUREAU_ADDRESSES[params.bureau.toLowerCase()] || BUREAU_ADDRESSES.transunion;
  } else {
    recipientAddress = `Credit Dispute Department`;
  }

  const itemsSection = params.items.map((item, index) => `
ACCOUNT ${index + 1}:
Creditor Name: ${item.creditorName}
${item.originalCreditor ? `Original Creditor: ${item.originalCreditor}` : ''}
${item.accountNumber ? `Account Number: ****${item.accountNumber.slice(-4)}` : ''}
Item Type: ${formatItemType(item.itemType)}
${item.amount ? `Reported Amount: ${formatCurrency(item.amount)}` : ''}
${item.dateReported ? `Date Reported: ${new Date(item.dateReported).toLocaleDateString()}` : ''}`).join('\n');

  const creditorList = params.items.map(item => item.creditorName).join(', ');

  return `${currentDate}

${recipientAddress}

Re: FORMAL DISPUTE - DEMAND FOR DELETION OF MULTIPLE ACCOUNTS
Disputed Accounts: ${creditorList}
Number of Accounts: ${params.items.length}
Dispute Round: ${params.round}

To Whom It May Concern:

I am writing to formally dispute the following ${params.items.length} account(s) appearing on my credit report. After careful review of my credit file, I have identified information that is inaccurate, unverifiable, and in violation of federal reporting standards. I am demanding the COMPLETE DELETION of ALL listed accounts from my credit report.

DISPUTED ACCOUNTS:
${itemsSection}

REASON FOR DISPUTE (APPLIES TO ALL ACCOUNTS):
${reasonDescription}

${params.customReason ? `Additional Information: ${params.customReason}` : ''}

${metro2Section ? `${metro2Section}\n` : ''}

LEGAL BASIS FOR DELETION:
${complianceContext}

DEMAND FOR ACTION:
Pursuant to my rights under the Fair Credit Reporting Act, I am demanding that you:

1. Conduct a thorough and reasonable investigation of ALL ${params.items.length} disputed accounts
2. Contact the original data furnishers to verify the accuracy and completeness of each account
3. Provide me with documentation of your investigation method and findings for each account
4. DELETE ALL accounts listed above in their entirety if they cannot be fully verified with documentation

I am NOT requesting simple "corrections" or "updates" to these accounts. The information is fundamentally inaccurate and unverifiable, and I am demanding the complete removal of ALL ${params.items.length} accounts from my credit file.

You have 30 days from receipt of this letter to complete your investigation and respond in writing regarding ALL disputed accounts. Failure to investigate and respond within this timeframe, or continued reporting of unverifiable information, may result in legal action for willful non-compliance under 15 U.S.C. § 1681n, which provides for statutory damages of $100-$1,000 PER VIOLATION plus punitive damages.

I expect a written response detailing the results of your investigation and confirmation of deletion for each disputed account.

Sincerely,

${params.clientData.name}
${params.clientData.address ? params.clientData.address : ''}
${params.clientData.city && params.clientData.state && params.clientData.zip ? `${params.clientData.city}, ${params.clientData.state} ${params.clientData.zip}` : ''}

Enclosures:
- Copy of identification
- Proof of address`;
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
  bureau?: string | null;
  riskSeverity?: string | null;
  accountStatus?: string | null;
  paymentStatus?: string | null;
}

/**
 * Analyze a negative item and auto-determine the best dispute strategy
 * 
 * IMPORTANT: This function only cites violations/issues that can be PROVEN from the data.
 * It does NOT assume or fabricate violations based on item type.
 * 
 * The analysis focuses on:
 * 1. FCRA reporting limits (7-year, 10-year) - can be calculated from dates
 * 2. Actual missing data fields (if we can see the field is empty)
 * 3. Verification requests (always valid under FCRA 611)
 * 
 * It does NOT fabricate:
 * - "Missing original creditor" unless we know it's a third-party collector
 * - Specific Metro 2 field violations unless we have evidence
 * - Data inconsistencies unless we can actually see conflicting data
 */
export function analyzeNegativeItem(item: AnalyzeItemParams, round: number = 1): ItemAnalysisResult {
  const reasonCodes: string[] = [];
  const metro2Violations: string[] = [];
  const fcraIssues: string[] = [];
  let methodology = 'factual';
  let confidence = 0.5; // Start with baseline confidence - only increase with provable issues
  const notes: string[] = [];

  const itemType = item.itemType?.toLowerCase() || '';
  const now = new Date();

  // ============================================
  // FACTUAL CHECKS - Only cite what we can PROVE
  // ============================================

  // ---- FCRA 7-Year / 10-Year Limit Check (FACTUAL) ----
  // This is a factual check we can calculate from dates
  if (item.dateReported || item.dateOfLastActivity) {
    const reportDate = new Date(item.dateReported || item.dateOfLastActivity || '');
    const yearsSinceReport = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    
    // Different limits for different item types
    const isChapter7Bankruptcy = itemType === 'bankruptcy';
    const reportingLimit = isChapter7Bankruptcy ? 10 : 7;
    
    if (yearsSinceReport >= reportingLimit) {
      reasonCodes.push('obsolete');
      fcraIssues.push(`FCRA § 605(a): This item has exceeded the ${reportingLimit}-year reporting limit and should be removed`);
      notes.push(`Item is ${Math.floor(yearsSinceReport)} years old - past FCRA reporting limit`);
      metro2Violations.push(`Item exceeds FCRA ${reportingLimit}-year reporting limit (reported ${reportDate.toLocaleDateString()})`);
      confidence = 0.95; // High confidence - this is provable
    } else if (yearsSinceReport >= (reportingLimit - 1)) {
      notes.push(`Item is ${Math.floor(yearsSinceReport)} years old - approaching ${reportingLimit}-year limit`);
      fcraIssues.push(`Item nearing FCRA expiration (${Math.ceil(reportingLimit - yearsSinceReport)} months remaining)`);
    }
    
    // For inquiries - 2 year limit
    if (itemType === 'inquiry' && yearsSinceReport >= 2) {
      reasonCodes.push('obsolete');
      fcraIssues.push('FCRA § 605(a)(3): Hard inquiry exceeds 2-year reporting limit');
      metro2Violations.push(`Hard inquiry exceeds 2-year limit (reported ${reportDate.toLocaleDateString()})`);
      confidence = 0.9;
    }
  }

  // ---- Third-Party Collection Agency Check (FACTUAL) ----
  // Only flag "missing original creditor" for ACTUAL third-party collectors
  // NOT for original creditors reporting their own accounts
  const isThirdPartyCollector = itemType === 'collection' && isLikelyCollectionAgency(item.creditorName);
  
  if (isThirdPartyCollector && !item.originalCreditor) {
    // This is a third-party collector without original creditor info - this IS a valid issue
    metro2Violations.push('Third-party collection account is missing Original Creditor Name (Metro 2 Field 24)');
    reasonCodes.push('incomplete_data');
    fcraIssues.push('FCRA § 623(a)(2): Debt collectors must identify the original creditor');
    notes.push('Collection agency account missing original creditor information');
    confidence += 0.15;
  }

  // ---- Methodology Selection Based on Item Type ----
  // This is about strategy, not claiming violations
  switch (itemType) {
    case 'collection':
      methodology = round === 1 ? 'debt_validation' : 'method_of_verification';
      reasonCodes.push('verification_required');
      notes.push('Collection account - verification of debt ownership and accuracy required');
      break;

    case 'charge_off':
      methodology = 'factual';
      reasonCodes.push('verification_required');
      notes.push('Charge-off account - verification of balance and status accuracy required');
      break;

    case 'late_payment':
      methodology = 'factual';
      reasonCodes.push('verification_required');
      notes.push('Late payment record - verification of payment history accuracy required');
      break;

    case 'repossession':
      methodology = 'factual';
      reasonCodes.push('verification_required');
      notes.push('Repossession record - verification of dates and deficiency balance required');
      break;

    case 'foreclosure':
      methodology = 'factual';
      reasonCodes.push('verification_required');
      notes.push('Foreclosure record - verification of dates and completion status required');
      break;

    case 'bankruptcy':
      methodology = 'factual';
      reasonCodes.push('verification_required');
      notes.push('Bankruptcy record - verification of discharge status required');
      break;

    case 'judgment':
    case 'tax_lien':
      methodology = 'consumer_law';
      reasonCodes.push('verification_required');
      fcraIssues.push('FCRA § 611: Public records require verification procedures');
      notes.push('Public record - strict verification procedures required');
      break;

    case 'inquiry':
      methodology = 'factual';
      reasonCodes.push('verification_required');
      fcraIssues.push('FCRA § 604: Permissible purpose must be documented');
      notes.push('Inquiry - permissible purpose documentation required');
      break;

    default:
      methodology = 'factual';
      reasonCodes.push('verification_required');
      notes.push('Verification of account data accuracy required');
  }

  // ---- Round-Based Escalation ----
  if (round >= 2) {
    methodology = 'method_of_verification';
    notes.push(`Round ${round}: Requesting method of verification from prior investigation`);
    fcraIssues.push('FCRA § 611(a)(6)(B)(iii): Consumer entitled to method of verification');
  }

  if (round >= 3) {
    methodology = 'consumer_law';
    notes.push('Round 3+: Prior investigations may constitute inadequate reinvestigation');
    fcraIssues.push('Potential willful non-compliance under 15 U.S.C. § 1681n');
    confidence += 0.1;
  }

  // ---- Ensure verification request is always included ----
  if (!reasonCodes.includes('verification_required')) {
    reasonCodes.push('verification_required');
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
    confidence: Math.min(confidence, 1),
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
 * - Companies with "collection" in name
 * - Companies with "recovery" in name
 * - Known collection agencies (Midland, Portfolio, etc.)
 */
function isLikelyCollectionAgency(creditorName: string): boolean {
  if (!creditorName) return false;
  
  const name = creditorName.toUpperCase();
  
  // Known collection agency indicators
  const collectionIndicators = [
    'COLLECTION',
    'COLLECTIONS',
    'RECOVERY',
    'RECOVERIES',
    'DEBT',
    'RECEIVABLES',
    'ASSET ACCEPTANCE',
    'MIDLAND',
    'PORTFOLIO',
    'CONVERGENT',
    'IC SYSTEM',
    'NCO FINANCIAL',
    'TRANSWORLD',
    'ALLIED INTERSTATE',
    'AFNI',
    'AMSHER',
    'CREDIT MANAGEMENT',
    'CREDIT BUREAU',
    'CBCS',
    'ERC',
    'ENHANCED RECOVERY',
    'FMS',
    'GC SERVICES',
    'GLOBAL CREDIT',
    'HALSTED FINANCIAL',
    'HRS ACCOUNT',
    'JEFFERSON CAPITAL',
    'LVNV',
    'MEDICREDIT',
    'NATIONAL CREDIT',
    'NATIONAL ENTERPRISE',
    'NORTHLAND',
    'PENDRICK',
    'PHOENIX FINANCIAL',
    'RADIUS GLOBAL',
    'RESURGENT',
    'SECOND ROUND',
    'SUNRISE CREDIT',
    'WAKEFIELD',
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
export function analyzeNegativeItems(items: AnalyzeItemParams[], round: number = 1): ItemAnalysisResult[] {
  return items.map(item => analyzeNegativeItem(item, round));
}

/**
 * Get the best overall methodology for a batch of items
 */
export function getBestMethodologyForBatch(analyses: ItemAnalysisResult[]): string {
  // Priority order for methodologies
  const methodologyPriority: Record<string, number> = {
    'consumer_law': 5,
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
  accountNumberMasked: string;
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
   - Are there conflicting statuses?

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
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    console.warn('GOOGLE_AI_API_KEY not set');
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
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent, factual output
      },
    });

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
    
    const result = await model.generateContent(fullPrompt);

    const response = await result.response;
    let responseText = response.text();
    
    // Clean up response - remove markdown code blocks if present
    responseText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse the JSON response
    let parsedResponse: {
      analysis_summary: Array<{
        item_id: string;
        issue_found: boolean;
        issue_types: string[];
        explanation: string;
      }>;
      dispute_letter: string | null;
    };

    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse AI response as JSON:', responseText);
      // Return fallback
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
      const currentDate = formatDate();
      if (!disputeLetter.includes(currentDate) && !disputeLetter.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/)) {
        disputeLetter = currentDate + '\n\n' + disputeLetter;
      }
      // Add bureau address if missing
      if (bureauAddress && !disputeLetter.includes(bureauAddress.split('\n')[0])) {
        const lines = disputeLetter.split('\n');
        lines.splice(1, 0, '', bureauAddress);
        disputeLetter = lines.join('\n');
      }
    }

    return {
      analysisSummary,
      disputeLetter: itemsWithIssues > 0 ? disputeLetter : null,
      itemsWithIssues,
      totalItems: params.negativeItems.length,
    };

  } catch (error) {
    console.error('Metro 2 analysis failed:', error);
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
  bureau?: string | null;
  accountStatus?: string | null;
  paymentStatus?: string | null;
}, bureau: string): Metro2NegativeItem {
  return {
    itemId: item.id,
    bureauName: bureau,
    furnisherName: item.creditorName,
    accountNumberMasked: `****${item.id.slice(-4)}`,
    accountType: mapItemTypeToAccountType(item.itemType),
    accountStatusCode: item.accountStatus || item.paymentStatus || 'unknown',
    currentBalance: item.amount || undefined,
    dateOfFirstDelinquency: item.dateReported || item.dateOfLastActivity || undefined,
  };
}

function mapItemTypeToAccountType(itemType: string): string {
  const mapping: Record<string, string> = {
    collection: 'collection',
    charge_off: 'charge_off',
    late_payment: 'revolving',
    repossession: 'installment',
    foreclosure: 'mortgage',
    bankruptcy: 'bankruptcy',
    judgment: 'public_record',
    tax_lien: 'public_record',
    inquiry: 'inquiry',
  };
  return mapping[itemType.toLowerCase()] || 'unknown';
}
