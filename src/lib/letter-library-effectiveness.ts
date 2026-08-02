import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { disputeLetterLibrary } from '@/db/schema';

export interface EffectivenessTransitionInput {
  previousOutcome: string | null | undefined;
  nextOutcome: string | null | undefined;
  timesUsed: number;
  successCount: number;
}

export interface EffectivenessTransition {
  successDelta: -1 | 0 | 1;
  successCount: number;
  effectivenessRating: number | null;
}

export function calculateEffectivenessTransition(
  input: EffectivenessTransitionInput,
): EffectivenessTransition {
  const wasDeleted = input.previousOutcome === 'deleted';
  const isDeleted = input.nextOutcome === 'deleted';
  const successDelta: -1 | 0 | 1 = wasDeleted === isDeleted
    ? 0
    : isDeleted
      ? 1
      : -1;
  const successCount = Math.max(0, input.successCount + successDelta);
  const effectivenessRating = input.timesUsed >= 10 && input.timesUsed > 0
    ? Math.round((successCount / input.timesUsed) * 100)
    : null;

  return { successDelta, successCount, effectivenessRating };
}

export async function recordLibraryOutcome(input: {
  libraryId: string | null | undefined;
  previousOutcome: string | null | undefined;
  nextOutcome: string | null | undefined;
}): Promise<void> {
  if (!input.libraryId || !input.nextOutcome || input.previousOutcome === input.nextOutcome) return;

  try {
    const successDelta = input.nextOutcome === 'deleted' ? 1 : -1;
    const nextSuccessCount = sql<number>`greatest(0, coalesce(${disputeLetterLibrary.successCount}, 0) + ${successDelta})`;

    await db
      .update(disputeLetterLibrary)
      .set({
        successCount: nextSuccessCount,
        effectivenessRating: sql<number | null>`case
          when coalesce(${disputeLetterLibrary.timesUsed}, 0) >= 10
          then round(${nextSuccessCount} * 100.0 / nullif(${disputeLetterLibrary.timesUsed}, 0))
          else null
        end`,
        updatedAt: new Date(),
      })
      .where(eq(disputeLetterLibrary.id, input.libraryId));
  } catch (error) {
    console.error('Failed to update letter library effectiveness:', error);
  }
}
