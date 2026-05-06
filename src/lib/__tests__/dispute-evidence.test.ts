import { describe, expect, it } from 'vitest';
import { verifyEvidencePacket } from '@/lib/dispute-evidence';

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
