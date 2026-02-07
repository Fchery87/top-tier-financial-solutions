// Utility functions extracted from Dispute Wizard component
// These are pure functions that can be tested independently

// Type definitions
export interface NegativeItem {
  id: string;
  creditor_name: string;
  bureau?: string;
  item_type?: string;
  on_transunion?: boolean;
  on_experian?: boolean;
  on_equifax?: boolean;
  bureaus?: string[];
}

export interface ItemDisputeInstruction {
  itemId: string;
  instructionType: 'preset' | 'custom';
  presetCode?: string;
  customText?: string;
}

export interface PresetDisputeInstruction {
  code: string;
  label: string;
  description: string;
  category: 'factual' | 'situational' | 'ownership_claim' | 'custom';
}

export interface StepStatus {
  stepId: number;
  isComplete: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  isCurrentStep: boolean;
}

// Constants
export const PRESET_DISPUTE_INSTRUCTIONS: PresetDisputeInstruction[] = [
  // === RECOMMENDED: METRO 2 COMPLIANCE-BASED FACTUAL DISPUTES ===
  { code: 'verification_required', label: '✓ Request Verification (Recommended)', description: 'I am requesting documented verification of this account data under FCRA Section 611. The furnisher must provide proof that this information is complete and accurate per Metro 2 standards.', category: 'factual' },
  { code: 'metro2_violation', label: '✓ Metro 2 Compliance Violation', description: 'This account contains Metro 2 format compliance violations and does not meet the maximum possible accuracy standard required under FCRA Section 607(b).', category: 'factual' },
  { code: 'inaccurate_reporting', label: '✓ Inaccurate Information', description: 'The information being reported contains inaccuracies. I am disputing the accuracy of this data under FCRA Section 623 and demanding a reasonable investigation.', category: 'factual' },
  { code: 'incomplete_data', label: '✓ Incomplete Data Fields', description: 'This account is being reported with incomplete information, missing required Metro 2 data fields necessary for accurate credit reporting.', category: 'factual' },
  { code: 'missing_dofd', label: '✓ Missing Date of First Delinquency', description: 'This derogatory account lacks the required Date of First Delinquency (DOFD) field, which is mandatory under FCRA Section 605 for calculating the 7-year reporting period.', category: 'factual' },
  { code: 'status_inconsistency', label: '✓ Status Code Inconsistency', description: 'The Account Status Code is inconsistent with the Payment Rating and payment history pattern. This internal data inconsistency violates Metro 2 format requirements.', category: 'factual' },

  // === SITUATIONAL: Use when specific conditions apply ===
  { code: 'wrong_balance', label: 'Incorrect Balance', description: 'The balance reported is incorrect and does not reflect the actual amount owed.', category: 'situational' },
  { code: 'paid_in_full', label: 'Paid in Full', description: 'This account has been paid in full but is still showing a balance or negative status.', category: 'situational' },
  { code: 'wrong_status', label: 'Wrong Account Status', description: 'The account status being reported is inaccurate and requires verification.', category: 'situational' },
  { code: 'wrong_dates', label: 'Incorrect Dates', description: 'The dates associated with this account are being reported incorrectly.', category: 'situational' },
  { code: 'duplicate', label: 'Duplicate Account', description: 'This account appears multiple times on my credit report.', category: 'situational' },
  { code: 'obsolete', label: 'Obsolete Information (7+ Years)', description: 'This information is obsolete and has exceeded the FCRA 7-year reporting period.', category: 'situational' },
  { code: 'settled', label: 'Account Settled', description: 'This account was settled but is not being reported correctly.', category: 'situational' },
  { code: 'included_bankruptcy', label: 'Included in Bankruptcy', description: 'This account was included in bankruptcy and should reflect discharged status.', category: 'situational' },
  { code: 'unauthorized_inquiry', label: 'Unauthorized Inquiry', description: 'This inquiry lacks documented permissible purpose under FCRA Section 604.', category: 'situational' },

  // === CAUTION: Only use when client specifically confirms these facts ===
  { code: 'not_mine', label: '⚠️ Not My Account (CLIENT MUST CONFIRM)', description: 'This account does not belong to me. I have never opened or authorized this account. WARNING: Only use if client confirms this is true.', category: 'ownership_claim' },
  { code: 'never_late', label: '⚠️ Never Late (CLIENT MUST CONFIRM)', description: 'I have never been late on this account. WARNING: Only use if client confirms all payments were on time.', category: 'ownership_claim' },
  { code: 'identity_theft', label: '⚠️ Identity Theft (REQUIRES DOCUMENTATION)', description: 'This account was opened fraudulently as a result of identity theft. WARNING: Should have police report or FTC Identity Theft Report.', category: 'ownership_claim' },

  { code: 'custom', label: 'Custom Instruction', description: 'Enter your own dispute instruction', category: 'custom' },
];

// Utility Functions

/**
 * Check if a negative item appears on a specific bureau
 * Uses the new per-bureau boolean fields, with fallback to legacy bureau field
 */
export function itemAppearsOnBureau(item: NegativeItem, bureau: string): boolean {
  const bureauLower = bureau.toLowerCase();

  // First, check the new per-bureau boolean fields
  if (bureauLower === 'transunion' && item.on_transunion !== undefined) {
    return item.on_transunion;
  }
  if (bureauLower === 'experian' && item.on_experian !== undefined) {
    return item.on_experian;
  }
  if (bureauLower === 'equifax' && item.on_equifax !== undefined) {
    return item.on_equifax;
  }

  // Check the bureaus array if available
  if (item.bureaus && item.bureaus.length > 0) {
    return item.bureaus.includes(bureauLower);
  }

  // Fallback to legacy bureau field logic
  // If no specific bureau, assume it appears on all bureaus (conservative)
  if (!item.bureau || item.bureau === 'combined') {
    return true;
  }

  // Otherwise, check if legacy bureau matches
  return item.bureau.toLowerCase() === bureauLower;
}

/**
 * Format item type from snake_case to Title Case
 * Example: "charge_off" -> "Charge Off"
 */
export function formatItemType(type: string): string {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Format personal info type with proper capitalization
 * Example: "date_of_birth" -> "Date Of Birth"
 */
export function formatPersonalInfoType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format cents to currency
 * Example: 123456 -> "$1,234.56"
 */
export function formatCurrency(cents: number | null | undefined): string {
  if (!cents) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Get the dispute instruction text for an item
 */
export function getInstructionText(
  itemId: string,
  instructions: Map<string, ItemDisputeInstruction>
): string {
  const instruction = instructions.get(itemId);
  if (!instruction) return '';
  if (instruction.instructionType === 'custom') return instruction.customText || '';
  const preset = PRESET_DISPUTE_INSTRUCTIONS.find(p => p.code === instruction.presetCode);
  return preset?.description || '';
}

/**
 * Get recommended methodology based on selected items and dispute round
 */
export function getRecommendedMethodologyForItems(
  selectedItemIds: string[],
  allItems: NegativeItem[],
  disputeRound: number
): string | null {
  if (selectedItemIds.length === 0) return null;

  // Check if any item is a collection - recommend debt_validation
  const hasCollection = allItems
    .filter(i => selectedItemIds.includes(i.id))
    .some(i => i.item_type === 'collection');

  if (hasCollection && disputeRound === 1) {
    return 'debt_validation';
  }

  // For round 2+, recommend method_of_verification
  if (disputeRound >= 2) {
    return 'method_of_verification';
  }

  return 'factual';
}

/**
 * Build step statuses for progress bar
 */
export function buildStepStatuses(
  currentStep: number,
  selectedClient: unknown,
  selectedItemsCount: number,
  selectedBureausCount: number,
  generatedLettersCount: number,
  validationErrors: Record<number, string[]>,
  validationWarnings: Record<number, string[]>
): StepStatus[] {
  const steps = [
    { id: 1, name: 'Client' },
    { id: 2, name: 'Items' },
    { id: 3, name: 'Configure' },
    { id: 4, name: 'Review' },
  ];

  return steps.map((step) => {
    const stepErrors = validationErrors[step.id] || [];
    const stepWarnings = validationWarnings[step.id] || [];
    const isComplete =
      (step.id === 1 && selectedClient !== null) ||
      (step.id === 2 && selectedItemsCount > 0) ||
      (step.id === 3 && selectedBureausCount > 0) ||
      (step.id === 4 && generatedLettersCount > 0);

    return {
      stepId: step.id,
      isComplete,
      hasErrors: stepErrors.length > 0,
      hasWarnings: stepWarnings.length > 0,
      isCurrentStep: currentStep === step.id,
    };
  });
}
