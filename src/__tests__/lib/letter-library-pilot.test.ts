import { describe, expect, it } from 'vitest';
import {
  LETTER_LIBRARY_PILOT_SCENARIOS,
  buildPilotReport,
  evaluatePilotScenario,
  getPilotExecutionBlockReason,
  type PilotScenarioResult,
} from '@/lib/letter-library-pilot';
import type { Selection } from '@/lib/letter-library-selector';

function selection(overrides: Partial<Selection> = {}): Selection {
  return {
    chosen: {
      id: 'library-1',
      methodology: 'factual',
      targetRecipient: 'bureau',
      round: 1,
      itemTypes: ['collection'],
      bureau: null,
      reasonCodes: ['verification_required'],
      promptContext: 'Use only documented facts.',
      legalCitations: ['FCRA 611', 'FCRA 623', 'Metro 2 Format'],
      effectivenessRating: null,
      timesUsed: 0,
      lastUsedAt: null,
    },
    score: 100,
    rationale: ['Matches requested reason code.'],
    runnersUp: [],
    ...overrides,
  };
}

function scenarioResult(overrides: Partial<PilotScenarioResult> = {}): PilotScenarioResult {
  return {
    scenario: 'bureau-round-1-factual',
    status: 'pass',
    selectedLibraryId: 'library-1',
    selectedMethodology: 'factual',
    rationale: ['Matches requested reason code.'],
    citationCount: 3,
    citationsUsed: ['FCRA 611', 'FCRA 623'],
    failures: [],
    ...overrides,
  };
}

function selectedCandidate(): NonNullable<Selection['chosen']> {
  const candidate = selection().chosen;
  if (!candidate) throw new Error('Expected the fixture to include a selected candidate.');
  return candidate;
}

describe('letter library pilot contract', () => {
  it('contains representative recipient, round, and fallback scenarios', () => {
    expect(LETTER_LIBRARY_PILOT_SCENARIOS.map(scenario => scenario.name)).toEqual([
      'bureau-round-1-factual',
      'bureau-round-2-method-of-verification',
      'furnisher-round-3-escalation',
      'collector-debt-validation',
      'creditor-goodwill',
      'intentional-legacy-fallback',
    ]);
    expect(LETTER_LIBRARY_PILOT_SCENARIOS.some(scenario => scenario.allowFallback)).toBe(true);
  });

  it('accepts a matching library row and caps citations at two', () => {
    const scenario = LETTER_LIBRARY_PILOT_SCENARIOS[0];
    if (!scenario) throw new Error('Expected the pilot catalog to include a scenario.');
    const result = evaluatePilotScenario(scenario, selection());

    expect(result).toMatchObject({
      status: 'pass',
      selectedLibraryId: 'library-1',
      citationCount: 3,
      citationsUsed: ['FCRA 611', 'FCRA 623'],
    });
  });

  it('flags a selected row with the wrong recipient or missing prompt context', () => {
    const scenario = LETTER_LIBRARY_PILOT_SCENARIOS[0];
    if (!scenario) throw new Error('Expected the pilot catalog to include a scenario.');
    const result = evaluatePilotScenario(scenario, selection({
      chosen: {
        ...selectedCandidate(),
        targetRecipient: 'collector',
        promptContext: null,
      },
    }));

    expect(result.status).toBe('fail');
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.stringContaining('target recipient'),
      expect.stringContaining('prompt context'),
    ]));
  });

  it('records an allowed fallback without treating it as a pilot failure', () => {
    const scenario = LETTER_LIBRARY_PILOT_SCENARIOS.find(item => item.allowFallback);
    if (!scenario) throw new Error('Expected the pilot catalog to include a fallback scenario.');
    const result = evaluatePilotScenario(scenario, { chosen: null, score: 0, rationale: [], runnersUp: [] });

    expect(result).toMatchObject({ status: 'fallback', selectedLibraryId: null });
    expect(result.failures).toEqual([]);
  });

  it('builds a failed report when any required scenario fails', () => {
    const report = buildPilotReport([
      scenarioResult(),
      scenarioResult({ scenario: 'broken-scenario', status: 'fail', failures: ['bad fixture'] }),
    ], [
      { name: 'effectiveness transition', passed: true, details: 'ok' },
      { name: 'fallback transition', passed: false, details: 'missing fallback' },
    ]);

    expect(report.passed).toBe(false);
    expect(report.failures).toEqual(['bad fixture', 'missing fallback']);
  });

  it('requires explicit non-production permission for execution mode', () => {
    expect(getPilotExecutionBlockReason({ execute: false, allowLlm: false, nodeEnv: 'development' })).toBeNull();
    expect(getPilotExecutionBlockReason({ execute: true, allowLlm: false, nodeEnv: 'development' })).toContain('PILOT_ALLOW_LLM');
    expect(getPilotExecutionBlockReason({ execute: true, allowLlm: true, nodeEnv: 'production' })).toContain('NODE_ENV=development');
    expect(getPilotExecutionBlockReason({ execute: true, allowLlm: true, nodeEnv: undefined })).toContain('NODE_ENV=development');
    expect(getPilotExecutionBlockReason({ execute: true, allowLlm: true, nodeEnv: 'development' })).toBeNull();
  });
});
