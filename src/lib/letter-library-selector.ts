export interface LibraryCandidate {
  id: string;
  methodology: string;
  targetRecipient: string;
  round: number | null;
  itemTypes: string[] | null;
  bureau: string | null;
  reasonCodes: string[] | null;
  promptContext: string | null;
  legalCitations: string[] | null;
  effectivenessRating: number | null;
  timesUsed: number;
  lastUsedAt: Date | null;
}

export interface SelectionRequest {
  round: number;
  targetRecipient: string;
  bureau: string;
  itemType: string;
  reasonCodes: string[];
  methodology?: string;
}

export interface Selection {
  chosen: LibraryCandidate | null;
  score: number;
  rationale: string[];
  runnersUp: Array<{ id: string; score: number }>;
}

interface RankedCandidate {
  candidate: LibraryCandidate;
  score: number;
  reasonOverlap: number;
  itemTypeMatch: boolean;
  roundRank: number;
  roundDistance: number;
  effectiveness: number;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function reasonOverlap(candidate: LibraryCandidate, request: SelectionRequest): number {
  const requestReasons = new Set(request.reasonCodes.map(normalize));
  return (candidate.reasonCodes || []).filter(reason => requestReasons.has(normalize(reason))).length;
}

function hasItemType(candidate: LibraryCandidate, request: SelectionRequest): boolean {
  return (candidate.itemTypes || []).some(itemType => normalize(itemType) === normalize(request.itemType));
}

function roundRank(candidate: LibraryCandidate, request: SelectionRequest): { rank: number; distance: number } {
  if (candidate.round === null) return { rank: 0, distance: Number.POSITIVE_INFINITY };
  const distance = Math.abs(candidate.round - request.round);
  return {
    rank: distance === 0 ? 2 : 1,
    distance,
  };
}

function effectiveRating(candidate: LibraryCandidate): number {
  return candidate.timesUsed >= 10 ? candidate.effectivenessRating ?? 0 : 0;
}

function lruValue(candidate: LibraryCandidate): number {
  return candidate.lastUsedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
}

function compareRanked(left: RankedCandidate, right: RankedCandidate): number {
  if (left.reasonOverlap !== right.reasonOverlap) return right.reasonOverlap - left.reasonOverlap;
  if (left.itemTypeMatch !== right.itemTypeMatch) return left.itemTypeMatch ? -1 : 1;
  if (left.roundRank !== right.roundRank) return right.roundRank - left.roundRank;
  if (left.roundDistance !== right.roundDistance) return left.roundDistance - right.roundDistance;
  if (left.effectiveness !== right.effectiveness) return right.effectiveness - left.effectiveness;

  const leftLastUsed = lruValue(left.candidate);
  const rightLastUsed = lruValue(right.candidate);
  if (leftLastUsed !== rightLastUsed) return leftLastUsed - rightLastUsed;
  return left.candidate.id.localeCompare(right.candidate.id);
}

function scoreRanked(candidate: RankedCandidate): number {
  return candidate.reasonOverlap * 1_000_000
    + (candidate.itemTypeMatch ? 100_000 : 0)
    + candidate.roundRank * 10_000
    + (Number.isFinite(candidate.roundDistance) ? Math.max(0, 1_000 - candidate.roundDistance) : 0)
    + candidate.effectiveness;
}

function rationaleFor(candidate: RankedCandidate, request: SelectionRequest): string[] {
  const rationale: string[] = [];
  if (candidate.reasonOverlap > 0) {
    rationale.push(`Matches ${candidate.reasonOverlap} requested reason code${candidate.reasonOverlap === 1 ? '' : 's'}.`);
  }
  if (candidate.itemTypeMatch) rationale.push(`Matches the ${request.itemType} item type.`);
  if (candidate.roundRank === 2) rationale.push(`Targets dispute round ${request.round}.`);
  else if (candidate.roundRank === 1) rationale.push(`Uses the nearest available round strategy.`);
  if (candidate.effectiveness > 0) rationale.push(`Uses effectiveness data from ${candidate.candidate.timesUsed} prior uses.`);
  if (candidate.candidate.lastUsedAt) rationale.push('Selected as the least recently used equally ranked strategy.');
  return rationale;
}

export function selectLibraryRow(
  candidates: LibraryCandidate[],
  request: SelectionRequest,
): Selection {
  const ranked = candidates
    .filter(candidate => normalize(candidate.targetRecipient) === normalize(request.targetRecipient))
    .filter(candidate => !candidate.bureau || normalize(candidate.bureau) === normalize(request.bureau))
    .filter(candidate => !request.methodology || normalize(candidate.methodology) === normalize(request.methodology))
    .map(candidate => {
      const round = roundRank(candidate, request);
      const rankedCandidate: RankedCandidate = {
        candidate,
        score: 0,
        reasonOverlap: reasonOverlap(candidate, request),
        itemTypeMatch: hasItemType(candidate, request),
        roundRank: round.rank,
        roundDistance: round.distance,
        effectiveness: effectiveRating(candidate),
      };
      rankedCandidate.score = scoreRanked(rankedCandidate);
      return rankedCandidate;
    })
    .sort(compareRanked);

  const winner = ranked[0];
  if (!winner) return { chosen: null, score: 0, rationale: [], runnersUp: [] };

  return {
    chosen: winner.candidate,
    score: winner.score,
    rationale: rationaleFor(winner, request),
    runnersUp: ranked.slice(1).map(candidate => ({ id: candidate.candidate.id, score: candidate.score })),
  };
}
