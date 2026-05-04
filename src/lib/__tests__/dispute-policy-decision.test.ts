import { describe, expect, it } from 'vitest';
import { evaluateDisputePolicy } from '@/lib/dispute-policy-decision';

describe('evaluateDisputePolicy', () => {
  it('approves an ordinary verification dispute without AI policy decisions', () => {
    const decision = evaluateDisputePolicy({
      claimType: 'verification_required',
      bureau: 'experian',
      itemType: 'collection',
      hasEvidencePacket: true,
      hasClientFactualConfirmation: false,
    });

    expect(decision).toEqual({
      approved: true,
      reasonCodes: ['verification_required'],
      requiredEvidence: ['identity_document', 'proof_of_address'],
      claimRisk: 'ordinary',
      targetRecipient: 'bureau',
      violations: [],
    });
  });

  it('blocks a high-risk factual claim until evidence and explicit client confirmation exist', () => {
    const decision = evaluateDisputePolicy({
      claimType: 'identity_theft',
      bureau: 'equifax',
      itemType: 'inquiry',
      hasEvidencePacket: false,
      hasClientFactualConfirmation: false,
    });

    expect(decision).toEqual({
      approved: false,
      reasonCodes: ['identity_theft'],
      requiredEvidence: ['identity_document', 'proof_of_address', 'claim_specific_evidence'],
      claimRisk: 'high',
      targetRecipient: 'bureau',
      violations: [
        'High-risk claims require claim-specific evidence.',
        'High-risk claims require explicit client factual confirmation.',
      ],
    });
  });

  it('approves a high-risk factual claim when evidence and explicit client confirmation exist', () => {
    const decision = evaluateDisputePolicy({
      claimType: 'identity_theft',
      bureau: 'equifax',
      itemType: 'inquiry',
      hasEvidencePacket: true,
      hasClientFactualConfirmation: true,
    });

    expect(decision).toEqual({
      approved: true,
      reasonCodes: ['identity_theft'],
      requiredEvidence: ['identity_document', 'proof_of_address', 'claim_specific_evidence'],
      claimRisk: 'high',
      targetRecipient: 'bureau',
      violations: [],
    });
  });
});
