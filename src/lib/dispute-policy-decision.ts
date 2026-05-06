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

function sameStringSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
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

export function approvedPolicyMatchesDisputeInputs(params: {
  policyDecision: DisputePolicyDecision | null | undefined;
  reasonCodes: string[];
  evidenceDocumentIds?: string[] | null;
  clientConfirmedOwnershipClaims?: boolean;
}) {
  if (!params.policyDecision?.approved) return false;

  const reasonCodes = params.reasonCodes.filter(Boolean);
  if (!sameStringSet(params.policyDecision.reasonCodes, reasonCodes)) return false;

  const hasEvidencePacket = Array.isArray(params.evidenceDocumentIds) && params.evidenceDocumentIds.length > 0;
  const hasClientFactualConfirmation = params.clientConfirmedOwnershipClaims === true;
  const decisions = reasonCodes.map((claimType) => evaluateDisputePolicy({
    claimType,
    hasEvidencePacket,
    hasClientFactualConfirmation,
  }));

  if (decisions.some((decision) => !decision.approved)) return false;

  const requiredEvidence = Array.from(new Set(decisions.flatMap((decision) => decision.requiredEvidence)));
  const claimRisk: ClaimRisk = decisions.some((decision) => decision.claimRisk === 'high') ? 'high' : 'ordinary';

  return (
    params.policyDecision.claimRisk === claimRisk &&
    sameStringSet(params.policyDecision.requiredEvidence, requiredEvidence) &&
    params.policyDecision.targetRecipient === 'bureau'
  );
}
