export type ClaimRisk = 'ordinary' | 'high';
export type TargetRecipient = 'bureau' | 'furnisher' | 'collector' | 'creditor';

export interface DisputePolicyInput {
  claimType: string;
  bureau?: string | null;
  itemType?: string | null;
  hasEvidencePacket: boolean;
  hasClientFactualConfirmation: boolean;
}

export interface DisputePolicyDecision {
  approved: boolean;
  reasonCodes: string[];
  requiredEvidence: string[];
  claimRisk: ClaimRisk;
  targetRecipient: TargetRecipient;
  violations: string[];
}

const HIGH_RISK_CLAIM_TYPES = new Set([
  'identity_theft',
  'fraud',
  'not_mine',
  'never_late',
  'unauthorized_inquiry',
]);

export function evaluateDisputePolicy(input: DisputePolicyInput): DisputePolicyDecision {
  const isHighRisk = HIGH_RISK_CLAIM_TYPES.has(input.claimType);
  const requiredEvidence = ['identity_document', 'proof_of_address'];
  const violations: string[] = [];

  if (isHighRisk) {
    requiredEvidence.push('claim_specific_evidence');

    if (!input.hasEvidencePacket) {
      violations.push('High-risk claims require claim-specific evidence.');
    }

    if (!input.hasClientFactualConfirmation) {
      violations.push('High-risk claims require explicit client factual confirmation.');
    }
  }

  return {
    approved: violations.length === 0,
    reasonCodes: [input.claimType],
    requiredEvidence,
    claimRisk: isHighRisk ? 'high' : 'ordinary',
    targetRecipient: 'bureau',
    violations,
  };
}
