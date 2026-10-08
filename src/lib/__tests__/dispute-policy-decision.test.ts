import { describe, expect, it } from 'vitest';
import { decideDisputePolicy, evaluateDisputePolicy, hasStoredEvidencePacket } from '@/lib/dispute-policy-decision';

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

describe('decideDisputePolicy', () => {
  it('approves ordinary claims and unions their reason codes and evidence', () => {
    expect(decideDisputePolicy({
      reasonCodes: ['verification_required', 'inaccurate_reporting', 'verification_required'],
      hasEvidencePacket: false,
      hasClientFactualConfirmation: false,
    })).toEqual({
      approved: true,
      reasonCodes: ['verification_required', 'inaccurate_reporting'],
      requiredEvidence: ['identity_document', 'proof_of_address'],
      claimRisk: 'ordinary',
      targetRecipient: 'bureau',
      violations: [],
    });
  });

  it('is high risk and refused when any claim is high risk without evidence and confirmation', () => {
    expect(decideDisputePolicy({
      reasonCodes: ['verification_required', 'not_mine'],
      hasEvidencePacket: false,
      hasClientFactualConfirmation: false,
    })).toEqual({
      approved: false,
      reasonCodes: ['verification_required', 'not_mine'],
      requiredEvidence: ['identity_document', 'proof_of_address', 'claim_specific_evidence'],
      claimRisk: 'high',
      targetRecipient: 'bureau',
      violations: [
        'High-risk claims require claim-specific evidence.',
        'High-risk claims require explicit client factual confirmation.',
      ],
    });
  });

  it('approves a high-risk claim with evidence and client confirmation', () => {
    const decision = decideDisputePolicy({ reasonCodes: ['identity_theft'], hasEvidencePacket: true, hasClientFactualConfirmation: true });
    expect(decision).toMatchObject({ approved: true, claimRisk: 'high', violations: [] });
  });

  it('refuses a request with no reason codes', () => {
    expect(decideDisputePolicy({ reasonCodes: [], hasEvidencePacket: true, hasClientFactualConfirmation: true })).toMatchObject({
      approved: false,
      violations: ['At least one dispute reason code is required.'],
    });
  });
});

describe('hasStoredEvidencePacket', () => {
  it('reads persisted evidence document ID JSON', () => {
    expect(hasStoredEvidencePacket(JSON.stringify(['doc-1']))).toBe(true);
    expect(hasStoredEvidencePacket('[]')).toBe(false);
    expect(hasStoredEvidencePacket(null)).toBe(false);
    expect(hasStoredEvidencePacket('not json')).toBe(false);
  });
});
