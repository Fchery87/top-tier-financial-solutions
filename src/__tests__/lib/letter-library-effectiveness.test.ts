import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
}));

vi.mock('@/db/client', () => ({ db: dbMock }));

import { calculateEffectivenessTransition, recordLibraryOutcome } from '@/lib/letter-library-effectiveness';

beforeEach(() => vi.resetAllMocks());

describe('calculateEffectivenessTransition', () => {
  it('increments success when an outcome becomes deleted', () => {
    expect(calculateEffectivenessTransition({
      previousOutcome: 'verified',
      nextOutcome: 'deleted',
      timesUsed: 10,
      successCount: 4,
    })).toEqual({ successDelta: 1, successCount: 5, effectivenessRating: 50 });
  });

  it('decrements success when a deleted outcome is corrected', () => {
    expect(calculateEffectivenessTransition({
      previousOutcome: 'deleted',
      nextOutcome: 'verified',
      timesUsed: 10,
      successCount: 4,
    })).toEqual({ successDelta: -1, successCount: 3, effectivenessRating: 30 });
  });

  it('does not double-count an unchanged deleted outcome', () => {
    expect(calculateEffectivenessTransition({
      previousOutcome: 'deleted',
      nextOutcome: 'deleted',
      timesUsed: 40,
      successCount: 24,
    })).toEqual({ successDelta: 0, successCount: 24, effectivenessRating: 60 });
  });

  it('keeps the rating null until ten uses', () => {
    expect(calculateEffectivenessTransition({
      previousOutcome: null,
      nextOutcome: 'deleted',
      timesUsed: 1,
      successCount: 0,
    })).toEqual({ successDelta: 1, successCount: 1, effectivenessRating: null });
  });

  it('never lets a correction make success count negative', () => {
    expect(calculateEffectivenessTransition({
      previousOutcome: 'deleted',
      nextOutcome: 'verified',
      timesUsed: 10,
      successCount: 0,
    })).toEqual({ successDelta: -1, successCount: 0, effectivenessRating: 0 });
  });
});

describe('recordLibraryOutcome', () => {
  it('uses one atomic SQL update for an outcome transition', async () => {
    await recordLibraryOutcome({ libraryId: 'library-1', previousOutcome: null, nextOutcome: 'deleted' });

    expect(dbMock.update).toHaveBeenCalledTimes(1);
    expect(dbMock.update.mock.results[0]?.value.set).toHaveBeenCalledTimes(1);
  });

  it('does not write for an unchanged outcome or null attribution', async () => {
    await recordLibraryOutcome({ libraryId: null, previousOutcome: null, nextOutcome: 'deleted' });
    await recordLibraryOutcome({ libraryId: 'library-1', previousOutcome: 'verified', nextOutcome: 'verified' });
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});
