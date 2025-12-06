import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import {
  loadPromptConfig,
  getMethodology,
  getBureauConfig,
  buildLegalCitationsString,
  type PromptConfig,
} from './dispute-config-loader';
import { getLLMConfig, type LLMConfig } from './settings-service';

// Multi-provider LLM generation helper
async function generateWithLLM(prompt: string, config: LLMConfig): Promise<string> {
  switch (config.provider) {
    case 'google': {
      const genAI = new GoogleGenerativeAI(config.apiKey!);
      const model = genAI.getGenerativeModel({ 
        model: config.model,
        generationConfig: {
          temperature: config.temperature || 0.1,
          maxOutputTokens: config.maxTokens || 4096,
        },
      });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    }
    
    case 'openai': {
      const openai = new OpenAI({ apiKey: config.apiKey });
      const response = await openai.chat.completions.create({
        model: config.model || 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature || 0.1,
        max_tokens: config.maxTokens || 4096,
      });
      return response.choices[0]?.message?.content || '';
    }
    
    case 'anthropic': {
      const anthropic = new Anthropic({ apiKey: config.apiKey });
      const response = await anthropic.messages.create({
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: config.maxTokens || 4096,
        messages: [{ role: 'user', content: prompt }],
      });
      const textBlock = response.content.find(block => block.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : '';
    }
    
    case 'zhipu': {
      // Zhipu AI (Z.ai / GLM) - OpenAI-compatible API
      const openai = new OpenAI({ 
        apiKey: config.apiKey,
        baseURL: config.apiEndpoint || 'https://api.z.ai/api/paas/v4',
      });
      const response = await openai.chat.completions.create({
        model: config.model || 'glm-4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature || 0.1,
        max_tokens: config.maxTokens || 4096,
      });
      return response.choices[0]?.message?.content || '';
    }
    
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
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
  targetRecipient: 'bureau' | 'creditor' | 'collector' | 'furnisher';
  clientData: ClientInfo;
  itemData: NegativeItemInfo;
  reasonCodes: string[];
  customReason?: string;
  methodology?: string;
  metro2Violations?: string[];
  priorDisputeDate?: string;
  priorDisputeResult?: string;
  enclosures?: EvidenceEnclosure[];
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

function buildEnclosuresSection(enclosures?: EvidenceEnclosure[]): string {
  if (!enclosures || enclosures.length === 0) {
    return `Enclosures:
- Copy of government-issued identification
- Proof of current address`;
  }
  
  const enclosureLines = enclosures.map(e => `- ${e.documentName || e.documentType}`);
  // Always include ID and proof of address as standard enclosures
  const hasId = enclosures.some(e => e.documentType === 'id_document');
  const hasProof = enclosures.some(e => e.documentType === 'proof_of_address');
  
  if (!hasId) enclosureLines.unshift('- Copy of government-issued identification');
  if (!hasProof) enclosureLines.splice(hasId ? 1 : 2, 0, '- Proof of current address');
  
  return `Enclosures:\n${enclosureLines.join('\n')}`;
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
    ...uniqueViolations.map((v, i) => `${i + 1}. ${v}`),
    '',
    '=== END OF VIOLATIONS - CITE ALL OF THESE IN YOUR LETTER ===',
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

CRITICAL: CITE METRO 2 VIOLATIONS IN THE LETTER BODY
=====================================================
You MUST explicitly reference each Metro 2 violation provided below in the letter.
DO NOT just list them - INTEGRATE them into your dispute explanation.
For each violation, explain HOW it demonstrates inaccuracy or non-compliance.
Example: "The account reports a balance of $XXX while showing a status of 'paid' - this data
inconsistency violates Metro 2 reporting standards for Field 17 (Account Status) and Field 8 (Balance)."

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
  // Get LLM configuration from database (with fallback to env vars)
  const llmConfig = await getLLMConfig();
  
  // If methodology is specified, use the new YAML-based system
  if (params.methodology) {
    return generateMethodologyBasedLetter(params);
  }
  
  if (!llmConfig.apiKey) {
    console.warn('No LLM API key configured, falling back to template-based letter');
    return generateFallbackLetter(params);
  }

  try {
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
      .replace('{metro2_violations}', metro2Section || 'IMPORTANT: No specific Metro 2 violations were provided by the AI analysis.\nRequest general verification of all Metro 2 data fields for accuracy and completeness.\nFocus on requesting documented proof of accuracy under FCRA Section 611.');

    // Use multi-provider helper
    const letterText = await generateWithLLM(prompt, llmConfig);

    // Post-process to ensure proper formatting
    return postProcessLetter(letterText, params);
  } catch (error) {
    console.error('AI letter generation failed:', error);
    return generateFallbackLetter(params);
  }
}

// NEW: Generate letter using YAML-based methodology configuration
async function generateMethodologyBasedLetter(params: GenerateLetterParams): Promise<string> {
  const llmConfig = await getLLMConfig();
  const methodology = params.methodology || 'factual';
  
  // Load methodology-specific prompt config
  const promptConfig = loadPromptConfig(methodology);
  const methodologyConfig = getMethodology(methodology);
  const bureauConfig = getBureauConfig(params.itemData.bureau);
  
  if (!llmConfig.apiKey) {
    console.warn('No LLM API key configured, falling back to template-based letter');
    return generateFallbackLetter(params);
  }
  
  if (!promptConfig || !methodologyConfig) {
    console.warn(`Config not found for methodology: ${methodology}, using default`);
    return generateFallbackLetter(params);
  }

  try {
    // Build the prompt using YAML configuration
    const prompt = buildMethodologyPrompt(params, promptConfig, methodologyConfig, bureauConfig);

    // Use multi-provider helper
    const letterText = await generateWithLLM(prompt, llmConfig);

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
  // Add them prominently to ensure the AI cites them
  if (metro2ViolationsSection && !templateIncludesViolationSlot) {
    promptTemplate += `\n\n!!! CRITICAL - CITE THESE VIOLATIONS IN YOUR LETTER !!!\n${metro2ViolationsSection}`;
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
  const metro2ViolationsRaw = params.metro2Violations && params.metro2Violations.length > 0 
    ? params.metro2Violations.filter(Boolean) 
    : [];
  
  let recipientAddress = '';
  if (params.targetRecipient === 'bureau') {
    recipientAddress = BUREAU_ADDRESSES[params.itemData.bureau.toLowerCase()] || BUREAU_ADDRESSES.transunion;
  } else {
    recipientAddress = `${params.itemData.creditorName}\nCredit Dispute Department`;
  }

  // Build Metro 2 violations section for fallback letter (simpler format)
  let metro2ViolationsText = '';
  if (metro2ViolationsRaw.length > 0) {
    metro2ViolationsText = `\nSPECIFIC METRO 2 COMPLIANCE VIOLATIONS IDENTIFIED:\n${metro2ViolationsRaw.map((v, i) => `${i + 1}. ${v}`).join('\n')}\n\nThese violations demonstrate that the reported information does not meet the "maximum possible accuracy" standard required under FCRA Section 607(b) and Metro 2 format requirements.`;
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
${metro2ViolationsText}

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

${buildEnclosuresSection(params.enclosures)}`;
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
  methodology?: string;
  metro2Violations?: string[];
  enclosures?: EvidenceEnclosure[];
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

CRITICAL: CITE METRO 2 VIOLATIONS IN THE LETTER BODY
=====================================================
You MUST explicitly reference each Metro 2 violation provided below in the letter.
DO NOT just list them in a separate section - INTEGRATE them into your dispute explanation.
For EACH account, if specific violations are identified, explain HOW those violations demonstrate
inaccuracy or non-compliance with Metro 2 reporting standards.
Example: "Account #1 (XYZ Bank) reports a balance of $XXX while showing a 'closed' status, which
violates Metro 2 Field 8 (Balance) reporting requirements - closed accounts must show $0 balance."

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
  const llmConfig = await getLLMConfig();
  
  if (!llmConfig.apiKey) {
    console.warn('No LLM API key configured, falling back to template-based letter');
    return generateMultiItemFallbackLetter(params);
  }

  try {
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
      .replace('{metro2_violations}', metro2Section || 'IMPORTANT: No specific Metro 2 violations were provided by the AI analysis.\nFor each account, request general verification of all Metro 2 data fields for accuracy and completeness.\nFocus on requesting documented proof of accuracy under FCRA Section 611 for ALL disputed accounts.')
      .replace('{custom_reason}', params.customReason ? `- Additional Context: ${params.customReason}` : '')
      .replace('{items_list}', itemsList);

    // Use multi-provider helper
    const letterText = await generateWithLLM(prompt, llmConfig);

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
  const metro2ViolationsRaw = params.metro2Violations && params.metro2Violations.length > 0 
    ? params.metro2Violations.filter(Boolean) 
    : [];
  
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

  // Build Metro 2 violations section for fallback letter
  let metro2ViolationsText = '';
  if (metro2ViolationsRaw.length > 0) {
    metro2ViolationsText = `\nSPECIFIC METRO 2 COMPLIANCE VIOLATIONS IDENTIFIED:\nThe following Metro 2 format violations apply to one or more of the disputed accounts:\n\n${metro2ViolationsRaw.map((v, i) => `${i + 1}. ${v}`).join('\n')}\n\nThese violations demonstrate that the reported information does not meet the "maximum possible accuracy" standard required under FCRA Section 607(b) and Metro 2 format requirements.`;
  }

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
${metro2ViolationsText}

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
  bureau?: string | null;
  riskSeverity?: string | null;
  // Metro 2 relevant fields from credit account
  accountStatus?: string | null; // 'open' | 'closed' | 'collection' | 'charge_off' | 'paid'
  accountType?: string | null; // 'credit_card' | 'auto_loan' | 'mortgage' | 'collection' | etc.
  currentBalance?: number | null;
  creditLimit?: number | null;
  highCredit?: number | null;
  pastDueAmount?: number | null;
  paymentStatus?: string | null; // 'current' | '30_days_late' | '60_days_late' | etc.
  dateOpened?: string | null;
  remarks?: string | null;
}

/**
 * Analyze a negative item using Metro 2 compliance checklist
 * 
 * This function performs FACTUAL analysis based on the Metro 2 data categories:
 * 1. Balance and amount checks - balance vs status consistency
 * 2. Status and payment history consistency - status code vs payment pattern
 * 3. Delinquency timing and obsolescence - DOFD accuracy, 7-year limits
 * 4. Third-party collector issues - missing original creditor for debt buyers
 * 5. Data completeness - required fields that are missing
 * 
 * IMPORTANT: Only flags issues that can be PROVEN from the actual data provided.
 * Does NOT fabricate or assume violations.
 */
export function analyzeNegativeItem(item: AnalyzeItemParams, round: number = 1): ItemAnalysisResult {
  const reasonCodes: string[] = [];
  const metro2Violations: string[] = [];
  const fcraIssues: string[] = [];
  let methodology = 'factual';
  let confidence = 0.5; // Baseline - increases with each provable issue found
  const notes: string[] = [];

  const itemType = item.itemType?.toLowerCase() || '';
  const accountStatus = item.accountStatus?.toLowerCase() || '';
  const paymentStatus = item.paymentStatus?.toLowerCase() || '';
  const now = new Date();

  // ============================================
  // METRO 2 ANALYSIS CHECKLIST - Evidence-Based
  // ============================================

  // ---- CHECK 1: Balance and Amount Consistency ----
  // Look for: balance > 0 on paid/closed account, balance inconsistent with status
  
  const hasBalance = item.currentBalance !== null && item.currentBalance !== undefined && item.currentBalance > 0;
  const amount = item.amount || item.currentBalance || 0;
  
  // Balance > $0 on account marked as paid or closed
  if (hasBalance && (accountStatus === 'paid' || accountStatus === 'closed')) {
    const balanceAmount = item.currentBalance! / 100; // Convert cents to dollars
    metro2Violations.push(`Balance of $${balanceAmount.toFixed(2)} reported on account with status "${accountStatus}" - balance should be $0`);
    reasonCodes.push('balance_discrepancy');
    notes.push(`Account shows ${accountStatus} status but reports non-zero balance`);
    confidence += 0.2;
  }

  // Past due amount on current account
  if (item.pastDueAmount && item.pastDueAmount > 0 && paymentStatus === 'current') {
    const pastDue = item.pastDueAmount / 100;
    metro2Violations.push(`Past due amount of $${pastDue.toFixed(2)} reported while payment status shows "current"`);
    reasonCodes.push('status_inconsistency');
    notes.push('Past due amount conflicts with current payment status');
    confidence += 0.15;
  }

  // ---- CHECK 2: Status and Payment History Consistency ----
  // Look for: status code doesn't match payment pattern

  // Charge-off status but payment status shows current
  if ((itemType === 'charge_off' || accountStatus === 'charge_off') && paymentStatus === 'current') {
    metro2Violations.push('Account status shows "charge-off" but payment status indicates "current" - these statuses are inconsistent');
    reasonCodes.push('status_inconsistency');
    notes.push('Charge-off status conflicts with current payment status');
    confidence += 0.2;
  }

  // Collection status but account shows as open/current
  if (itemType === 'collection' && accountStatus === 'open' && paymentStatus === 'current') {
    metro2Violations.push('Item type is "collection" but account shows as open with current payment status - status codes are inconsistent');
    reasonCodes.push('status_inconsistency');
    notes.push('Collection item type conflicts with open/current account status');
    confidence += 0.15;
  }

  // Late payment item type but payment status shows current (and no delinquency info)
  if (itemType === 'late_payment' && paymentStatus === 'current' && !item.pastDueAmount) {
    metro2Violations.push('Item flagged as "late payment" but payment status shows "current" with no past due amount');
    reasonCodes.push('status_inconsistency');
    notes.push('Late payment designation conflicts with current payment status');
    confidence += 0.15;
  }

  // ---- CHECK 3: Delinquency Timing and Obsolescence ----
  // Look for: FCRA time limits exceeded, potential re-aging
  
  const reportDate = item.dateReported ? new Date(item.dateReported) : null;
  const lastActivityDate = item.dateOfLastActivity ? new Date(item.dateOfLastActivity) : null;
  const openedDate = item.dateOpened ? new Date(item.dateOpened) : null;
  const effectiveDate = lastActivityDate || reportDate;

  if (effectiveDate) {
    const yearsSinceActivity = (now.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    
    // FCRA 7-year limit for most negative items
    const isBankruptcy = itemType === 'bankruptcy';
    const reportingLimit = isBankruptcy ? 10 : 7;
    
    if (yearsSinceActivity >= reportingLimit) {
      metro2Violations.push(`This ${itemType} has been reporting for ${Math.floor(yearsSinceActivity)} years - exceeds FCRA ${reportingLimit}-year limit (last activity: ${effectiveDate.toLocaleDateString()})`);
      fcraIssues.push(`FCRA § 605(a): Negative information exceeds ${reportingLimit}-year reporting limit`);
      reasonCodes.push('obsolete');
      notes.push(`Item is ${Math.floor(yearsSinceActivity)} years old - past FCRA reporting limit`);
      confidence = 0.95; // Very high confidence - this is a clear FCRA violation
    } else if (yearsSinceActivity >= (reportingLimit - 1)) {
      notes.push(`Item is ${Math.floor(yearsSinceActivity)} years old - approaching ${reportingLimit}-year limit`);
    }

    // Inquiry 2-year limit
    if (itemType === 'inquiry' && yearsSinceActivity >= 2) {
      metro2Violations.push(`Hard inquiry from ${effectiveDate.toLocaleDateString()} exceeds 2-year reporting limit`);
      fcraIssues.push('FCRA § 605(a)(3): Hard inquiries must be removed after 2 years');
      reasonCodes.push('obsolete');
      confidence = 0.9;
    }
  }

  // Potential re-aging check: if reported date is much newer than date opened for a derogatory account
  if (openedDate && reportDate && (itemType === 'collection' || itemType === 'charge_off')) {
    const yearsBetween = (reportDate.getTime() - openedDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (yearsBetween > 2) {
      // Account reported much later than opened - could indicate re-aging or sold debt
      notes.push(`Account opened ${openedDate.toLocaleDateString()} but reported ${reportDate.toLocaleDateString()} - ${Math.floor(yearsBetween)} year gap may require DOFD verification`);
    }
  }

  // ---- CHECK 4: Third-Party Collection Agency ----
  // Only flag missing original creditor for ACTUAL third-party collectors
  
  const isThirdPartyCollector = itemType === 'collection' && isLikelyCollectionAgency(item.creditorName);
  
  if (isThirdPartyCollector && !item.originalCreditor) {
    metro2Violations.push(`Third-party collection agency "${item.creditorName}" is not reporting Original Creditor Name (Metro 2 Field 24) - required for debt validation`);
    fcraIssues.push('FCRA § 623(a)(2): Debt collectors must identify the original creditor upon request');
    reasonCodes.push('incomplete_data');
    notes.push('Collection agency account missing required original creditor information');
    confidence += 0.2;
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

  // ---- ROUND-BASED ESCALATION ----
  if (round >= 2) {
    methodology = 'method_of_verification';
    fcraIssues.push('FCRA § 611(a)(6)(B)(iii): Consumer entitled to description of method of verification');
    notes.push(`Round ${round}: Requesting method of verification from prior investigation`);
  }

  if (round >= 3) {
    methodology = 'consumer_law';
    fcraIssues.push('15 U.S.C. § 1681n: Potential willful non-compliance if adequate investigation not conducted');
    notes.push('Round 3+: Prior investigations may have been inadequate');
    confidence += 0.1;
  }

  // ---- SUMMARY ----
  // If we found specific issues, confidence should be higher
  // If only generic verification request, confidence is lower
  
  const hasSpecificIssues = metro2Violations.length > 0;
  if (!hasSpecificIssues && confidence < 0.6) {
    // No specific issues found - this is just a verification request
    notes.unshift('No specific data inconsistencies identified - requesting general verification');
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
  const llmConfig = await getLLMConfig();
  
  if (!llmConfig.apiKey) {
    console.warn('No LLM API key configured');
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
    if (llmConfig.provider !== 'google') {
      console.warn(`Provider "${llmConfig.provider}" not yet supported for Metro2 analysis`);
      return {
        analysisSummary: params.negativeItems.map(item => ({
          itemId: item.itemId,
          issueFound: false,
          issueTypes: [],
          issues: [],
          explanation: 'AI analysis unavailable - provider not supported',
        })),
        disputeLetter: null,
        itemsWithIssues: 0,
        totalItems: params.negativeItems.length,
      };
    }

    const genAI = new GoogleGenerativeAI(llmConfig.apiKey);
    const model = genAI.getGenerativeModel({ 
      model: llmConfig.model,
      generationConfig: {
        temperature: llmConfig.temperature || 0.1,
        maxOutputTokens: llmConfig.maxTokens || 4096,
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
