import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Check if running in serverless environment (no file system access)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.CLOUDFLARE_WORKER;

// Type definitions for dispute configuration
export interface LegalCitation {
  section: string;
  code: string;
  description: string;
}

export interface EscalationTriggers {
  verified?: string;
  updated?: string;
  no_response?: string;
  deleted?: string | null;
  no_documentation?: string;
  no_validation?: string;
  validated?: string;
  denied?: string;
  approved?: string | null;
}

export interface Metro2Field {
  field: string;
  codes?: string[];
  format?: string;
  description: string;
  requirement?: string;
}

export interface Methodology {
  name: string;
  description: string;
  round_range: number[];
  target_recipients: string[];
  best_for: string[];
  legal_citations: {
    primary: LegalCitation[];
    secondary?: LegalCitation[];
  };
  escalation_triggers: EscalationTriggers;
  success_indicators?: string[];
  metro2_fields?: {
    base_segment: Metro2Field[];
    k_segment?: Metro2Field[];
  };
  required_demands?: string[];
  required_documentation?: string[];
  approach?: string;
  key_elements?: string[];
}

export interface BureauConfig {
  name: string;
  address: string;
  phone: string;
  online_dispute: string;
  fax: string;
  specific_requirements: string[];
  response_timeframe_days: number;
  investigation_methods: string[];
}

export interface ReasonCode {
  code: string;
  label: string;
  description: string;
  methodology_fit: string[];
  fcra_section?: string;
  dispute_strength: string;
  requires_documentation?: string[];
  metro2_field?: string;
}

export interface ReasonCodeCategory {
  [key: string]: ReasonCode[];
}

export interface DisputeOutcome {
  code: string;
  label: string;
  description: string;
  next_action: string | null;
  is_success: boolean | string;
  fcra_violation?: boolean;
}

export interface ItemTypeConfig {
  recommended_methodologies: string[];
  common_issues: string[];
  required_metro2_fields?: string[];
  reporting_limit_years?: number;
}

export interface DisputeStrategiesConfig {
  version: string;
  methodologies: Record<string, Methodology>;
  bureaus: Record<string, BureauConfig>;
  reason_codes: ReasonCodeCategory;
  escalation_paths: Record<string, Record<string, unknown>>;
  outcomes: DisputeOutcome[];
  item_types: Record<string, ItemTypeConfig>;
}

export interface PromptConfig {
  methodology: string;
  version: string;
  system_context: string;
  writing_guidelines: {
    tone: string;
    reading_level: string;
    avoid: string[];
    include: string[];
    [key: string]: unknown;
  };
  prompt_template: string;
  round_variations?: Record<string, {
    additional_context: string;
    escalation_warning: string;
  }>;
  target_variations?: Record<string, {
    addressee: string;
    opening: string;
    legal_focus: string[];
  }>;
  [key: string]: unknown;
}

// Cache for loaded configs
let strategiesConfig: DisputeStrategiesConfig | null = null;
const promptConfigs: Map<string, PromptConfig> = new Map();

const CONFIG_DIR = path.join(process.cwd(), 'config');
const PROMPTS_DIR = path.join(CONFIG_DIR, 'prompts');

// Embedded fallback configuration for serverless environments
const EMBEDDED_STRATEGIES_CONFIG: DisputeStrategiesConfig = {
  version: '1.0',
  methodologies: {
    factual: {
      name: 'Factual Dispute',
      description: 'Challenges the accuracy of reported information based on documented facts',
      round_range: [1, 2, 3],
      target_recipients: ['bureau', 'creditor', 'furnisher'],
      best_for: ['Incorrect account details', 'Wrong payment history', 'Inaccurate balances', 'Accounts not belonging to consumer'],
      legal_citations: {
        primary: [
          { section: 'FCRA Section 611', code: '15 U.S.C. § 1681i', description: 'Procedure in case of disputed accuracy' },
          { section: 'FCRA Section 623', code: '15 U.S.C. § 1681s-2', description: 'Responsibilities of furnishers of information' },
        ],
        secondary: [{ section: 'FCRA Section 609', code: '15 U.S.C. § 1681g', description: 'Disclosures to consumers' }],
      },
      escalation_triggers: { verified: 'method_of_verification', updated: 're_dispute', no_response: 'cfpb_complaint', deleted: null },
      success_indicators: ['Account deleted from credit report', 'Information corrected to accurate status'],
    },
    metro2_compliance: {
      name: 'Metro 2 Compliance',
      description: 'Challenges reporting format violations under Metro 2 standards',
      round_range: [1, 2],
      target_recipients: ['bureau'],
      best_for: ['Invalid status codes', 'Missing required fields', 'Incorrect date formats', 'Balance/limit inconsistencies'],
      legal_citations: {
        primary: [
          { section: 'FCRA Section 607', code: '15 U.S.C. § 1681e', description: 'Compliance procedures - maximum possible accuracy' },
          { section: 'FCRA Section 623(a)(1)', code: '15 U.S.C. § 1681s-2(a)(1)', description: 'Duty to provide accurate information' },
        ],
      },
      escalation_triggers: { verified: 'direct_creditor', no_response: 'fcra_violation_notice', deleted: null },
    },
    consumer_law: {
      name: 'Consumer Law Dispute',
      description: 'Leverages federal consumer protection laws to challenge reporting',
      round_range: [2, 3],
      target_recipients: ['bureau', 'creditor', 'collector', 'furnisher'],
      best_for: ['Time-barred debts still reporting', 'Re-aged accounts', 'Post-bankruptcy reporting errors', 'FDCPA violations'],
      legal_citations: {
        primary: [
          { section: 'FCRA Section 605', code: '15 U.S.C. § 1681c', description: 'Requirements relating to information in consumer reports (7-year rule)' },
          { section: 'FDCPA Section 809', code: '15 U.S.C. § 1692g', description: 'Validation of debts' },
        ],
      },
      escalation_triggers: { verified: 'intent_to_sue_notice', no_response: 'cfpb_complaint', deleted: null },
    },
    method_of_verification: {
      name: '611 Method of Verification',
      description: 'Demands disclosure of how disputed information was verified',
      round_range: [2, 3],
      target_recipients: ['bureau'],
      best_for: ['Items verified without documentation', 'E-OSCAR rubber stamp responses', 'Follow-up to prior verified disputes'],
      legal_citations: {
        primary: [
          { section: 'FCRA Section 611(a)(6)(B)(iii)', code: '15 U.S.C. § 1681i(a)(6)(B)(iii)', description: 'Consumer right to description of reinvestigation procedure' },
        ],
      },
      escalation_triggers: { no_documentation: 'fcra_violation_notice', verified: 'direct_creditor', deleted: null },
      required_demands: ['Name, address, telephone of furnisher', 'Method used to verify', 'Documentation obtained', 'Name of investigator'],
    },
    debt_validation: {
      name: 'Debt Validation (FDCPA)',
      description: 'Requests validation of debt from collectors under FDCPA',
      round_range: [1],
      target_recipients: ['collector'],
      best_for: ['Collection accounts', 'Purchased debt', 'Unknown creditor accounts'],
      legal_citations: {
        primary: [
          { section: 'FDCPA Section 809(b)', code: '15 U.S.C. § 1692g(b)', description: 'Validation of debts - cease collection until validated' },
        ],
      },
      escalation_triggers: { no_validation: 'cease_reporting_demand', validated: 'factual_dispute', deleted: null },
      required_documentation: ['Complete payment history', 'Original signed contract', 'Chain of assignment', 'Calculation of amount'],
    },
    goodwill: {
      name: 'Goodwill Request',
      description: 'Appeals to creditor discretion for removal of accurate negative items',
      round_range: [1],
      target_recipients: ['creditor'],
      best_for: ['Single late payment on otherwise perfect history', 'Paid collections', 'Hardship circumstances'],
      legal_citations: { primary: [] },
      escalation_triggers: { denied: 'factual_dispute', approved: null },
      approach: 'non_adversarial',
      key_elements: ['Acknowledge the debt/late payment', 'Explain circumstances', 'Highlight positive payment history'],
    },
  },
  bureaus: {
    transunion: {
      name: 'TransUnion',
      address: 'TransUnion Consumer Solutions\nP.O. Box 2000\nChester, PA 19016-2000',
      phone: '1-800-916-8800',
      online_dispute: 'https://www.transunion.com/credit-disputes/dispute-your-credit',
      fax: '1-610-546-4771',
      specific_requirements: ['Include full SSN for faster processing'],
      response_timeframe_days: 30,
      investigation_methods: ['e-OSCAR automated verification', 'Manual review for complex disputes'],
    },
    experian: {
      name: 'Experian',
      address: 'Experian\nP.O. Box 4500\nAllen, TX 75013',
      phone: '1-888-397-3742',
      online_dispute: 'https://www.experian.com/disputes/main.html',
      fax: '1-972-390-3837',
      specific_requirements: ['Requires 2 forms of ID for identity verification'],
      response_timeframe_days: 30,
      investigation_methods: ['e-OSCAR automated verification', 'ACDV form transmission'],
    },
    equifax: {
      name: 'Equifax',
      address: 'Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374-0256',
      phone: '1-866-349-5191',
      online_dispute: 'https://www.equifax.com/personal/credit-report-services/credit-dispute/',
      fax: '1-888-826-0549',
      specific_requirements: ['Include Equifax file number for faster processing'],
      response_timeframe_days: 30,
      investigation_methods: ['e-OSCAR automated verification', 'Direct furnisher contact'],
    },
  },
  reason_codes: {
    accuracy: [
      { code: 'not_mine', label: 'Not My Account', description: 'This account does not belong to me.', methodology_fit: ['factual', 'consumer_law'], fcra_section: '611(a)', dispute_strength: 'strong' },
      { code: 'never_late', label: 'Never Late', description: 'The reported late payment history is inaccurate.', methodology_fit: ['factual'], fcra_section: '623(a)(1)', dispute_strength: 'medium' },
      { code: 'wrong_balance', label: 'Incorrect Balance', description: 'The reported balance and/or payment amounts are incorrect.', methodology_fit: ['factual', 'metro2_compliance'], fcra_section: '623(a)(1)', dispute_strength: 'medium' },
      { code: 'wrong_dates', label: 'Incorrect Dates', description: 'The dates associated with this account are being reported incorrectly.', methodology_fit: ['factual', 'metro2_compliance'], fcra_section: '623(a)(1)', dispute_strength: 'medium' },
      { code: 'wrong_status', label: 'Incorrect Account Status', description: 'The account status being reported is inaccurate.', methodology_fit: ['factual', 'metro2_compliance'], fcra_section: '623(a)(1)', dispute_strength: 'medium' },
    ],
    ownership: [
      { code: 'identity_theft', label: 'Identity Theft', description: 'This account was opened fraudulently as a result of identity theft.', methodology_fit: ['factual', 'consumer_law'], fcra_section: '605B', dispute_strength: 'strong' },
      { code: 'mixed_file', label: 'Mixed Credit File', description: 'This account belongs to another consumer.', methodology_fit: ['factual', 'consumer_law'], fcra_section: '607(b)', dispute_strength: 'strong' },
    ],
    compliance: [
      { code: 'obsolete', label: 'Obsolete Information', description: 'This information has exceeded the 7-year reporting period.', methodology_fit: ['consumer_law'], fcra_section: '605(a)', dispute_strength: 'strong' },
      { code: 'duplicate', label: 'Duplicate Entry', description: 'This account appears multiple times on my credit report.', methodology_fit: ['factual', 'metro2_compliance'], fcra_section: '607(b)', dispute_strength: 'strong' },
    ],
    collections: [
      { code: 'paid_collection', label: 'Paid Collection', description: 'This collection has been paid in full but is still being reported as unpaid.', methodology_fit: ['factual'], fcra_section: '623(a)(1)', dispute_strength: 'medium' },
      { code: 'no_validation', label: 'Unvalidated Debt', description: 'Collector failed to validate debt within 30 days as required by FDCPA.', methodology_fit: ['debt_validation', 'consumer_law'], fcra_section: 'FDCPA 809', dispute_strength: 'strong' },
    ],
    metro2_violations: [
      { code: 'missing_dofd', label: 'Missing Date of First Delinquency', description: 'Required DOFD field is missing or invalid for derogatory account.', methodology_fit: ['metro2_compliance'], dispute_strength: 'strong', metro2_field: 'Date of First Delinquency' },
      { code: 'invalid_status_code', label: 'Invalid Account Status Code', description: 'Account status code does not match account condition.', methodology_fit: ['metro2_compliance'], dispute_strength: 'medium', metro2_field: 'Account Status' },
    ],
    inquiries: [
      { code: 'unauthorized_inquiry', label: 'Unauthorized Inquiry', description: 'This inquiry was made without my authorization.', methodology_fit: ['factual', 'consumer_law'], fcra_section: '604', dispute_strength: 'medium' },
    ],
  },
  escalation_paths: {},
  outcomes: [
    { code: 'deleted', label: 'Item Deleted', description: 'Negative item successfully removed', next_action: null, is_success: true },
    { code: 'verified', label: 'Verified as Accurate', description: 'Bureau claims item was verified', next_action: 'escalate', is_success: false },
    { code: 'updated', label: 'Information Updated', description: 'Some information was corrected but item remains', next_action: 'review_changes', is_success: 'partial' },
    { code: 'no_response', label: 'No Response (30 Days)', description: 'Bureau failed to respond within FCRA timeframe', next_action: 'demand_deletion', is_success: false, fcra_violation: true },
  ],
  item_types: {
    collection: { recommended_methodologies: ['debt_validation', 'factual', 'metro2_compliance'], common_issues: ['Missing original creditor', 'Re-aged account'], required_metro2_fields: ['K1 Segment', 'Date of First Delinquency'] },
    charge_off: { recommended_methodologies: ['factual', 'metro2_compliance'], common_issues: ['Wrong date of charge-off', 'Incorrect balance'] },
    late_payment: { recommended_methodologies: ['factual', 'goodwill'], common_issues: ['Incorrect late date', 'Wrong number of days late'] },
    bankruptcy: { recommended_methodologies: ['consumer_law', 'factual'], common_issues: ['Accounts should show $0 balance', 'Wrong discharge date'], reporting_limit_years: 10 },
    inquiry: { recommended_methodologies: ['factual'], common_issues: ['No permissible purpose', 'Duplicate inquiry'], reporting_limit_years: 2 },
  },
};

// Load main strategies config
export function loadStrategiesConfig(): DisputeStrategiesConfig {
  if (strategiesConfig) {
    return strategiesConfig;
  }

  // Try loading from file system first
  try {
    const configPath = path.join(CONFIG_DIR, 'dispute-strategies.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    strategiesConfig = yaml.load(fileContents) as DisputeStrategiesConfig;
    return strategiesConfig;
  } catch (error) {
    // Fall back to embedded config for serverless environments
    console.warn('Using embedded dispute strategies config (file system not available)');
    strategiesConfig = EMBEDDED_STRATEGIES_CONFIG;
    return strategiesConfig;
  }
}

// Embedded fallback prompts for serverless
const EMBEDDED_PROMPTS: Record<string, PromptConfig> = {
  factual: {
    methodology: 'factual',
    version: '1.0',
    system_context: 'You are an expert credit repair specialist writing a formal dispute letter that challenges the ACCURACY of information reported on a consumer\'s credit report.',
    writing_guidelines: {
      tone: 'Professional, assertive, knowledgeable consumer',
      reading_level: '12th grade',
      avoid: ['Repetitive phrases', 'Robotic language', 'Overly aggressive language'],
      include: ['Specific account details', 'Clear statement of inaccuracy', 'Relevant FCRA citations', '30-day response deadline'],
    },
    prompt_template: `You are writing a FACTUAL DISPUTE letter. This methodology challenges the accuracy of reported information based on documented facts.

## LEGAL FRAMEWORK
{legal_citations}

## LETTER DETAILS
- Target Recipient: {target_recipient}
- Bureau: {bureau}
- Dispute Round: {round}
- Client Name: {client_name}

## DISPUTED ACCOUNT(S)
{account_details}

## DISPUTE REASONS
{reason_description}

{custom_reason}

## REQUIRED STRUCTURE
1. Current date and properly formatted recipient address
2. Clear RE: line with "FORMAL DISPUTE - DEMAND FOR DELETION"
3. Opening: State this is a formal dispute under FCRA Section 611
4. Account Details: List each disputed account with specifics
5. Inaccuracies: Clearly explain WHY each item is inaccurate
6. Legal Basis: Cite FCRA sections 611, 623, and relevant provisions
7. Demands: DELETE unverifiable information, provide investigation documentation
8. Deadline: 30 days per FCRA Section 611(a)(1)
9. Warning: Statutory damages for willful non-compliance
10. Signature block with enclosures list

Generate a unique, professional dispute letter. Output plain text only - no markdown.`,
  },
  metro2_compliance: {
    methodology: 'metro2_compliance',
    version: '1.0',
    system_context: 'You are an expert credit repair specialist writing a Metro 2 COMPLIANCE dispute letter that challenges data format violations under Metro 2 reporting standards.',
    writing_guidelines: {
      tone: 'Technical, authoritative, compliance-focused',
      reading_level: '12th grade',
      avoid: ['Vague compliance claims', 'Generic dispute language'],
      include: ['Specific Metro 2 field references', 'CDIA Credit Reporting Resource Guide citations', 'Field code violations'],
    },
    prompt_template: `You are writing a METRO 2 COMPLIANCE dispute letter challenging data format violations.

## LEGAL FRAMEWORK
- FCRA Section 607(b): "Maximum possible accuracy"
- FCRA Section 623(a)(1): Furnisher duty to report accurate information
- CDIA Credit Reporting Resource Guide: Metro 2 Format compliance

## LETTER DETAILS
- Target: {target_recipient} ({bureau})
- Round: {round}
- Client: {client_name}

## DISPUTED ACCOUNT(S)
{account_details}

## METRO 2 VIOLATIONS
{metro2_violations}

Generate a technically precise, professional dispute letter. Output plain text only.`,
  },
  method_of_verification: {
    methodology: 'method_of_verification',
    version: '1.0',
    system_context: 'You are an expert credit repair specialist writing a 611 METHOD OF VERIFICATION letter demanding the bureau disclose HOW they verified disputed information.',
    writing_guidelines: {
      tone: 'Assertive, demanding, legally sophisticated',
      reading_level: '12th grade',
      avoid: ['Being vague about requested information', 'Failing to cite specific FCRA sections'],
      include: ['Reference to prior dispute', 'Specific demands for verification documentation', 'Challenge to e-OSCAR adequacy'],
    },
    prompt_template: `You are writing a 611 METHOD OF VERIFICATION letter demanding disclosure of verification procedures.

## CRITICAL LEGAL CITATION
FCRA Section 611(a)(6)(B)(iii) - Consumer's right to receive "a description of the procedure used to determine the accuracy and completeness of the information."

## PRIOR DISPUTE CONTEXT
{prior_dispute_details}

## LETTER DETAILS
- Target: {bureau}
- Round: {round}
- Client: {client_name}

## ACCOUNT(S) PREVIOUSLY DISPUTED
{account_details}

## SPECIFIC DEMANDS (include in letter)
1. Name, address, and telephone number of furnisher contacted
2. Copy of all documentation obtained from furnisher
3. Name and title of employee who conducted investigation
4. Description of verification procedure used
5. Copy of ACDV form transmitted
6. Furnisher's complete response

Generate a demanding, legally sophisticated letter. Output plain text only.`,
  },
  debt_validation: {
    methodology: 'debt_validation',
    version: '1.0',
    system_context: 'You are an expert credit repair specialist writing a DEBT VALIDATION letter under FDCPA Section 809.',
    writing_guidelines: {
      tone: 'Firm, legally precise, demanding',
      reading_level: '12th grade',
      avoid: ['Acknowledging the debt is valid', 'Making payment promises'],
      include: ['Clear FDCPA 809 citation', 'Specific documentation demands', 'Cease collection demand until validation'],
    },
    prompt_template: `You are writing a DEBT VALIDATION letter under FDCPA Section 809.

## LEGAL FRAMEWORK
- FDCPA Section 809(b): Upon written dispute within 30 days, collector must CEASE all collection until validated
- FDCPA Section 807: Prohibition on false/misleading representations

## LETTER DETAILS
- Collector: {creditor_name}
- Client: {client_name}

## DISPUTED ACCOUNT
{account_details}

## VALIDATION DEMANDS
1. Proof you are licensed to collect in client's state
2. Name, address, phone of original creditor
3. Original signed contract bearing consumer's signature
4. Complete payment history from account opening
5. Final account statement from original creditor
6. Complete chain of assignment showing ownership
7. Itemized accounting showing how amount was calculated

## IMPORTANT DISCLAIMERS
- "This is not an acknowledgment of debt"
- "I am requesting validation as permitted by law"

Generate a firm, legally precise debt validation letter. Output plain text only.`,
  },
  consumer_law: {
    methodology: 'consumer_law',
    version: '1.0',
    system_context: 'You are an expert credit repair specialist writing a CONSUMER LAW dispute letter leveraging federal consumer protection statutes.',
    writing_guidelines: {
      tone: 'Authoritative, legally sophisticated, firm',
      reading_level: '12th grade',
      avoid: ['Focusing on only one legal theory', 'Vague legal references'],
      include: ['Multiple statutory citations', 'Specific violation descriptions', 'Reference to regulatory bodies'],
    },
    prompt_template: `You are writing a CONSUMER LAW dispute letter using federal consumer protection statutes.

## LEGAL FRAMEWORK TO CITE
- FCRA Section 605(a): 7-year reporting limitation
- FCRA Section 611(a)(5): Deletion of unverifiable information
- FCRA Section 623(a)(1): Furnisher accuracy duty
- FDCPA Section 807: False/misleading representations

## LETTER DETAILS
- Target: {target_recipient} ({bureau_or_creditor})
- Round: {round}
- Client: {client_name}

## DISPUTED ACCOUNT(S)
{account_details}

## LEGAL VIOLATIONS IDENTIFIED
{violation_descriptions}

Generate a legally sophisticated dispute letter. Output plain text only.`,
  },
};

// Load methodology-specific prompt config
export function loadPromptConfig(methodology: string): PromptConfig | null {
  if (promptConfigs.has(methodology)) {
    return promptConfigs.get(methodology)!;
  }

  const promptFileName = getPromptFileName(methodology);
  const promptPath = path.join(PROMPTS_DIR, promptFileName);

  try {
    if (fs.existsSync(promptPath)) {
      const fileContents = fs.readFileSync(promptPath, 'utf8');
      const config = yaml.load(fileContents) as PromptConfig;
      promptConfigs.set(methodology, config);
      return config;
    }
  } catch (error) {
    console.warn(`File system error loading prompt for ${methodology}, using embedded config`);
  }

  // Fall back to embedded prompts
  if (EMBEDDED_PROMPTS[methodology]) {
    promptConfigs.set(methodology, EMBEDDED_PROMPTS[methodology]);
    return EMBEDDED_PROMPTS[methodology];
  }

  console.warn(`Prompt config not found for methodology: ${methodology}`);
  return null;
}

function getPromptFileName(methodology: string): string {
  const fileMap: Record<string, string> = {
    factual: 'factual-dispute.yaml',
    metro2_compliance: 'metro2-compliance.yaml',
    consumer_law: 'consumer-law.yaml',
    method_of_verification: 'method-of-verification.yaml',
    debt_validation: 'debt-validation.yaml',
    goodwill: 'goodwill.yaml',
  };
  return fileMap[methodology] || `${methodology}.yaml`;
}

// Get methodology details
export function getMethodology(methodologyKey: string): Methodology | null {
  const config = loadStrategiesConfig();
  return config.methodologies[methodologyKey] || null;
}

// Get all methodologies
export function getAllMethodologies(): Record<string, Methodology> {
  const config = loadStrategiesConfig();
  return config.methodologies;
}

// Get bureau config
export function getBureauConfig(bureau: string): BureauConfig | null {
  const config = loadStrategiesConfig();
  return config.bureaus[bureau.toLowerCase()] || null;
}

// Get reason codes filtered by methodology
export function getReasonCodesForMethodology(methodology: string): ReasonCode[] {
  const config = loadStrategiesConfig();
  const allCodes: ReasonCode[] = [];
  
  for (const category of Object.values(config.reason_codes)) {
    for (const code of category) {
      if (code.methodology_fit.includes(methodology)) {
        allCodes.push(code);
      }
    }
  }
  
  return allCodes;
}

// Get all reason codes grouped by category
export function getAllReasonCodes(): ReasonCodeCategory {
  const config = loadStrategiesConfig();
  return config.reason_codes;
}

// Get flat list of all reason codes
export function getAllReasonCodesFlat(): ReasonCode[] {
  const config = loadStrategiesConfig();
  const allCodes: ReasonCode[] = [];
  
  for (const category of Object.values(config.reason_codes)) {
    allCodes.push(...category);
  }
  
  return allCodes;
}

// Get item type configuration
export function getItemTypeConfig(itemType: string): ItemTypeConfig | null {
  const config = loadStrategiesConfig();
  return config.item_types[itemType] || null;
}

// Get recommended methodology for item type
export function getRecommendedMethodology(itemType: string, round: number = 1): string {
  const itemConfig = getItemTypeConfig(itemType);
  if (itemConfig && itemConfig.recommended_methodologies.length > 0) {
    // For round 2+, prefer method_of_verification if available
    if (round >= 2 && itemConfig.recommended_methodologies.includes('method_of_verification')) {
      return 'method_of_verification';
    }
    return itemConfig.recommended_methodologies[0];
  }
  return 'factual'; // Default to factual
}

// Get escalation suggestion based on outcome
export function getEscalationSuggestion(
  methodology: string,
  outcome: string
): string | null {
  const methodologyConfig = getMethodology(methodology);
  if (!methodologyConfig) return null;
  
  const triggers = methodologyConfig.escalation_triggers;
  return (triggers as Record<string, string | null>)[outcome] || null;
}

// Get outcomes configuration
export function getOutcomes(): DisputeOutcome[] {
  const config = loadStrategiesConfig();
  return config.outcomes;
}

// Build legal citations string for a methodology
export function buildLegalCitationsString(methodology: string): string {
  const methodologyConfig = getMethodology(methodology);
  if (!methodologyConfig) return '';
  
  const citations: string[] = [];
  
  for (const citation of methodologyConfig.legal_citations.primary) {
    citations.push(`${citation.section} (${citation.code}): ${citation.description}`);
  }
  
  if (methodologyConfig.legal_citations.secondary) {
    for (const citation of methodologyConfig.legal_citations.secondary) {
      citations.push(`${citation.section} (${citation.code}): ${citation.description}`);
    }
  }
  
  return citations.join('\n');
}

// Clear caches (useful for development/testing)
export function clearConfigCache(): void {
  strategiesConfig = null;
  promptConfigs.clear();
}
