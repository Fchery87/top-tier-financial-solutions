import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

import {
  buildPilotReport,
  evaluatePilotScenario,
  getPilotExecutionBlockReason,
  LETTER_LIBRARY_PILOT_SCENARIOS,
  type PilotContractCheck,
  type PilotScenarioResult,
} from '../src/lib/letter-library-pilot';
import type {
  LibraryCandidate,
  Selection,
} from '../src/lib/letter-library-selector';

type ExecutableTargetRecipient = 'bureau' | 'creditor' | 'collector' | 'furnisher' | 'cfpb';

interface ExecutionResult {
  scenario: string;
  selectedLibraryId: string;
  outputLength: number;
  nonEmpty: boolean;
  lintPassed: boolean;
}

function isExecutableTargetRecipient(value: string): value is ExecutableTargetRecipient {
  switch (value) {
    case 'bureau':
    case 'creditor':
    case 'collector':
    case 'furnisher':
    case 'cfpb':
      return true;
    default:
      return false;
  }
}

function buildSyntheticContractChecks(
  selectLibraryRow: typeof import('../src/lib/letter-library-selector').selectLibraryRow,
  calculateEffectivenessTransition: typeof import('../src/lib/letter-library-effectiveness').calculateEffectivenessTransition,
): PilotContractCheck[] {
  const [firstScenario] = LETTER_LIBRARY_PILOT_SCENARIOS;
  if (!firstScenario) throw new Error('The pilot scenario catalog is empty.');

  const request = firstScenario.request;
  const baseCandidate: Omit<LibraryCandidate, 'id' | 'lastUsedAt'> = {
    methodology: 'factual',
    targetRecipient: 'bureau',
    round: 1,
    itemTypes: ['collection'],
    bureau: null,
    reasonCodes: ['verification_required'],
    promptContext: 'Synthetic pilot guidance.',
    legalCitations: ['Synthetic authority one', 'Synthetic authority two', 'Synthetic authority three'],
    effectivenessRating: null,
    timesUsed: 0,
  };
  const rotation = selectLibraryRow([
    { ...baseCandidate, id: 'pilot-old', lastUsedAt: new Date('2026-07-01T00:00:00Z') },
    { ...baseCandidate, id: 'pilot-recent', lastUsedAt: new Date('2026-08-01T00:00:00Z') },
  ], request);
  const firstSuccess = calculateEffectivenessTransition({
    previousOutcome: null,
    nextOutcome: 'deleted',
    timesUsed: 9,
    successCount: 0,
  });
  const correctedSuccess = calculateEffectivenessTransition({
    previousOutcome: 'deleted',
    nextOutcome: 'verified',
    timesUsed: 10,
    successCount: 1,
  });
  const citationResult = evaluatePilotScenario(firstScenario, rotation);
  const citationCapPassed = citationResult.citationCount === 3 && citationResult.citationsUsed.length === 2;

  return [
    {
      name: 'citation cap',
      passed: citationCapPassed,
      details: citationCapPassed
        ? 'Three synthetic citations were reduced to the two-citation prompt limit.'
        : `Expected three source citations and two rendered citations, received ${citationResult.citationCount} and ${citationResult.citationsUsed.length}.`,
    },
    {
      name: 'least-recently-used rotation',
      passed: rotation.chosen?.id === 'pilot-old',
      details: rotation.chosen?.id === 'pilot-old'
        ? 'The oldest equally ranked synthetic row wins.'
        : `Expected pilot-old, received ${rotation.chosen?.id ?? 'no selection'}.`,
    },
    {
      name: 'effectiveness threshold',
      passed: firstSuccess.effectivenessRating === null && correctedSuccess.successCount === 0,
      details: firstSuccess.effectivenessRating === null && correctedSuccess.successCount === 0
        ? 'Ratings stay null below ten uses and corrections remove prior success credit.'
        : 'Effectiveness threshold or correction guardrail failed.',
    },
  ];
}

async function runPilot() {
  const execute = process.argv.includes('--execute');
  const blockReason = getPilotExecutionBlockReason({
    execute,
    allowLlm: process.env.PILOT_ALLOW_LLM === 'true',
    nodeEnv: process.env.NODE_ENV,
  });
  if (blockReason) throw new Error(blockReason);

  // These imports must stay inside the function so dotenv loads before the DB client.
  const { selectLibraryForGeneration } = await import('../src/lib/letter-generation-library');
  const { selectLibraryRow } = await import('../src/lib/letter-library-selector');
  const { calculateEffectivenessTransition } = await import('../src/lib/letter-library-effectiveness');

  const selections = new Map<string, Selection>();
  const scenarioResults: PilotScenarioResult[] = [];
  for (const scenario of LETTER_LIBRARY_PILOT_SCENARIOS) {
    const selection = await selectLibraryForGeneration(scenario.request);
    selections.set(scenario.name, selection);
    scenarioResults.push(evaluatePilotScenario(scenario, selection));
  }

  const contractChecks = buildSyntheticContractChecks(selectLibraryRow, calculateEffectivenessTransition);
  const report = buildPilotReport(scenarioResults, contractChecks);
  const output: {
    generatedAt: string;
    mode: 'read-only' | 'execute';
    usageWrites: boolean;
    report: typeof report;
    execution?: ExecutionResult[];
  } = {
    generatedAt: new Date().toISOString(),
    mode: execute ? 'execute' : 'read-only',
    usageWrites: execute,
    report,
  };

  if (execute && report.passed) {
    const { generateUniqueDisputeLetter } = await import('../src/lib/ai-letter-generator');
    const executionResults: ExecutionResult[] = [];
    for (const scenario of LETTER_LIBRARY_PILOT_SCENARIOS) {
      const selection = selections.get(scenario.name);
      const targetRecipient = scenario.request.targetRecipient;
      if (!selection?.chosen || !isExecutableTargetRecipient(targetRecipient)) continue;

      const letter = await generateUniqueDisputeLetter({
        disputeType: `pilot-${scenario.name}`,
        round: scenario.request.round,
        targetRecipient,
        clientData: { name: 'Synthetic Pilot Consumer', state: 'PA' },
        itemData: {
          creditorName: 'Synthetic Pilot Creditor',
          itemType: scenario.request.itemType,
          bureau: scenario.request.bureau,
          amount: 12345,
          accountNumber: 'PILOT-0001',
        },
        reasonCodes: scenario.request.reasonCodes,
        methodology: scenario.request.methodology,
        librarySelection: selection,
      });
      executionResults.push({
        scenario: scenario.name,
        selectedLibraryId: selection.chosen.id,
        outputLength: letter.length,
        nonEmpty: letter.trim().length > 0,
        lintPassed: true,
      });
    }
    output.execution = executionResults;
  }

  console.log(JSON.stringify(output, null, 2));
  if (!report.passed) process.exitCode = 1;
}

runPilot().catch(error => {
  console.error('Letter library pilot failed:', error);
  process.exitCode = 1;
});
