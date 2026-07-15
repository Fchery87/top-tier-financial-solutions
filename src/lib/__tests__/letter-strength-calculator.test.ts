import { describe, expect, it } from 'vitest';
import { calculateLetterStrength } from '@/lib/letter-strength-calculator';

describe('calculateLetterStrength', () => {
  const analyses = [{
    metro2Violations: ['balance mismatch'],
    fcraIssues: ['FCRA § 607(b)'],
    confidence: 0.8,
  }];

  it('does not award more escalation score solely for later rounds', () => {
    const roundOne = calculateLetterStrength(analyses, false, 0, 1, 'factual');
    const roundThree = calculateLetterStrength(analyses, false, 0, 3, 'factual');

    expect(roundThree.escalationScore).toBe(roundOne.escalationScore);
    expect(roundThree.overallScore).toBe(roundOne.overallScore);
  });
});
