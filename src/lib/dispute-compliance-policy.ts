const HIGH_RISK_REASON_CODES = new Set([
  'identity_theft',
  'not_mine',
  'never_late',
  'mixed_file',
]);

export interface DisputeComplianceInput {
  reasonCodes: string[];
  evidenceDocumentIds?: string[] | null;
  clientConfirmedOwnershipClaims?: boolean;
}

export interface DisputeComplianceResult {
  isCompliant: boolean;
  violations: string[];
  warnings: string[];
}

export function evaluateDisputeCompliance(
  input: DisputeComplianceInput
): DisputeComplianceResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  const reasonCodes = input.reasonCodes || [];

  const highRiskCodes = reasonCodes.filter((code) =>
    HIGH_RISK_REASON_CODES.has(code)
  );

  if (highRiskCodes.length > 0) {
    const hasEvidence =
      Array.isArray(input.evidenceDocumentIds) &&
      input.evidenceDocumentIds.length > 0;

    if (!hasEvidence) {
      violations.push(
        `High-risk reason codes require evidence attachments: ${highRiskCodes.join(', ')}`
      );
    }

    if (input.clientConfirmedOwnershipClaims !== true) {
      violations.push(
        'Ownership/identity-related claims require explicit client confirmation before letter generation.'
      );
    }
  }

  if (reasonCodes.length === 0) {
    violations.push('At least one dispute reason code is required.');
  }

  if (reasonCodes.includes('obsolete')) {
    warnings.push(
      'Obsolescence claims should be verified against FCRA timing data before sending.'
    );
  }

  return {
    isCompliant: violations.length === 0,
    violations,
    warnings,
  };
}

export function getHighRiskReasonCodes(): readonly string[] {
  return Array.from(HIGH_RISK_REASON_CODES);
}
