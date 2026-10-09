import { describe, expect, it } from 'vitest';
import { HIGH_RISK_CLAIM_TYPES } from '@/lib/dispute-evidence';
import { evaluateDisputePolicy } from '@/lib/dispute-policy-decision';
import { isHighRiskCode, validateEvidenceRequirements } from '@/lib/dispute-wizard-validation';

const REGISTRY = ['identity_theft', 'fraud', 'not_mine', 'never_late', 'unauthorized_inquiry', 'mixed_file'];
const ORDINARY = ['verification_required', 'inaccurate_reporting', 'metro2_violation', 'obsolete', 'paid_collection'];

describe('high-risk claim registry', () => {
  it('is exactly the six high-risk claim types', () => {
    expect([...HIGH_RISK_CLAIM_TYPES].sort()).toEqual([...REGISTRY].sort());
  });

  it('is the list the server policy uses', () => {
    for (const code of REGISTRY) {
      expect(evaluateDisputePolicy({ claimType: code, hasEvidencePacket: false, hasClientFactualConfirmation: false }).claimRisk).toBe('high');
    }
    for (const code of ORDINARY) {
      expect(evaluateDisputePolicy({ claimType: code, hasEvidencePacket: false, hasClientFactualConfirmation: false }).claimRisk).toBe('ordinary');
    }
  });

  it('is the list the wizard validation uses', () => {
    expect(REGISTRY.filter(isHighRiskCode)).toEqual(REGISTRY);
    expect(ORDINARY.filter(isHighRiskCode)).toEqual([]);
    for (const code of REGISTRY) {
      expect(validateEvidenceRequirements([code], []).isValid).toBe(false);
    }
  });

  it('gives staff no override for a high-risk claim in the wizard', () => {
    expect(validateEvidenceRequirements(['not_mine'], []).canOverride).toBe(false);
  });
});
