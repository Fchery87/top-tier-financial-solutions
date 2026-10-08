import { describe, expect, it } from 'vitest';
import { deriveEvidencePacketState, verifyEvidencePacket } from '@/lib/dispute-evidence';

describe('verifyEvidencePacket', () => {
  it('requires claim-specific evidence and explicit client factual confirmation for high-risk claims', () => {
    expect(verifyEvidencePacket({
      claimType: 'identity_theft',
      documentIds: [],
      confirmations: [],
    })).toMatchObject({
      sufficient: false,
      hasClaimSpecificEvidence: false,
      hasClientFactualConfirmation: false,
      violations: [
        'High-risk claims require claim-specific evidence.',
        'High-risk claims require explicit client factual confirmation.',
      ],
    });

    expect(verifyEvidencePacket({
      claimType: 'identity_theft',
      documentIds: ['doc-1'],
      confirmations: [{ key: 'client_factual_claim_confirmed', confirmed: true }],
    })).toMatchObject({
      sufficient: true,
      hasClaimSpecificEvidence: true,
      hasClientFactualConfirmation: true,
      violations: [],
    });
  });
});

describe('deriveEvidencePacketState', () => {
  it('waits for client confirmation on a high-risk claim without that confirmation', () => {
    expect(deriveEvidencePacketState({
      claimType: 'identity_theft',
      confirmations: [{ key: 'client_authorized_review', confirmed: true }],
    })).toEqual({ kind: 'awaiting_client_confirmation' });
  });

  it('is complete once the factual confirmation is stored or the claim is ordinary', () => {
    expect(deriveEvidencePacketState({
      claimType: 'never_late',
      confirmations: [{ key: 'client_factual_claim_confirmed', confirmed: true }],
    })).toEqual({ kind: 'complete' });

    expect(deriveEvidencePacketState({
      claimType: 'verification_required',
      confirmations: [],
    })).toEqual({ kind: 'complete' });
  });
});
