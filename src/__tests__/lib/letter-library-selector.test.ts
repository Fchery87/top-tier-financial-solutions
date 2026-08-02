import { describe, expect, it } from 'vitest';
import { selectLibraryRow, type LibraryCandidate, type SelectionRequest } from '@/lib/letter-library-selector';

const request: SelectionRequest = {
  round: 2,
  targetRecipient: 'bureau',
  bureau: 'experian',
  itemType: 'collection',
  reasonCodes: ['wrong_balance', 'verification_required'],
};

function candidate(overrides: Partial<LibraryCandidate> = {}): LibraryCandidate {
  return {
    id: 'candidate',
    methodology: 'factual',
    targetRecipient: 'bureau',
    round: 1,
    itemTypes: ['collection'],
    bureau: null,
    reasonCodes: ['verification_required'],
    promptContext: 'Use documented facts.',
    legalCitations: [],
    effectivenessRating: null,
    timesUsed: 0,
    lastUsedAt: null,
    ...overrides,
  };
}

describe('selectLibraryRow', () => {
  it('filters recipient and bureau before ranking', () => {
    const result = selectLibraryRow([
      candidate({ id: 'wrong-recipient', targetRecipient: 'collector' }),
      candidate({ id: 'wrong-bureau', bureau: 'equifax' }),
    ], request);

    expect(result.chosen).toBeNull();
  });

  it('filters to an explicitly requested methodology', () => {
    const result = selectLibraryRow([
      candidate({ id: 'factual', methodology: 'factual' }),
      candidate({ id: 'goodwill', methodology: 'goodwill' }),
    ], { ...request, methodology: 'goodwill' });

    expect(result.chosen?.id).toBe('goodwill');
  });

  it('prefers more reason-code overlap', () => {
    const result = selectLibraryRow([
      candidate({ id: 'one-reason', reasonCodes: ['wrong_balance'] }),
      candidate({ id: 'two-reasons', reasonCodes: ['wrong_balance', 'verification_required'] }),
    ], request);

    expect(result.chosen?.id).toBe('two-reasons');
  });

  it('uses item type after reason-code overlap', () => {
    const result = selectLibraryRow([
      candidate({ id: 'wrong-item', reasonCodes: request.reasonCodes, itemTypes: ['charge_off'] }),
      candidate({ id: 'matching-item', reasonCodes: request.reasonCodes, itemTypes: ['collection'] }),
    ], request);

    expect(result.chosen?.id).toBe('matching-item');
  });

  it('prefers exact round, then nearest round', () => {
    const exact = selectLibraryRow([
      candidate({ id: 'round-one', round: 1 }),
      candidate({ id: 'round-two', round: 2 }),
      candidate({ id: 'round-three', round: 3 }),
    ], request);
    expect(exact.chosen?.id).toBe('round-two');

    const nearest = selectLibraryRow([
      candidate({ id: 'round-one', round: 1 }),
      candidate({ id: 'round-four', round: 4 }),
    ], { ...request, round: 3 });
    expect(nearest.chosen?.id).toBe('round-four');
  });

  it('uses effectiveness only after ten uses', () => {
    const result = selectLibraryRow([
      candidate({ id: 'noisy-high', effectivenessRating: 99, timesUsed: 1 }),
      candidate({ id: 'proven-lower', effectivenessRating: 60, timesUsed: 40 }),
    ], request);

    expect(result.chosen?.id).toBe('proven-lower');
  });

  it('uses least-recently-used time as the final quality tiebreak', () => {
    const result = selectLibraryRow([
      candidate({ id: 'recent', lastUsedAt: new Date('2026-08-01T00:00:00Z') }),
      candidate({ id: 'old', lastUsedAt: new Date('2026-07-01T00:00:00Z') }),
    ], request);

    expect(result.chosen?.id).toBe('old');
    expect(result.runnersUp[0]?.id).toBe('recent');
  });

  it('returns a rationale and stable runners-up scores', () => {
    const result = selectLibraryRow([candidate({ id: 'winner' }), candidate({ id: 'runner' })], request);

    expect(['winner', 'runner']).toContain(result.chosen?.id);
    expect(result.rationale.length).toBeGreaterThan(0);
    expect(result.runnersUp).toHaveLength(1);
    expect(result.runnersUp[0]?.id).not.toBe(result.chosen?.id);
    expect(result.runnersUp[0]?.score).toEqual(expect.any(Number));
  });

  it('returns no selection when no candidate survives hard filters', () => {
    const result = selectLibraryRow([candidate({ targetRecipient: 'collector' })], request);

    expect(result).toMatchObject({ chosen: null, score: 0, rationale: [], runnersUp: [] });
  });
});
