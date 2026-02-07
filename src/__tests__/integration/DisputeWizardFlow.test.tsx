import { describe, it, expect } from 'vitest';
import {
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateEvidenceRequirements,
  getRequiredEvidenceForReasonCodes,
  isHighRiskCode,
  isMediumRiskCode,
  getDisputeRiskLevel,
} from '@/lib/dispute-wizard-validation';
import { calculateLetterStrength } from '@/lib/letter-strength-calculator';

/**
 * Integration tests for Dispute Wizard Flow
 * Tests the complete wizard workflow validation logic
 *
 * Coverage areas:
 * - Validation logic for all 4 steps
 * - Evidence requirement validation
 * - Letter strength calculation
 * - High-risk code detection
 * - Complete wizard flow scenarios
 * - Edge cases and error conditions
 */

describe('DisputeWizard Integration - Step Validation', () => {
  describe('Step 1: Client Selection Validation', () => {
    it('should pass validation when client is selected', () => {
      const result = validateStep1('client-1');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when no client is selected', () => {
      const result = validateStep1(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please select a client to proceed');
    });

    it('should fail validation when client ID is empty string', () => {
      const result = validateStep1('');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when client ID is whitespace', () => {
      const result = validateStep1('   ');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Step 2: Item Selection Validation', () => {
    it('should pass validation when items are selected with reason codes', () => {
      const selectedItemIds = ['item-1', 'item-2'];
      const itemReasonCodes = {
        'item-1': ['not_mine'],
        'item-2': ['verification_required'],
      };

      const result = validateStep2(selectedItemIds, itemReasonCodes);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when no items are selected', () => {
      const result = validateStep2([], {});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please select at least one item to dispute');
    });

    it('should fail validation when item missing reason codes', () => {
      const selectedItemIds = ['item-1', 'item-2'];
      const itemReasonCodes = {
        'item-1': ['not_mine'],
        'item-2': [],
      };

      const result = validateStep2(selectedItemIds, itemReasonCodes);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('item-2'))).toBe(true);
    });

    it('should warn when too many reason codes (>3)', () => {
      const selectedItemIds = ['item-1'];
      const itemReasonCodes = {
        'item-1': ['not_mine', 'verification_required', 'metro2_violation', 'inaccurate_reporting'],
      };

      const result = validateStep2(selectedItemIds, itemReasonCodes);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('focusing on 1-3');
    });

    it('should handle items with no reason codes entry', () => {
      const selectedItemIds = ['item-1'];
      const itemReasonCodes = {};

      const result = validateStep2(selectedItemIds, itemReasonCodes);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Step 3: Configuration Validation', () => {
    it('should pass validation when all required fields are filled', () => {
      const result = validateStep3(['transunion', 'experian'], 1);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when no bureaus are selected', () => {
      const result = validateStep3([], 1);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please select at least one credit bureau to send disputes to');
    });

    it('should fail validation when round is 0', () => {
      const result = validateStep3(['transunion'], 0);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dispute round must be between 1 and 3');
    });

    it('should fail validation when round is greater than 3', () => {
      const result = validateStep3(['transunion'], 4);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Dispute round must be between 1 and 3');
    });

    it('should warn for Round 3 (regulatory escalation)', () => {
      const result = validateStep3(['transunion'], 3);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Round 3');
    });

    it('should accept all three bureaus', () => {
      const result = validateStep3(['transunion', 'experian', 'equifax'], 1);

      expect(result.isValid).toBe(true);
    });
  });

  describe('Step 4: Review Validation', () => {
    it('should pass validation when letters are generated', () => {
      const letters = [
        { id: 'letter-1', content: 'Dear Credit Bureau...' },
      ];

      const result = validateStep4(letters);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when no letters generated', () => {
      const result = validateStep4(undefined);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No dispute letters have been generated yet');
    });

    it('should fail validation when letters array is empty', () => {
      const result = validateStep4([]);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when letter has no content', () => {
      const letters = [
        { id: 'letter-1', content: '' },
      ];

      const result = validateStep4(letters);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('no content'))).toBe(true);
    });

    it('should fail validation when letter has only whitespace', () => {
      const letters = [
        { id: 'letter-1', content: '   ' },
      ];

      const result = validateStep4(letters);

      expect(result.isValid).toBe(false);
    });
  });
});

describe('DisputeWizard Integration - Evidence Validation', () => {
  describe('High-Risk Code Detection', () => {
    it('should identify identity_theft as high-risk', () => {
      const result = isHighRiskCode('identity_theft');
      expect(result).toBe(true);
    });

    it('should identify not_mine as high-risk', () => {
      const result = isHighRiskCode('not_mine');
      expect(result).toBe(true);
    });

    it('should identify mixed_file as high-risk', () => {
      const result = isHighRiskCode('mixed_file');
      expect(result).toBe(true);
    });

    it('should not identify factual disputes as high-risk', () => {
      const result = isHighRiskCode('verification_required');
      expect(result).toBe(false);
    });

    it('should not identify metro2_violation as high-risk', () => {
      const result = isHighRiskCode('metro2_violation');
      expect(result).toBe(false);
    });
  });

  describe('Medium-Risk Code Detection', () => {
    it('should identify paid_collection as medium-risk', () => {
      const result = isMediumRiskCode('paid_collection');
      expect(result).toBe(true);
    });

    it('should identify never_late as medium-risk', () => {
      const result = isMediumRiskCode('never_late');
      expect(result).toBe(true);
    });

    it('should not identify factual codes as medium-risk', () => {
      const result = isMediumRiskCode('verification_required');
      expect(result).toBe(false);
    });
  });

  describe('Risk Level Detection', () => {
    it('should return high for high-risk codes', () => {
      const result = getDisputeRiskLevel(['identity_theft', 'verification_required']);
      expect(result).toBe('high');
    });

    it('should return medium for medium-risk codes only', () => {
      const result = getDisputeRiskLevel(['paid_collection', 'verification_required']);
      expect(result).toBe('medium');
    });

    it('should return low for no risk codes', () => {
      const result = getDisputeRiskLevel(['verification_required', 'metro2_violation']);
      expect(result).toBe('low');
    });
  });

  describe('Required Evidence Detection', () => {
    it('should require evidence for identity theft', () => {
      const result = getRequiredEvidenceForReasonCodes(['identity_theft']);

      expect(result.blockingRequired.length).toBeGreaterThan(0);
      expect(result.blockingRequired[0]).toContain('Police Report');
    });

    it('should require evidence for not_mine', () => {
      const result = getRequiredEvidenceForReasonCodes(['not_mine']);

      expect(result.blockingRequired.length).toBeGreaterThan(0);
      expect(result.blockingRequired[0]).toContain('Government ID');
    });

    it('should not require evidence for verification requests', () => {
      const result = getRequiredEvidenceForReasonCodes(['verification_required']);

      expect(result.blockingRequired).toHaveLength(0);
    });

    it('should recommend evidence for medium-risk codes', () => {
      const result = getRequiredEvidenceForReasonCodes(['paid_collection']);

      expect(result.stronglyRecommended.length).toBeGreaterThan(0);
    });

    it('should provide summary for high-risk codes', () => {
      const result = getRequiredEvidenceForReasonCodes(['identity_theft']);

      expect(result.summary).toContain('BLOCKING');
    });
  });

  describe('Evidence Requirement Validation', () => {
    it('should fail validation when high-risk code has no evidence', () => {
      const result = validateEvidenceRequirements(['identity_theft'], []);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.blockingReasons.length).toBeGreaterThan(0);
    });

    it('should pass validation when high-risk code has evidence', () => {
      const result = validateEvidenceRequirements(['identity_theft'], ['doc-1']);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow low-risk codes without evidence', () => {
      const result = validateEvidenceRequirements(['verification_required'], []);

      expect(result.isValid).toBe(true);
    });

    it('should warn for medium-risk codes without evidence', () => {
      const result = validateEvidenceRequirements(['paid_collection'], []);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should allow admin override for high-risk codes', () => {
      const result = validateEvidenceRequirements(['identity_theft'], []);

      expect(result.canOverride).toBe(true);
    });
  });
});

describe('DisputeWizard Integration - Letter Strength Calculation', () => {
  describe('Letter Strength Scoring', () => {
    it('should calculate high strength for letters with Metro 2 violations', () => {
      const analyses = [
        {
          metro2Violations: ['Missing DOFD', 'Invalid Status Code', 'Balance Mismatch'],
          fcraIssues: ['Section 611 violation', 'Section 623 violation'],
          confidence: 0.9,
        },
      ];

      const result = calculateLetterStrength(analyses, true, 2, 1, 'metro2_compliance');

      expect(result.overallScore).toBeGreaterThanOrEqual(6);
      expect(result.violationScore).toBeGreaterThan(0);
    });

    it('should calculate medium strength for basic factual disputes', () => {
      const analyses = [
        {
          metro2Violations: [],
          fcraIssues: ['Section 611 violation'],
          confidence: 0.7,
        },
      ];

      const result = calculateLetterStrength(analyses, false, 0, 1, 'factual');

      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThan(7);
    });

    it('should calculate low strength for weak disputes', () => {
      const analyses = [
        {
          metro2Violations: [],
          fcraIssues: [],
          confidence: 0.4,
        },
      ];

      const result = calculateLetterStrength(analyses, false, 0, 1, 'factual');

      expect(result.overallScore).toBeLessThan(4);
    });

    it('should provide improvement suggestions for low-scoring letters', () => {
      const analyses = [
        {
          metro2Violations: [],
          fcraIssues: [],
          confidence: 0.3,
        },
      ];

      const result = calculateLetterStrength(analyses, false, 0, 1, 'factual');

      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should award points for evidence documents', () => {
      const analyses = [{
        metro2Violations: ['Violation 1'],
        fcraIssues: ['Issue 1'],
        confidence: 0.8,
      }];

      const withEvidence = calculateLetterStrength(analyses, true, 3, 1, 'factual');
      const withoutEvidence = calculateLetterStrength(analyses, false, 0, 1, 'factual');

      expect(withEvidence.evidenceScore).toBeGreaterThan(withoutEvidence.evidenceScore);
      expect(withEvidence.overallScore).toBeGreaterThan(withoutEvidence.overallScore);
    });

    it('should award escalation points for higher rounds', () => {
      const analyses = [{
        metro2Violations: ['Violation 1'],
        fcraIssues: ['Issue 1'],
        confidence: 0.8,
      }];

      const round1 = calculateLetterStrength(analyses, true, 1, 1, 'factual');
      const round3 = calculateLetterStrength(analyses, true, 1, 3, 'factual');

      expect(round3.escalationScore).toBeGreaterThan(round1.escalationScore);
    });

    it('should score different methodologies appropriately', () => {
      const analyses = [{
        metro2Violations: ['Violation 1'],
        fcraIssues: ['Issue 1'],
        confidence: 0.8,
      }];

      const consumerLaw = calculateLetterStrength(analyses, true, 1, 1, 'consumer_law');
      const factual = calculateLetterStrength(analyses, true, 1, 1, 'factual');

      expect(consumerLaw.methodologyScore).toBeGreaterThan(factual.methodologyScore);
    });
  });

  describe('Letter Strength Breakdown', () => {
    it('should provide detailed score breakdown', () => {
      const analyses = [{
        metro2Violations: ['Violation 1', 'Violation 2'],
        fcraIssues: ['Issue 1'],
        confidence: 0.85,
      }];

      const result = calculateLetterStrength(analyses, true, 1, 2, 'metro2_compliance');

      expect(result.violationScore).toBeGreaterThan(0);
      expect(result.citationScore).toBeGreaterThan(0);
      expect(result.evidenceScore).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.escalationScore).toBeGreaterThan(0);
      expect(result.methodologyScore).toBeGreaterThan(0);
    });

    it('should cap overall score at 10', () => {
      const analyses = [{
        metro2Violations: Array(20).fill('Violation'),
        fcraIssues: Array(20).fill('Issue'),
        confidence: 1.0,
      }];

      const result = calculateLetterStrength(analyses, true, 10, 3, 'consumer_law');

      expect(result.overallScore).toBeLessThanOrEqual(10);
    });

    it('should handle multiple analyses and average confidence', () => {
      const analyses = [
        {
          metro2Violations: ['Violation 1'],
          fcraIssues: ['Issue 1'],
          confidence: 0.9,
        },
        {
          metro2Violations: ['Violation 2'],
          fcraIssues: ['Issue 2'],
          confidence: 0.7,
        },
      ];

      const result = calculateLetterStrength(analyses, true, 1, 1, 'factual');

      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeGreaterThan(0);
    });
  });
});

describe('DisputeWizard Integration - Complete Workflow Scenarios', () => {
  describe('Scenario: Simple Factual Dispute', () => {
    it('should validate complete workflow for factual dispute', () => {
      // Step 1: Client selected
      const step1 = validateStep1('client-1');
      expect(step1.isValid).toBe(true);

      // Step 2: Item selected with reason code
      const step2 = validateStep2(['item-1'], { 'item-1': ['verification_required'] });
      expect(step2.isValid).toBe(true);

      // Step 3: Bureau and round configured
      const step3 = validateStep3(['transunion'], 1);
      expect(step3.isValid).toBe(true);

      // Step 4: Letter generated
      const step4 = validateStep4([{ id: 'letter-1', content: 'Dear Credit Bureau...' }]);
      expect(step4.isValid).toBe(true);

      // Evidence validation (should pass - no evidence required)
      const evidence = validateEvidenceRequirements(['verification_required'], []);
      expect(evidence.isValid).toBe(true);
    });
  });

  describe('Scenario: Identity Theft with Evidence', () => {
    it('should validate complete workflow for identity theft dispute with evidence', () => {
      const step1 = validateStep1('client-1');
      const step2 = validateStep2(['item-1'], { 'item-1': ['identity_theft'] });
      const step3 = validateStep3(['transunion', 'experian', 'equifax'], 1);
      const step4 = validateStep4([{ id: 'letter-1', content: 'Dear Credit Bureau...' }]);
      const evidence = validateEvidenceRequirements(['identity_theft'], ['doc-1', 'doc-2']);

      expect(step1.isValid).toBe(true);
      expect(step2.isValid).toBe(true);
      expect(step3.isValid).toBe(true);
      expect(step4.isValid).toBe(true);
      expect(evidence.isValid).toBe(true);
    });

    it('should fail validation for identity theft without evidence', () => {
      const evidence = validateEvidenceRequirements(['identity_theft'], []);

      expect(evidence.isValid).toBe(false);
      expect(evidence.blockingReasons.length).toBeGreaterThan(0);
    });
  });

  describe('Scenario: Metro 2 Compliance Dispute', () => {
    it('should validate workflow for Metro 2 compliance dispute', () => {
      const step1 = validateStep1('client-1');
      const step2 = validateStep2(['item-1', 'item-2'], {
        'item-1': ['metro2_violation'],
        'item-2': ['missing_dofd'],
      });
      const step3 = validateStep3(['transunion', 'experian'], 1);
      const step4 = validateStep4([
        { id: 'letter-1', content: 'Metro 2 violations...' },
        { id: 'letter-2', content: 'Missing DOFD...' },
      ]);

      expect(step1.isValid).toBe(true);
      expect(step2.isValid).toBe(true);
      expect(step3.isValid).toBe(true);
      expect(step4.isValid).toBe(true);
    });
  });

  describe('Scenario: Round 3 Escalation', () => {
    it('should validate round 3 escalation with warnings', () => {
      const step3 = validateStep3(['transunion'], 3);

      expect(step3.isValid).toBe(true);
      expect(step3.warnings.length).toBeGreaterThan(0);
      expect(step3.warnings[0]).toContain('Round 3');
    });
  });
});

describe('DisputeWizard Integration - Edge Cases', () => {
  it('should handle selecting all three bureaus', () => {
    const result = validateStep3(['transunion', 'experian', 'equifax'], 1);

    expect(result.isValid).toBe(true);
  });

  it('should handle many items', () => {
    const itemIds = Array.from({ length: 50 }, (_, i) => `item-${i}`);
    const reasonCodes: Record<string, string[]> = {};
    itemIds.forEach(id => {
      reasonCodes[id] = ['verification_required'];
    });

    const result = validateStep2(itemIds, reasonCodes);

    expect(result.isValid).toBe(true);
  });

  it('should handle multiple reason codes per item', () => {
    const result = validateStep2(['item-1'], {
      'item-1': ['metro2_violation', 'verification_required'],
    });

    expect(result.isValid).toBe(true);
  });

  it('should handle multiple high-risk codes', () => {
    const result = validateEvidenceRequirements(['identity_theft', 'not_mine'], ['doc-1']);

    expect(result.isValid).toBe(true);
  });

  it('should handle empty analyses for letter strength', () => {
    const result = calculateLetterStrength([], false, 0, 1, 'factual');

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(10);
  });

  it('should validate round boundaries', () => {
    const round0 = validateStep3(['transunion'], 0);
    const round1 = validateStep3(['transunion'], 1);
    const round3 = validateStep3(['transunion'], 3);
    const round4 = validateStep3(['transunion'], 4);

    expect(round0.isValid).toBe(false);
    expect(round1.isValid).toBe(true);
    expect(round3.isValid).toBe(true);
    expect(round4.isValid).toBe(false);
  });
});
