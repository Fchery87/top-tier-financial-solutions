// Per-creditor strategy success analytics.
//
// Aggregates recorded dispute outcomes into per-creditor, per-methodology success
// rates so staff can see which strategy historically works against a given
// creditor. This is decision support for the deterministic policy engine and
// staff review — it never overrides policy approval, evidence requirements, or
// claim-risk rules.

export interface OutcomeRowForInsights {
  creditorName: string | null;
  methodology: string | null;
  itemType?: string | null;
  outcome: string; // 'deleted' | 'updated' | 'verified' | 'frivolous' | 'no_response'
}

export interface MethodologyStats {
  methodology: string;
  total: number;
  deleted: number;
  updated: number;
  verified: number;
  frivolous: number;
  noResponse: number;
  /** (deleted + updated) / total, 0-1 */
  successRate: number;
}

export interface CreditorInsight {
  creditorName: string;
  normalizedName: string;
  total: number;
  overallSuccessRate: number;
  byMethodology: MethodologyStats[];
  /** Highest success-rate methodology with at least MIN_SAMPLE_SIZE outcomes, or null */
  recommendedMethodology: string | null;
}

export interface CreditorStrategySummary {
  creditors: CreditorInsight[];
  totalOutcomes: number;
  /** Quick lookup: normalized creditor name -> recommended methodology */
  recommendationsByCreditor: Record<string, string>;
}

/** Minimum outcomes for a methodology before its success rate drives a recommendation. */
export const MIN_SAMPLE_SIZE = 3;

const SUCCESS_OUTCOMES = new Set(['deleted', 'updated']);

export function normalizeCreditorName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSuccess(outcome: string): boolean {
  return SUCCESS_OUTCOMES.has(outcome.toLowerCase());
}

export function buildCreditorStrategyInsights(rows: OutcomeRowForInsights[]): CreditorStrategySummary {
  interface MutableStats {
    total: number;
    deleted: number;
    updated: number;
    verified: number;
    frivolous: number;
    noResponse: number;
  }

  const byCreditor = new Map<string, { displayName: string; total: number; successes: number; methods: Map<string, MutableStats> }>();
  let totalOutcomes = 0;

  for (const row of rows) {
    if (!row.creditorName || !row.outcome) continue;
    const normalized = normalizeCreditorName(row.creditorName);
    if (!normalized) continue;

    totalOutcomes += 1;
    let creditor = byCreditor.get(normalized);
    if (!creditor) {
      creditor = { displayName: row.creditorName.trim(), total: 0, successes: 0, methods: new Map() };
      byCreditor.set(normalized, creditor);
    }

    creditor.total += 1;
    if (isSuccess(row.outcome)) creditor.successes += 1;

    const methodology = (row.methodology || 'unknown').toLowerCase();
    let stats = creditor.methods.get(methodology);
    if (!stats) {
      stats = { total: 0, deleted: 0, updated: 0, verified: 0, frivolous: 0, noResponse: 0 };
      creditor.methods.set(methodology, stats);
    }

    stats.total += 1;
    switch (row.outcome.toLowerCase()) {
      case 'deleted': stats.deleted += 1; break;
      case 'updated': stats.updated += 1; break;
      case 'verified': stats.verified += 1; break;
      case 'frivolous': stats.frivolous += 1; break;
      case 'no_response': stats.noResponse += 1; break;
    }
  }

  const creditors: CreditorInsight[] = [];
  const recommendationsByCreditor: Record<string, string> = {};

  for (const [normalizedName, creditor] of byCreditor.entries()) {
    const byMethodology: MethodologyStats[] = [];

    for (const [methodology, stats] of creditor.methods.entries()) {
      const successes = stats.deleted + stats.updated;
      byMethodology.push({
        methodology,
        total: stats.total,
        deleted: stats.deleted,
        updated: stats.updated,
        verified: stats.verified,
        frivolous: stats.frivolous,
        noResponse: stats.noResponse,
        successRate: stats.total > 0 ? successes / stats.total : 0,
      });
    }

    byMethodology.sort((a, b) => b.successRate - a.successRate || b.total - a.total);

    const eligible = byMethodology.filter(m => m.total >= MIN_SAMPLE_SIZE && m.methodology !== 'unknown');
    const recommendedMethodology = eligible.length > 0 && eligible[0].successRate > 0
      ? eligible[0].methodology
      : null;

    if (recommendedMethodology) {
      recommendationsByCreditor[normalizedName] = recommendedMethodology;
    }

    creditors.push({
      creditorName: creditor.displayName,
      normalizedName,
      total: creditor.total,
      overallSuccessRate: creditor.total > 0 ? creditor.successes / creditor.total : 0,
      byMethodology,
      recommendedMethodology,
    });
  }

  creditors.sort((a, b) => b.total - a.total);

  return { creditors, totalOutcomes, recommendationsByCreditor };
}

/** Look up the historically best methodology for a creditor, if there is enough data. */
export function getRecommendedMethodologyForCreditor(
  creditorName: string,
  summary: CreditorStrategySummary
): string | null {
  return summary.recommendationsByCreditor[normalizeCreditorName(creditorName)] ?? null;
}
