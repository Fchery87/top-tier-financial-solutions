/**
 * P3.6: Letter Strength Calculator
 *
 * Standalone utility for calculating dispute letter quality scores.
 * This file has no server-side dependencies and can be imported on the client side.
 */

export interface AIAnalysisResultForScore {
  metro2Violations: string[];
  fcraIssues: string[];
  confidence: number;
}

/**
 * Letter strength score breakdown
 * Total max: 10 points
 */
export interface LetterStrengthScore {
  overallScore: number; // 0-10
  violationScore: number; // 0-3
  citationScore: number; // 0-2
  evidenceScore: number; // 0-1.5
  confidenceScore: number; // 0-1.5
  escalationScore: number; // 0-1
  methodologyScore: number; // 0-1
  suggestions: string[];
}

/**
 * Calculate letter strength score based on multiple factors
 * Score range: 0-10
 * Factors:
 * - Metro 2 violations found (0-3 points)
 * - FCRA citations (0-2 points)
 * - Evidence documents attached (0-1.5 points)
 * - Analysis confidence (0-1.5 points)
 * - Dispute round/escalation (0-1 point)
 * - Methodology strength (0-1 point)
 */
export function calculateLetterStrength(
  analyses: AIAnalysisResultForScore[],
  hasEvidenceDocuments: boolean,
  evidenceDocumentCount: number = 0,
  disputeRound: number = 1,
  methodology: string = 'factual'
): LetterStrengthScore {
  const suggestions: string[] = [];
  let violationScore = 0;
  let citationScore = 0;
  let evidenceScore = 0;
  let confidenceScore = 0;
  let escalationScore = 0;
  let methodologyScore = 0;

  // ---- VIOLATION SCORE (0-3 points) ----
  const totalViolations = analyses.reduce((sum, a) => sum + a.metro2Violations.length, 0);

  if (totalViolations === 0) {
    violationScore = 0;
    suggestions.push('No Metro 2 violations detected - consider reviewing item for different dispute angles');
  } else if (totalViolations === 1) {
    violationScore = 1;
    suggestions.push('Found 1 violation - consider if additional issues can be identified');
  } else if (totalViolations <= 3) {
    violationScore = 2;
  } else if (totalViolations <= 5) {
    violationScore = 2.5;
  } else {
    violationScore = 3;
    suggestions.push(`Excellent: Found ${totalViolations} Metro 2 violations - strong factual basis for dispute`);
  }

  // ---- CITATION SCORE (0-2 points) ----
  const totalCitations = analyses.reduce((sum, a) => sum + a.fcraIssues.length, 0);

  if (totalCitations === 0) {
    citationScore = 0.5; // Some base credit for analysis
    suggestions.push('No FCRA citations found - verify dispute reasoning');
  } else if (totalCitations === 1) {
    citationScore = 1;
  } else if (totalCitations <= 3) {
    citationScore = 1.5;
  } else {
    citationScore = 2;
    suggestions.push(`Strong: ${totalCitations} FCRA violations cited - excellent legal foundation`);
  }

  // ---- EVIDENCE SCORE (0-1.5 points) ----
  if (!hasEvidenceDocuments) {
    evidenceScore = 0;
    suggestions.push('No evidence documents attached - consider uploading supporting documentation');
  } else if (evidenceDocumentCount === 1) {
    evidenceScore = 0.75;
    suggestions.push('1 evidence document attached - consider adding more supporting materials');
  } else if (evidenceDocumentCount <= 3) {
    evidenceScore = 1;
  } else {
    evidenceScore = 1.5;
    suggestions.push(`Excellent: ${evidenceDocumentCount} evidence documents - strong evidentiary basis`);
  }

  // ---- CONFIDENCE SCORE (0-1.5 points) ----
  const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / (analyses.length || 1);

  if (avgConfidence < 0.4) {
    confidenceScore = 0;
    suggestions.push('Low confidence in analysis - verify data accuracy');
  } else if (avgConfidence < 0.6) {
    confidenceScore = 0.5;
    suggestions.push('Moderate confidence - consider additional verification');
  } else if (avgConfidence < 0.75) {
    confidenceScore = 1;
  } else if (avgConfidence < 0.9) {
    confidenceScore = 1.25;
  } else {
    confidenceScore = 1.5;
  }

  // ---- ESCALATION SCORE (0-1 point) ----
  if (disputeRound === 1) {
    escalationScore = 0;
    suggestions.push('First dispute round - subsequent disputes can strengthen case');
  } else if (disputeRound === 2) {
    escalationScore = 0.5;
    suggestions.push('Round 2 dispute - demanding method of verification');
  } else {
    escalationScore = 1;
    suggestions.push('Round 3+ dispute - maximum escalation under FCRA');
  }

  // ---- METHODOLOGY SCORE (0-1 point) ----
  const methodologyScores: Record<string, number> = {
    'consumer_law': 1.0,
    'method_of_verification': 0.8,
    'debt_validation': 0.7,
    'metro2_compliance': 0.6,
    'factual': 0.5,
  };
  methodologyScore = methodologyScores[methodology] || 0.5;

  if (methodology === 'consumer_law') {
    suggestions.push('Consumer law approach - powerful for willful non-compliance claims');
  }

  // ---- CALCULATE OVERALL SCORE ----
  const overallScore = Math.min(
    violationScore + citationScore + evidenceScore + confidenceScore + escalationScore + methodologyScore,
    10
  );

  // Remove duplicate suggestions
  const uniqueSuggestions = [...new Set(suggestions)];

  return {
    overallScore: Math.round(overallScore * 10) / 10, // Round to 1 decimal
    violationScore,
    citationScore,
    evidenceScore,
    confidenceScore,
    escalationScore,
    methodologyScore,
    suggestions: uniqueSuggestions,
  };
}
