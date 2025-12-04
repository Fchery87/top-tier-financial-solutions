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

const AI_PROMPT_TEMPLATE = `You are a credit repair specialist writing a formal dispute letter. Your task is to generate a unique, professional dispute letter that:

1. WRITING STYLE:
- Write at a 12th grade reading level
- Use natural, human language that doesn't appear AI-generated
- Vary sentence structure and vocabulary
- Sound professional but assertive, like a knowledgeable consumer
- Avoid repetitive phrases or robotic language

2. LEGAL FRAMEWORK - Include these compliance standards:
{compliance_context}

3. KEY REQUIREMENTS:
- DEMAND FULL DELETION of the disputed account(s), NOT just correction
- Assert consumer rights under FCRA, CRSA, and Metro 2 standards
- Highlight specific violations of reporting standards
- Be firm but professional in tone
- Include specific account details provided

4. LETTER DETAILS:
- Target Recipient: {target_recipient}
- Dispute Round: {round}
- Client Name: {client_name}
- Creditor/Account: {creditor_name}
- Account Number: {account_number}
- Item Type: {item_type}
- Amount: {amount}
- Bureau: {bureau}
- Reason for Dispute: {reason_description}
{custom_reason}

5. STRUCTURE:
- Current date and recipient address
- Clear subject line with account reference
- Opening paragraph stating the dispute
- Middle paragraphs with specific violations and legal citations
- Demand for deletion (not correction)
- Deadline for response (30 days per FCRA)
- Closing with signature block

Generate a unique dispute letter now. Do not include any markdown formatting or code blocks - output only the plain text letter.`;

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
      .replace('{custom_reason}', params.customReason ? `- Additional Context: ${params.customReason}` : '');

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

  // Build Metro 2 violations section if applicable
  let metro2ViolationsSection = '';
  if (params.metro2Violations && params.metro2Violations.length > 0) {
    metro2ViolationsSection = `
## METRO 2 VIOLATIONS IDENTIFIED
${params.metro2Violations.join('\n')}
`;
  }

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

${promptConfig.prompt_template
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
  .replace('{metro2_violations}', metro2ViolationsSection)
  .replace('{custom_reason}', params.customReason ? `Additional Context: ${params.customReason}` : '')
  .replace('{prior_dispute_details}', priorDisputeSection)
  .replace('{prior_dispute_date}', params.priorDisputeDate || 'Previous dispute')
  .replace('{prior_result}', params.priorDisputeResult || 'Verified')
}

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
  methodology?: string; // NEW: Methodology selection
}

const MULTI_ITEM_AI_PROMPT_TEMPLATE = `You are a credit repair specialist writing a formal dispute letter. Your task is to generate a unique, professional dispute letter that disputes MULTIPLE accounts in a single letter to one bureau.

1. WRITING STYLE:
- Write at a 12th grade reading level
- Use natural, human language that doesn't appear AI-generated
- Vary sentence structure and vocabulary
- Sound professional but assertive, like a knowledgeable consumer
- Avoid repetitive phrases or robotic language

2. LEGAL FRAMEWORK - Include these compliance standards:
{compliance_context}

3. KEY REQUIREMENTS:
- DISPUTE ALL LISTED ACCOUNTS IN ONE LETTER
- DEMAND FULL DELETION of ALL disputed accounts, NOT just correction
- Assert consumer rights under FCRA, CRSA, and Metro 2 standards
- Highlight specific violations of reporting standards for each account
- Be firm but professional in tone
- List each account with specific details in a clear format

4. LETTER DETAILS:
- Target Recipient: {target_recipient}
- Dispute Round: {round}
- Client Name: {client_name}
- Bureau: {bureau}
- Number of Accounts to Dispute: {item_count}
- Reason for Dispute: {reason_description}
{custom_reason}

5. ACCOUNTS TO DISPUTE:
{items_list}

6. STRUCTURE:
- Current date and recipient address
- Clear subject line mentioning "Multiple Accounts Dispute"
- Opening paragraph stating the dispute covers multiple accounts
- Section listing ALL disputed accounts with their details
- Middle paragraphs with specific violations and legal citations applicable to all accounts
- Demand for deletion of ALL listed accounts (not correction)
- Deadline for response (30 days per FCRA)
- Closing with signature block

Generate a unique dispute letter now. Do not include any markdown formatting or code blocks - output only the plain text letter.`;

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
 * Uses Metro 2 compliance knowledge to identify violations and recommend approach
 */
export function analyzeNegativeItem(item: AnalyzeItemParams, round: number = 1): ItemAnalysisResult {
  const reasonCodes: string[] = [];
  const metro2Violations: string[] = [];
  const fcraIssues: string[] = [];
  let methodology = 'factual';
  let confidence = 0.7; // Base confidence
  const notes: string[] = [];

  const itemType = item.itemType?.toLowerCase() || '';
  const now = new Date();

  // ---- FCRA 7-Year Check ----
  if (item.dateReported || item.dateOfLastActivity) {
    const reportDate = new Date(item.dateReported || item.dateOfLastActivity || '');
    const yearsSinceReport = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    
    if (yearsSinceReport >= 7) {
      reasonCodes.push('obsolete');
      fcraIssues.push('FCRA § 605(a): Item exceeds 7-year reporting limit');
      notes.push('Item is past FCRA reporting limit - strong deletion candidate');
      confidence = 0.95;
    } else if (yearsSinceReport >= 6) {
      notes.push('Item approaching 7-year limit - may fall off soon');
      fcraIssues.push('Item nearing FCRA expiration');
    }
  }

  // ---- Item Type Specific Analysis ----
  // IMPORTANT: Use factual Metro 2 compliance-based reason codes, NOT ownership denial
  // Only use 'not_mine' or 'identity_theft' when client explicitly confirms fraud/mixed file
  switch (itemType) {
    case 'collection':
      // Collections: Challenge verification and Metro 2 compliance
      if (round === 1) {
        methodology = 'debt_validation';
        reasonCodes.push('verification_required', 'incomplete_data');
        metro2Violations.push('Metro 2 Field 17A: Account status code must be verified with documentation');
        metro2Violations.push('Metro 2 Field 24: Original creditor information required for proper verification');
        metro2Violations.push('Metro 2 Field 8: Date of First Delinquency (DOFD) must be accurately reported');
        notes.push('Collection accounts require full debt validation and Metro 2 compliance verification under FDCPA');
        
        if (!item.originalCreditor) {
          metro2Violations.push('Missing original creditor name - Metro 2 compliance violation (Field 24)');
          reasonCodes.push('missing_dofd');
          confidence += 0.1;
        }
      } else {
        methodology = 'method_of_verification';
        reasonCodes.push('verification_required', 'metro2_violation');
        notes.push('Round 2+: Demanding method of verification and documented proof');
      }
      break;

    case 'charge_off':
      methodology = 'metro2_compliance';
      reasonCodes.push('metro2_violation', 'balance_discrepancy', 'status_inconsistency');
      metro2Violations.push('Metro 2 Field 17A: Charge-off status code (82) verification required');
      metro2Violations.push('Metro 2 Field 10: Balance must accurately reflect charge-off amount');
      metro2Violations.push('Metro 2 Field 8: Date of First Delinquency required for charge-offs');
      notes.push('Charge-offs require verification of Metro 2 status codes and balance accuracy');
      break;

    case 'late_payment':
      methodology = 'factual';
      reasonCodes.push('inaccurate_reporting', 'status_inconsistency');
      metro2Violations.push('Metro 2 Fields 25-36: Payment history pattern requires verification');
      metro2Violations.push('Metro 2 Field 8: Date of first delinquency must be accurate');
      metro2Violations.push('Metro 2 Payment Rating: Must accurately reflect account status');
      notes.push('Payment history disputes focus on Metro 2 data accuracy and verification');
      break;

    case 'repossession':
      methodology = 'metro2_compliance';
      reasonCodes.push('metro2_violation', 'balance_discrepancy', 'verification_required');
      metro2Violations.push('Metro 2 Field 17A: Repossession status code (96) verification');
      metro2Violations.push('Metro 2 Field 10: Deficiency balance must be accurately calculated');
      metro2Violations.push('Metro 2 Field 9: Date of repossession accuracy required');
      notes.push('Repossession records require accurate deficiency balance and status verification');
      break;

    case 'foreclosure':
      methodology = 'metro2_compliance';
      reasonCodes.push('metro2_violation', 'verification_required', 'status_inconsistency');
      metro2Violations.push('Metro 2 Field 17A: Foreclosure status code (94) verification');
      metro2Violations.push('Metro 2 Field 9: Foreclosure completion date accuracy');
      metro2Violations.push('Metro 2 Field 8: DOFD required for 7-year calculation');
      fcraIssues.push('FCRA § 605(a)(4): Foreclosure 7-year limit from completion date');
      notes.push('Foreclosure records require verification of dates and Metro 2 compliance');
      break;

    case 'bankruptcy':
      // Bankruptcy has 10-year limit
      if (item.dateReported) {
        const reportDate = new Date(item.dateReported);
        const yearsSince = (now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (yearsSince >= 10) {
          reasonCodes.push('obsolete');
          fcraIssues.push('FCRA § 605(a)(1): Bankruptcy exceeds 10-year limit');
          confidence = 0.95;
        }
      }
      reasonCodes.push('verification_required', 'status_inconsistency');
      metro2Violations.push('Metro 2 Field 38: Bankruptcy disposition code must be verified');
      metro2Violations.push('Metro 2 Field 17A: Account status must reflect bankruptcy discharge');
      notes.push('Bankruptcy record requires verification of disposition and discharge status');
      break;

    case 'judgment':
    case 'tax_lien':
      methodology = 'consumer_law';
      reasonCodes.push('verification_required', 'inaccurate_reporting');
      fcraIssues.push('Public record accuracy requirements under FCRA § 605(a)');
      fcraIssues.push('FCRA § 611: Reasonable investigation required for public records');
      notes.push('Public records require strict verification and accuracy procedures');
      break;

    case 'inquiry':
      methodology = 'factual';
      reasonCodes.push('verification_required');
      fcraIssues.push('FCRA § 604: Permissible purpose must be documented');
      notes.push('Hard inquiries require documented permissible purpose verification');
      
      // Check if inquiry is older than 2 years
      if (item.dateReported) {
        const inquiryDate = new Date(item.dateReported);
        const yearsSince = (now.getTime() - inquiryDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (yearsSince >= 2) {
          reasonCodes.push('obsolete');
          fcraIssues.push('Inquiry exceeds 2-year reporting limit');
          confidence = 0.9;
        }
      }
      break;

    default:
      // Default: Use factual Metro 2 compliance-based disputes
      // NEVER default to 'not_mine' - that's a specific claim requiring client confirmation
      reasonCodes.push('verification_required', 'inaccurate_reporting');
      metro2Violations.push('Metro 2 Field 17A: Account status code verification required');
      metro2Violations.push('Metro 2 compliance: All data fields require documented verification');
      notes.push('Requesting verification of account data and Metro 2 compliance');
  }

  // ---- Round-Based Methodology Adjustment ----
  if (round >= 2 && methodology !== 'debt_validation') {
    methodology = 'method_of_verification';
    notes.push(`Round ${round}: Escalating to method of verification demand`);
    fcraIssues.push('Prior dispute verified without documentation - demanding verification method');
  }

  if (round >= 3) {
    methodology = 'consumer_law';
    notes.push('Round 3+: Citing potential willful non-compliance');
    fcraIssues.push('15 U.S.C. § 1681n: Willful non-compliance - statutory damages');
  }

  // ---- Balance/Amount Analysis ----
  if (item.amount && item.amount > 0) {
    if (!reasonCodes.includes('wrong_balance')) {
      // Check for suspiciously round numbers (often estimated, not actual)
      if (item.amount % 100 === 0 && item.amount > 500) {
        metro2Violations.push('Metro 2 Field 10: Balance appears estimated, not actual');
        notes.push('Round dollar amount suggests estimated balance');
      }
    }
  }

  // ---- Ensure minimum reason codes ----
  // Use factual Metro 2 compliance codes, NEVER default to ownership denial
  if (reasonCodes.length === 0) {
    reasonCodes.push('verification_required', 'inaccurate_reporting');
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
