// Dispute Wizard Validation Framework
// Provides comprehensive validation for all wizard steps

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EvidenceValidationResult extends ValidationResult {
  blockingReasons: string[];
  requiredEvidenceMissing: string[];
  recommendedEvidenceMissing: string[];
  canOverride: boolean;
}

export interface StepValidationContext {
  step: 1 | 2 | 3 | 4;
  clientId?: string | null;
  selectedItemIds?: string[];
  reasonCodes?: string[];
  selectedBureaus?: string[];
  disputeRound?: number;
  generatedLetters?: Array<{ id: string; content: string }>;
  selectedEvidenceIds?: string[];
}

// High-risk reason codes that REQUIRE evidence
const HIGH_RISK_CODES = new Set([
  'identity_theft',
  'not_mine',
  'mixed_file',
]);

// Medium-risk codes that STRONGLY benefit from evidence
const MEDIUM_RISK_CODES = new Set([
  'paid_collection',
  'never_late',
  'closed_by_consumer',
]);

/**
 * Validate Step 1: Client Selection
 * Ensures a client has been selected
 */
export function validateStep1(selectedClientId: string | null): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!selectedClientId || selectedClientId.trim() === '') {
    errors.push('Please select a client to proceed');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate Step 2: Item Selection
 * Ensures items are selected with reason codes
 */
export function validateStep2(
  selectedItemIds: string[],
  itemReasonCodes: Record<string, string[]>,
  _activeTab?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if any items selected
  if (!selectedItemIds || selectedItemIds.length === 0) {
    errors.push('Please select at least one item to dispute');
    return { isValid: false, errors, warnings };
  }

  // Check if reason codes provided for all selected items
  for (const itemId of selectedItemIds) {
    const codes = itemReasonCodes[itemId];

    if (!codes || codes.length === 0) {
      errors.push(`Item ${itemId}: Please select at least one dispute reason code`);
    }

    // Warn if too many reason codes (more than 3 per item suggests unfocused dispute)
    if (codes && codes.length > 3) {
      warnings.push(
        `Item ${itemId}: Using ${codes.length} reason codes - consider focusing on 1-3 strongest claims`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate Step 3: Configuration
 * Ensures proper dispute configuration
 */
export function validateStep3(
  selectedBureaus: string[],
  disputeRound: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if bureaus selected
  if (!selectedBureaus || selectedBureaus.length === 0) {
    errors.push('Please select at least one credit bureau to send disputes to');
  }

  // Validate dispute round
  if (disputeRound < 1 || disputeRound > 3) {
    errors.push('Dispute round must be between 1 and 3');
  }

  // Warn if Round 3 (regulatory escalation)
  if (disputeRound === 3) {
    warnings.push(
      'Round 3 disputes are escalated to regulatory bodies - ensure all evidence is included'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate Step 4: Review
 * Ensures letters have been generated
 */
export function validateStep4(
  generatedLetters: Array<{ id: string; content: string }> | undefined
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!generatedLetters || generatedLetters.length === 0) {
    errors.push('No dispute letters have been generated yet');
  }

  // Check if letters have content
  const lettersWithoutContent = generatedLetters?.filter(
    (letter) => !letter.content || letter.content.trim().length === 0
  );

  if (lettersWithoutContent && lettersWithoutContent.length > 0) {
    errors.push(`${lettersWithoutContent.length} letter(s) have no content`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate Evidence Requirements
 * Checks if required evidence is present for the dispute
 */
export function validateEvidenceRequirements(
  reasonCodes: string[],
  selectedEvidenceIds: string[] = [],
  _itemIds: string[] = []
): EvidenceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  const requiredEvidenceMissing: string[] = [];
  const recommendedEvidenceMissing: string[] = [];

  // Check for high-risk codes without evidence
  const highRiskCodesPresent = reasonCodes.filter((code) => HIGH_RISK_CODES.has(code));

  if (highRiskCodesPresent.length > 0 && (!selectedEvidenceIds || selectedEvidenceIds.length === 0)) {
    blockingReasons.push(
      `High-risk dispute reasons (${highRiskCodesPresent.join(', ')}) require supporting evidence`
    );
    errors.push(
      'Cannot proceed: High-risk disputes require attached evidence documentation'
    );

    // Provide specific evidence guidance
    if (highRiskCodesPresent.includes('identity_theft')) {
      requiredEvidenceMissing.push('Police report or FTC Identity Theft Report');
    }
    if (highRiskCodesPresent.includes('not_mine')) {
      requiredEvidenceMissing.push('Government ID proving identity');
    }
    if (highRiskCodesPresent.includes('mixed_file')) {
      requiredEvidenceMissing.push('ID documentation and proof of correct identity');
    }
  }

  // Check for medium-risk codes and recommend evidence
  const mediumRiskCodesPresent = reasonCodes.filter((code) => MEDIUM_RISK_CODES.has(code));

  if (mediumRiskCodesPresent.length > 0 && (!selectedEvidenceIds || selectedEvidenceIds.length === 0)) {
    warnings.push(
      `Medium-risk disputes (${mediumRiskCodesPresent.join(', ')}) are significantly stronger with supporting evidence`
    );

    if (mediumRiskCodesPresent.includes('paid_collection')) {
      recommendedEvidenceMissing.push('Payment receipt or settlement letter');
    }
    if (mediumRiskCodesPresent.includes('never_late')) {
      recommendedEvidenceMissing.push('Payment history showing on-time payments');
    }
    if (mediumRiskCodesPresent.includes('closed_by_consumer')) {
      recommendedEvidenceMissing.push('Account closure confirmation letter');
    }
  }

  return {
    isValid: blockingReasons.length === 0,
    errors,
    warnings,
    blockingReasons,
    requiredEvidenceMissing,
    recommendedEvidenceMissing,
    canOverride: blockingReasons.length > 0, // Allow admin override
  };
}

/**
 * Master validation function
 * Validates all relevant fields based on step context
 */
export function validateWizardStep(context: StepValidationContext): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  switch (context.step) {
    case 1:
      return validateStep1(context.clientId ?? null);

    case 2: {
      const step2Result = validateStep2(
        context.selectedItemIds ?? [],
        {}, // itemReasonCodes would need to be passed
        context.step?.toString()
      );
      allErrors.push(...step2Result.errors);
      allWarnings.push(...step2Result.warnings);
      break;
    }

    case 3: {
      const step3Result = validateStep3(
        context.selectedBureaus ?? [],
        context.disputeRound ?? 1
      );
      allErrors.push(...step3Result.errors);
      allWarnings.push(...step3Result.warnings);
      break;
    }

    case 4: {
      const step4Result = validateStep4(context.generatedLetters);
      allErrors.push(...step4Result.errors);
      allWarnings.push(...step4Result.warnings);
      break;
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Get required evidence for a set of reason codes
 * Returns specific documentation needed
 */
export function getRequiredEvidenceForReasonCodes(codes: string[]): {
  blockingRequired: string[];
  stronglyRecommended: string[];
  helpful: string[];
  summary: string;
} {
  const blockingRequired: string[] = [];
  const stronglyRecommended: string[] = [];
  const helpful: string[] = [];

  for (const code of codes) {
    if (code === 'identity_theft') {
      blockingRequired.push('Police Report or FTC Identity Theft Report (IdentityTheft.gov)');
    } else if (code === 'not_mine') {
      blockingRequired.push('Government ID (Driver\'s License or Passport)');
    } else if (code === 'mixed_file') {
      blockingRequired.push('Government ID and proof of correct identity');
    } else if (code === 'paid_collection') {
      stronglyRecommended.push('Payment Receipt, Bank Statement, or Settlement Letter');
    } else if (code === 'never_late') {
      stronglyRecommended.push('Payment History showing all on-time payments');
    } else if (code === 'closed_by_consumer') {
      stronglyRecommended.push('Account Closure Confirmation Letter');
    } else {
      helpful.push(`Supporting documentation for "${code}" dispute`);
    }
  }

  let summary = '';
  if (blockingRequired.length > 0) {
    summary = `BLOCKING: This dispute type requires evidence - ${blockingRequired.join(', ')}`;
  } else if (stronglyRecommended.length > 0) {
    summary = `RECOMMENDED: Adding evidence will significantly strengthen this dispute - ${stronglyRecommended.join(', ')}`;
  } else {
    summary = 'Evidence not required, but supporting documents strengthen the dispute';
  }

  return {
    blockingRequired,
    stronglyRecommended,
    helpful,
    summary,
  };
}

/**
 * Check if a specific dispute reason code is high-risk
 */
export function isHighRiskCode(code: string): boolean {
  return HIGH_RISK_CODES.has(code);
}

/**
 * Check if a specific dispute reason code is medium-risk
 */
export function isMediumRiskCode(code: string): boolean {
  return MEDIUM_RISK_CODES.has(code);
}

/**
 * Get risk level for a list of codes
 */
export function getDisputeRiskLevel(
  codes: string[]
): 'high' | 'medium' | 'low' {
  if (codes.some((code) => isHighRiskCode(code))) {
    return 'high';
  }
  if (codes.some((code) => isMediumRiskCode(code))) {
    return 'medium';
  }
  return 'low';
}

/**
 * Can proceed to next step check
 * Returns true if current step validation passes
 */
export function canProceedToNextStep(context: StepValidationContext): boolean {
  const result = validateWizardStep(context);
  return result.isValid;
}

/**
 * Get specific error messages for Step 2 item validation
 */
export function getStep2ItemErrors(
  itemId: string,
  reasonCodes: string[] | undefined,
  itemData?: { creditor_name?: string }
): string[] {
  const errors: string[] = [];

  if (!reasonCodes || reasonCodes.length === 0) {
    const itemName = itemData?.creditor_name || 'Item';
    errors.push(`${itemName}: Select at least one dispute reason code`);
  }

  if (reasonCodes && reasonCodes.length > 3) {
    errors.push(`Item: Too many reason codes (${reasonCodes.length}) - limit to 3 for focused disputes`);
  }

  return errors;
}
