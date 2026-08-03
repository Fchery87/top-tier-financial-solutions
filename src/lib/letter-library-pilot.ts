import type { Selection, SelectionRequest } from '@/lib/letter-library-selector';

export interface PilotScenario {
  name: string;
  request: SelectionRequest;
  expectedMethodology?: string;
  allowFallback: boolean;
}

export const LETTER_LIBRARY_PILOT_SCENARIOS: readonly PilotScenario[] = [
  {
    name: 'bureau-round-1-factual',
    request: {
      round: 1,
      targetRecipient: 'bureau',
      bureau: 'transunion',
      itemType: 'collection',
      reasonCodes: ['verification_required'],
      methodology: 'factual',
    },
    expectedMethodology: 'factual',
    allowFallback: false,
  },
  {
    name: 'bureau-round-2-method-of-verification',
    request: {
      round: 2,
      targetRecipient: 'bureau',
      bureau: 'experian',
      itemType: 'collection',
      reasonCodes: ['request_verification_method'],
      methodology: 'method_of_verification',
    },
    expectedMethodology: 'method_of_verification',
    allowFallback: false,
  },
  {
    name: 'furnisher-round-3-escalation',
    request: {
      round: 3,
      targetRecipient: 'furnisher',
      bureau: 'equifax',
      itemType: 'charge_off',
      reasonCodes: ['inaccurate_reporting', 'fcra_non_compliance'],
      methodology: 'factual',
    },
    expectedMethodology: 'factual',
    allowFallback: true,
  },
  {
    name: 'collector-debt-validation',
    request: {
      round: 1,
      targetRecipient: 'collector',
      bureau: 'transunion',
      itemType: 'collection',
      reasonCodes: ['verification_required'],
      methodology: 'debt_validation',
    },
    expectedMethodology: 'debt_validation',
    allowFallback: false,
  },
  {
    name: 'creditor-goodwill',
    request: {
      round: 1,
      targetRecipient: 'creditor',
      bureau: 'experian',
      itemType: 'charge_off',
      reasonCodes: ['paid_collection'],
      methodology: 'goodwill',
    },
    expectedMethodology: 'goodwill',
    allowFallback: false,
  },
  {
    name: 'intentional-legacy-fallback',
    request: {
      round: 1,
      targetRecipient: 'pilot_unsupported_recipient',
      bureau: 'transunion',
      itemType: 'collection',
      reasonCodes: ['verification_required'],
    },
    allowFallback: true,
  },
];

export interface PilotScenarioResult {
  scenario: string;
  status: 'pass' | 'fallback' | 'fail';
  selectedLibraryId: string | null;
  selectedMethodology: string | null;
  rationale: string[];
  citationCount: number;
  citationsUsed: string[];
  failures: string[];
}

export interface PilotContractCheck {
  name: string;
  passed: boolean;
  details: string;
}

export interface PilotReport {
  passed: boolean;
  scenarioResults: PilotScenarioResult[];
  contractChecks: PilotContractCheck[];
  fallbackCount: number;
  failures: string[];
}

export function getPilotExecutionBlockReason(input: {
  execute: boolean;
  allowLlm: boolean;
  nodeEnv: string | undefined;
}): string | null {
  if (!input.execute) return null;
  if (input.nodeEnv !== 'development') return 'Pilot execution requires NODE_ENV=development.';
  if (!input.allowLlm) return 'Set PILOT_ALLOW_LLM=true to enable pilot execution.';
  return null;
}

function cappedCitations(selection: Selection): string[] {
  return (selection.chosen?.legalCitations ?? [])
    .filter(citation => citation.trim().length > 0)
    .slice(0, 2);
}

export function evaluatePilotScenario(
  scenario: PilotScenario,
  selection: Selection,
): PilotScenarioResult {
  const chosen = selection.chosen;
  if (!chosen) {
    return {
      scenario: scenario.name,
      status: scenario.allowFallback ? 'fallback' : 'fail',
      selectedLibraryId: null,
      selectedMethodology: null,
      rationale: selection.rationale,
      citationCount: 0,
      citationsUsed: [],
      failures: scenario.allowFallback
        ? []
        : ['No library row was selected for a required scenario.'],
    };
  }

  const failures: string[] = [];
  if (chosen.targetRecipient !== scenario.request.targetRecipient) {
    failures.push('Selected row has the wrong target recipient.');
  }
  if (chosen.bureau && chosen.bureau !== scenario.request.bureau) {
    failures.push('Selected row has the wrong bureau.');
  }
  if (scenario.expectedMethodology && chosen.methodology !== scenario.expectedMethodology) {
    failures.push(`Selected row has methodology ${chosen.methodology}, expected ${scenario.expectedMethodology}.`);
  }
  if (!chosen.promptContext?.trim()) {
    failures.push('Selected row is missing prompt context.');
  }
  if (selection.rationale.length === 0) {
    failures.push('Selected row has no selection rationale.');
  }

  return {
    scenario: scenario.name,
    status: failures.length > 0 ? 'fail' : 'pass',
    selectedLibraryId: chosen.id,
    selectedMethodology: chosen.methodology,
    rationale: selection.rationale,
    citationCount: chosen.legalCitations?.length ?? 0,
    citationsUsed: cappedCitations(selection),
    failures,
  };
}

export function buildPilotReport(
  scenarioResults: PilotScenarioResult[],
  contractChecks: PilotContractCheck[],
): PilotReport {
  const failures = [
    ...scenarioResults.flatMap(result => result.failures),
    ...contractChecks.filter(check => !check.passed).map(check => check.details),
  ];

  return {
    passed: failures.length === 0,
    scenarioResults,
    contractChecks,
    fallbackCount: scenarioResults.filter(result => result.status === 'fallback').length,
    failures,
  };
}
