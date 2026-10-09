import { HIGH_RISK_CLAIM_TYPES } from '@/lib/dispute-evidence';

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

export interface DisputePolicyRequest {
  reasonCodes: string[];
  hasEvidencePacket: boolean;
  hasClientFactualConfirmation: boolean;
}

export const MISSING_REASON_CODE_VIOLATION = 'At least one dispute reason code is required.';

/**
 * Decides dispute policy on the server for a whole request by aggregating the
 * per-claim decisions. Callers never supply the decision (ADR 0001).
 */
export function decideDisputePolicy(request: DisputePolicyRequest): DisputePolicyDecision {
  const reasonCodes = Array.from(new Set(request.reasonCodes.filter(Boolean)));
  const decisions = reasonCodes.map((claimType) => evaluateDisputePolicy({
    claimType,
    hasEvidencePacket: request.hasEvidencePacket,
    hasClientFactualConfirmation: request.hasClientFactualConfirmation,
  }));
  const violations = decisions.flatMap((decision) => decision.violations);
  if (reasonCodes.length === 0) violations.push(MISSING_REASON_CODE_VIOLATION);

  return {
    approved: violations.length === 0,
    reasonCodes,
    requiredEvidence: Array.from(new Set(
      decisions.length > 0
        ? decisions.flatMap((decision) => decision.requiredEvidence)
        : ['identity_document', 'proof_of_address'],
    )),
    claimRisk: decisions.some((decision) => decision.claimRisk === 'high') ? 'high' : 'ordinary',
    targetRecipient: 'bureau',
    violations,
  };
}
