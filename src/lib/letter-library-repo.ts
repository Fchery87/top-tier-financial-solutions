import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { disputeLetterLibrary } from '@/db/schema';
import type { LibraryCandidate, SelectionRequest } from '@/lib/letter-library-selector';
import { logServerEvent } from '@/lib/server-logger';

export interface LibraryRowInput {
  id: string;
  methodology: string;
  targetRecipient: string;
  round: number | null;
  itemTypes: string | null;
  bureau: string | null;
  reasonCodes: string | null;
  promptContext: string | null;
  legalCitations: string | null;
  effectivenessRating: number | null;
  timesUsed: number | null;
  lastUsedAt: Date | null;
}

type ParsedArray =
  | { ok: true; value: string[] | null }
  | { ok: false };

function parseStringArray(value: string | null): ParsedArray {
  if (value === null || value.trim() === '') return { ok: true, value: null };

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
      return { ok: false };
    }
    return { ok: true, value: parsed.map(item => item.trim()).filter(Boolean) };
  } catch {
    return { ok: false };
  }
}

export function parseLibraryCandidate(row: LibraryRowInput): LibraryCandidate | null {
  const itemTypes = parseStringArray(row.itemTypes);
  const reasonCodes = parseStringArray(row.reasonCodes);
  const legalCitations = parseStringArray(row.legalCitations);
  if (!itemTypes.ok || !reasonCodes.ok || !legalCitations.ok) return null;

  return {
    id: row.id,
    methodology: row.methodology,
    targetRecipient: row.targetRecipient,
    round: row.round,
    itemTypes: itemTypes.value,
    bureau: row.bureau,
    reasonCodes: reasonCodes.value,
    promptContext: row.promptContext,
    legalCitations: legalCitations.value,
    effectivenessRating: row.effectivenessRating,
    timesUsed: row.timesUsed ?? 0,
    lastUsedAt: row.lastUsedAt,
  };
}

export async function fetchCandidates(request: SelectionRequest): Promise<LibraryCandidate[]> {
  const rows = await db
    .select({
      id: disputeLetterLibrary.id,
      methodology: disputeLetterLibrary.methodology,
      targetRecipient: disputeLetterLibrary.targetRecipient,
      round: disputeLetterLibrary.round,
      itemTypes: disputeLetterLibrary.itemTypes,
      bureau: disputeLetterLibrary.bureau,
      reasonCodes: disputeLetterLibrary.reasonCodes,
      promptContext: disputeLetterLibrary.promptContext,
      legalCitations: disputeLetterLibrary.legalCitations,
      effectivenessRating: disputeLetterLibrary.effectivenessRating,
      timesUsed: disputeLetterLibrary.timesUsed,
      lastUsedAt: disputeLetterLibrary.lastUsedAt,
    })
    .from(disputeLetterLibrary)
    .where(
      and(
        eq(disputeLetterLibrary.isActive, true),
        eq(disputeLetterLibrary.targetRecipient, request.targetRecipient),
        or(
          isNull(disputeLetterLibrary.bureau),
          eq(disputeLetterLibrary.bureau, request.bureau),
        ),
      ),
    );

  return rows
    .map(row => parseLibraryCandidate(row))
    .filter((candidate): candidate is LibraryCandidate => candidate !== null);
}

export async function incrementLibraryUsage(libraryId: string): Promise<void> {
  try {
    const { sql } = await import('drizzle-orm');
    await db
      .update(disputeLetterLibrary)
      .set({
        timesUsed: sql<number>`coalesce(${disputeLetterLibrary.timesUsed}, 0) + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(disputeLetterLibrary.id, libraryId));
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.lib.letter.library.repo.error', error: error });
  }
}
