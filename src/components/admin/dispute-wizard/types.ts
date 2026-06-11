import { Users, FileText, Target, CheckCircle } from 'lucide-react';

export interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface NegativeItem {
  id: string;
  creditor_name: string;
  original_creditor: string | null;
  account_number?: string | null;
  item_type: string;
  amount: number | null;
  date_reported: string | null;
  bureau: string | null;
  bureaus?: string[];
  on_transunion?: boolean;
  on_experian?: boolean;
  on_equifax?: boolean;
  transunion_date?: string | null;
  experian_date?: string | null;
  equifax_date?: string | null;
  transunion_status?: string | null;
  experian_status?: string | null;
  equifax_status?: string | null;
  risk_severity: string;
  recommended_action: string | null;
}

export interface PersonalInfoItem {
  id: string;
  bureau: string;
  type: string;
  value: string;
}

export interface InquiryItem {
  id: string;
  creditor_name: string;
  bureau: string | null;
  inquiry_date?: string | null;
  inquiry_type?: string | null;
  is_past_fcra_limit?: boolean | null;
  days_since_inquiry?: number | null;
}

export interface ItemDisputeInstruction {
  itemId: string;
  instructionType: 'preset' | 'custom';
  presetCode?: string;
  customText?: string;
}

export interface ReasonCode {
  code: string;
  label: string;
  description: string;
  methodologyFit?: string[];
  strength?: string;
}

export interface DisputeType {
  code: string;
  label: string;
}

export interface TriageQuickAction {
  id: string;
  label: string;
  description: string;
  itemIds: string[];
  count: number;
  bureau?: string;
  itemType?: string;
}

export interface EvidenceDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  created_at: string;
}

export interface Methodology {
  code: string;
  name: string;
  description: string;
  roundRange: number[];
  targetRecipients: string[];
  bestFor: string[];
  successIndicators: string[];
}

export interface AIAnalysisResult {
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

export interface AIAnalysisSummary {
  itemCount: number;
  recommendedMethodology: string;
  allReasonCodes: string[];
  recommendedReasonCodes?: string[];
  allMetro2Violations: string[];
  allFcraIssues: string[];
  averageConfidence: number;
  analysisNotes: string;
}

export type DisputeItemKind = 'tradeline' | 'personal' | 'inquiry';

export interface DisputeItemPayload {
  id: string;
  kind: DisputeItemKind;
  bureau?: string | null;
  creditorName?: string;
  originalCreditor?: string | null;
  accountNumber?: string | null;
  itemType?: string;
  amount?: number | null;
  value?: string;
  inquiryDate?: string | null;
  inquiryType?: string | null;
  isPastFcraLimit?: boolean | null;
  daysSinceInquiry?: number | null;
  riskSeverity?: string | null;
}

export interface GeneratedLetter {
  id: string;
  bureau: string;
  itemId: string;
  itemIds?: string[];
  items?: DisputeItemPayload[];
  itemKind?: DisputeItemKind;
  content: string;
  combined: boolean;
}

export type ItemTab = 'tradelines' | 'personal' | 'inquiries';
export type TargetRecipient = 'bureau' | 'creditor' | 'collector';
export type GenerationMethod = 'ai' | 'template';
export type AnalysisAggressiveness = 'conservative' | 'balanced' | 'aggressive';

export const PRESET_DISPUTE_INSTRUCTIONS = [
  { code: 'verification_required', label: '✓ Request Verification (Recommended)', description: 'I am requesting documented verification of this account data under FCRA Section 611. The furnisher must provide proof that this information is complete and accurate per Metro 2 standards.', category: 'factual' },
  { code: 'metro2_violation', label: '✓ Metro 2 Compliance Violation', description: 'This account contains Metro 2 format compliance violations and does not meet the maximum possible accuracy standard required under FCRA Section 607(b).', category: 'factual' },
  { code: 'inaccurate_reporting', label: '✓ Inaccurate Information', description: 'The information being reported contains inaccuracies. I am disputing the accuracy of this data under FCRA Section 623 and demanding a reasonable investigation.', category: 'factual' },
  { code: 'incomplete_data', label: '✓ Incomplete Data Fields', description: 'This account is being reported with incomplete information, missing required Metro 2 data fields necessary for accurate credit reporting.', category: 'factual' },
  { code: 'missing_dofd', label: '✓ Missing Date of First Delinquency', description: 'This derogatory account lacks the required Date of First Delinquency (DOFD) field, which is mandatory under FCRA Section 605 for calculating the 7-year reporting period.', category: 'factual' },
  { code: 'status_inconsistency', label: '✓ Status Code Inconsistency', description: 'The Account Status Code is inconsistent with the Payment Rating and payment history pattern. This internal data inconsistency violates Metro 2 format requirements.', category: 'factual' },
  { code: 'wrong_balance', label: 'Incorrect Balance', description: 'The balance reported is incorrect and does not reflect the actual amount owed.', category: 'situational' },
  { code: 'paid_in_full', label: 'Paid in Full', description: 'This account has been paid in full but is still showing a balance or negative status.', category: 'situational' },
  { code: 'wrong_status', label: 'Wrong Account Status', description: 'The account status being reported is inaccurate and requires verification.', category: 'situational' },
  { code: 'wrong_dates', label: 'Incorrect Dates', description: 'The dates associated with this account are being reported incorrectly.', category: 'situational' },
  { code: 'duplicate', label: 'Duplicate Account', description: 'This account appears multiple times on my credit report.', category: 'situational' },
  { code: 'obsolete', label: 'Obsolete Information (7+ Years)', description: 'This information is obsolete and has exceeded the FCRA 7-year reporting period.', category: 'situational' },
  { code: 'settled', label: 'Account Settled', description: 'This account was settled but is not being reported correctly.', category: 'situational' },
  { code: 'included_bankruptcy', label: 'Included in Bankruptcy', description: 'This account was included in bankruptcy and should reflect discharged status.', category: 'situational' },
  { code: 'unauthorized_inquiry', label: 'Unauthorized Inquiry', description: 'This inquiry lacks documented permissible purpose under FCRA Section 604.', category: 'situational' },
  { code: 'not_mine', label: '⚠️ Not My Account (CLIENT MUST CONFIRM)', description: 'This account does not belong to me. I have never opened or authorized this account. WARNING: Only use if client confirms this is true.', category: 'ownership_claim' },
  { code: 'never_late', label: '⚠️ Never Late (CLIENT MUST CONFIRM)', description: 'I have never been late on this account. WARNING: Only use if client confirms all payments were on time.', category: 'ownership_claim' },
  { code: 'identity_theft', label: '⚠️ Identity Theft (REQUIRES DOCUMENTATION)', description: 'This account was opened fraudulently as a result of identity theft. WARNING: Should have police report or FTC Identity Theft Report.', category: 'ownership_claim' },
  { code: 'custom', label: 'Custom Instruction', description: 'Enter your own dispute instruction', category: 'custom' },
];

export const WIZARD_STEPS = [
  { id: 1, name: 'Client', icon: Users },
  { id: 2, name: 'Items', icon: FileText },
  { id: 3, name: 'Configure', icon: Target },
  { id: 4, name: 'Review', icon: CheckCircle },
];

export const BUREAUS = [
  { code: 'transunion', label: 'TransUnion' },
  { code: 'experian', label: 'Experian' },
  { code: 'equifax', label: 'Equifax' },
];

// Secondary consumer reporting agencies. Items are not tracked per secondary CRA,
// so disputes sent to them cover every selected item.
export const SECONDARY_BUREAUS = [
  { code: 'lexisnexis', label: 'LexisNexis' },
  { code: 'innovis', label: 'Innovis' },
  { code: 'chexsystems', label: 'ChexSystems' },
  { code: 'ews', label: 'Early Warning Services' },
];

export function isSecondaryBureau(bureau: string): boolean {
  return SECONDARY_BUREAUS.some(b => b.code === bureau.toLowerCase());
}

export function itemAppearsOnBureau(item: NegativeItem, bureau: string): boolean {
  const bureauLower = bureau.toLowerCase();
  // Secondary CRAs aggregate from furnishers, not from big-3 tradeline data;
  // every selected item is in scope for a secondary-agency dispute.
  if (isSecondaryBureau(bureauLower)) return true;
  if (bureauLower === 'transunion' && item.on_transunion !== undefined) return item.on_transunion;
  if (bureauLower === 'experian' && item.on_experian !== undefined) return item.on_experian;
  if (bureauLower === 'equifax' && item.on_equifax !== undefined) return item.on_equifax;
  if (item.bureaus && item.bureaus.length > 0) return item.bureaus.includes(bureauLower);
  if (!item.bureau || item.bureau === 'combined') return true;
  return item.bureau.toLowerCase() === bureauLower;
}

export function formatPersonalInfoType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}


