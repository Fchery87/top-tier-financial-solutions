import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { logServerEvent } from '@/lib/server-logger';

// Check if running in serverless environment (no file system access)
const _isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.CLOUDFLARE_WORKER;

// Type definitions for dispute configuration
export interface LegalCitation {
  section: string;
  code: string;
  description: string;
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
  success_indicators?: string[];
  metro2_fields?: {
    base_segment: Metro2Field[];
    k_segment?: Metro2Field[];
  };
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
  outcomes: DisputeOutcome[];
  item_types: Record<string, ItemTypeConfig>;
}

// Cache for loaded configs
let strategiesConfig: DisputeStrategiesConfig | null = null;

const CONFIG_DIR = path.join(process.cwd(), 'config');

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
    },
    factual_escalation: {
      name: 'Factual Escalation',
      description: 'Uses documented reporting issues and prior dispute history to escalate factually',
      round_range: [2, 3],
      target_recipients: ['bureau', 'creditor', 'collector', 'furnisher'],
      best_for: ['Time-barred debts still reporting', 'Re-aged accounts', 'Post-bankruptcy reporting errors', 'Unresolved documented inaccuracies'],
      legal_citations: {
        primary: [
          { section: 'FCRA Section 605', code: '15 U.S.C. § 1681c', description: 'Requirements relating to information in consumer reports (7-year rule)' },
          { section: 'FDCPA Section 809', code: '15 U.S.C. § 1692g', description: 'Validation of debts' },
        ],
      },
    },
    method_of_verification: {
      name: '611 Method of Verification',
      description: 'Demands disclosure of how disputed information was verified',
      round_range: [2, 3],
      target_recipients: ['bureau'],
      best_for: ['Items verified without documentation', 'Sparse reinvestigation responses', 'Follow-up to prior verified disputes'],
      legal_citations: {
        primary: [
          { section: 'FCRA Section 611(a)(7)', code: '15 U.S.C. § 1681i(a)(7)', description: 'Description of the reinvestigation procedure, on request' },
        ],
      },
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
      required_documentation: ['Complete payment history', 'Original signed contract', 'Chain of assignment', 'Calculation of amount'],
    },
    goodwill: {
      name: 'Goodwill Request',
      description: 'Appeals to creditor discretion for removal of accurate negative items',
      round_range: [1],
      target_recipients: ['creditor'],
      best_for: ['Single late payment on otherwise perfect history', 'Paid collections', 'Hardship circumstances'],
      legal_citations: { primary: [] },
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
      investigation_methods: ['Automated verification workflow', 'Manual review for complex disputes'],
    },
    experian: {
      name: 'Experian',
      address: 'Experian\nP.O. Box 4500\nAllen, TX 75013',
      phone: '1-888-397-3742',
      online_dispute: 'https://www.experian.com/disputes/main.html',
      fax: '1-972-390-3837',
      specific_requirements: ['Requires 2 forms of ID for identity verification'],
      response_timeframe_days: 30,
      investigation_methods: ['Automated verification workflow', 'ACDV form transmission'],
    },
    equifax: {
      name: 'Equifax',
      address: 'Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374-0256',
      phone: '1-866-349-5191',
      online_dispute: 'https://www.equifax.com/personal/credit-report-services/credit-dispute/',
      fax: '1-888-826-0549',
      specific_requirements: ['Include Equifax file number for faster processing'],
      response_timeframe_days: 30,
      investigation_methods: ['Automated verification workflow', 'Direct furnisher contact'],
    },
    // Secondary consumer reporting agencies (addresses verified June 2026)
    lexisnexis: {
      name: 'LexisNexis Risk Solutions',
      address: 'LexisNexis Risk Solutions Consumer Center\nP.O. Box 105108\nAtlanta, GA 30348-5108',
      phone: '1-888-497-0011',
      online_dispute: 'https://consumer.risk.lexisnexis.com/',
      fax: '',
      specific_requirements: ['Request the LexisNexis Consumer Disclosure Report first to obtain the case/consumer number'],
      response_timeframe_days: 30,
      investigation_methods: ['Manual consumer center review'],
    },
    innovis: {
      name: 'Innovis',
      address: 'Innovis Consumer Assistance\nP.O. Box 530088\nAtlanta, GA 30353-0088',
      phone: '1-800-540-2505',
      online_dispute: 'https://www.innovis.com/personal/disputeResolution',
      fax: '',
      specific_requirements: ['Include full name, SSN, DOB, and current address'],
      response_timeframe_days: 30,
      investigation_methods: ['Furnisher verification'],
    },
    chexsystems: {
      name: 'ChexSystems',
      address: 'Chex Systems, Inc.\nAttn: Consumer Relations\nP.O. Box 583399\nMinneapolis, MN 55458',
      phone: '1-800-428-9623',
      online_dispute: 'https://www.chexsystems.com/',
      fax: '',
      specific_requirements: ['Include Consumer ID from the ChexSystems disclosure report when available'],
      response_timeframe_days: 30,
      investigation_methods: ['Source bank verification'],
    },
    ews: {
      name: 'Early Warning Services',
      address: 'Early Warning Services, LLC\nAttn: Consumer Services\n5801 N. Pima Road\nScottsdale, AZ 85250',
      phone: '1-800-745-4210',
      online_dispute: 'https://www.earlywarning.com/dispute-file-disclosure',
      fax: '',
      specific_requirements: ['Request the EWS consumer file disclosure before disputing'],
      response_timeframe_days: 30,
      investigation_methods: ['Contributing bank verification'],
    },
  },
  reason_codes: {
    accuracy: [
      { code: 'not_mine', label: 'Not My Account', description: 'This account does not belong to me.', methodology_fit: ['factual', 'factual_escalation'], fcra_section: '611(a)', dispute_strength: 'strong' },
      { code: 'never_late', label: 'Never Late', description: 'The reported late payment history is inaccurate.', methodology_fit: ['factual'], fcra_section: '623(a)(1)', dispute_strength: 'medium' },
      { code: 'wrong_balance', label: 'Incorrect Balance', description: 'The reported balance and/or payment amounts are incorrect.', methodology_fit: ['factual', 'metro2_compliance'], fcra_section: '623(a)(1)', dispute_strength: 'medium' },
      { code: 'wrong_dates', label: 'Incorrect Dates', description: 'The dates associated with this account are being reported incorrectly.', methodology_fit: ['factual', 'metro2_compliance'], fcra_section: '623(a)(1)', dispute_strength: 'medium' },
      { code: 'wrong_status', label: 'Incorrect Account Status', description: 'The account status being reported is inaccurate.', methodology_fit: ['factual', 'metro2_compliance'], fcra_section: '623(a)(1)', dispute_strength: 'medium' },
    ],
    ownership: [
      { code: 'identity_theft', label: 'Identity Theft', description: 'This account was opened fraudulently as a result of identity theft.', methodology_fit: ['factual', 'factual_escalation'], fcra_section: '605B', dispute_strength: 'strong' },
      { code: 'mixed_file', label: 'Mixed Credit File', description: 'This account belongs to another consumer.', methodology_fit: ['factual', 'factual_escalation'], fcra_section: '607(b)', dispute_strength: 'strong' },
    ],
    compliance: [
      { code: 'obsolete', label: 'Obsolete Information', description: 'This information has exceeded the 7-year reporting period.', methodology_fit: ['factual_escalation'], fcra_section: '605(a)', dispute_strength: 'strong' },
      { code: 'duplicate', label: 'Duplicate Entry', description: 'This account appears multiple times on my credit report.', methodology_fit: ['factual', 'metro2_compliance'], fcra_section: '607(b)', dispute_strength: 'strong' },
    ],
    collections: [
      { code: 'paid_collection', label: 'Paid Collection', description: 'This collection has been paid in full but is still being reported as unpaid.', methodology_fit: ['factual'], fcra_section: '623(a)(1)', dispute_strength: 'medium' },
      { code: 'no_validation', label: 'Unvalidated Debt', description: 'Collector failed to validate debt within 30 days as required by FDCPA.', methodology_fit: ['debt_validation', 'factual_escalation'], fcra_section: 'FDCPA 809', dispute_strength: 'strong' },
    ],
    metro2_violations: [
      { code: 'missing_dofd', label: 'Missing Date of First Delinquency', description: 'Required DOFD field is missing or invalid for derogatory account.', methodology_fit: ['metro2_compliance'], dispute_strength: 'strong', metro2_field: 'Date of First Delinquency' },
      { code: 'invalid_status_code', label: 'Invalid Account Status Code', description: 'Account status code does not match account condition.', methodology_fit: ['metro2_compliance'], dispute_strength: 'medium', metro2_field: 'Account Status' },
    ],
    inquiries: [
      { code: 'unauthorized_inquiry', label: 'Unauthorized Inquiry', description: 'This inquiry was made without my authorization.', methodology_fit: ['factual', 'factual_escalation'], fcra_section: '604', dispute_strength: 'medium' },
    ],
  },
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
    bankruptcy: { recommended_methodologies: ['factual_escalation', 'factual'], common_issues: ['Accounts should show $0 balance', 'Wrong discharge date'], reporting_limit_years: 10 },
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
  } catch {
    // Fall back to embedded config for serverless environments
    logServerEvent({ level: 'warn', event: 'server.lib.dispute.config.loader.warn' });
    strategiesConfig = EMBEDDED_STRATEGIES_CONFIG;
    return strategiesConfig;
  }
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

// Get outcomes configuration
export function getOutcomes(): DisputeOutcome[] {
  const config = loadStrategiesConfig();
  return config.outcomes;
}

// Clear caches (useful for development/testing)
export function clearConfigCache(): void {
  strategiesConfig = null;
}
