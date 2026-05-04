interface PullComparisonItem {
  bureau: string | null;
  [key: string]: unknown;
}

interface PullComparison {
  deleted: PullComparisonItem[];
  updated: PullComparisonItem[];
  unchanged: PullComparisonItem[];
  added: PullComparisonItem[];
}

interface ReviewedOutcome {
  outcome: string;
  [key: string]: unknown;
}

export interface ProgressReportInputSource {
  pullComparison: PullComparison;
  reviewedOutcomes: ReviewedOutcome[];
}

function countOutcomes(outcomes: ReviewedOutcome[], outcome: string) {
  return outcomes.filter((item) => item.outcome === outcome).length;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export function buildProgressReportInputs(source: ProgressReportInputSource) {
  const deletedCount = source.pullComparison.deleted.length;
  const updatedCount = source.pullComparison.updated.length;
  const reviewedDeletedCount = countOutcomes(source.reviewedOutcomes, 'deleted');
  const highlights: string[] = [];

  if (deletedCount > 0) {
    highlights.push(`${deletedCount} negative ${pluralize(deletedCount, 'item')} no longer ${deletedCount === 1 ? 'appears' : 'appear'} on the newer report pull.`);
  }

  if (updatedCount > 0) {
    highlights.push(`${updatedCount} reporting ${pluralize(updatedCount, 'item')} changed between report pulls.`);
  }

  if (reviewedDeletedCount > 0) {
    highlights.push(`${reviewedDeletedCount} reviewed dispute ${pluralize(reviewedDeletedCount, 'outcome')} confirmed a deletion.`);
  }

  return {
    pull_comparison: {
      deleted_count: deletedCount,
      updated_count: updatedCount,
      new_negative_count: source.pullComparison.added.length,
    },
    reviewed_outcomes: {
      deleted_count: reviewedDeletedCount,
      updated_count: countOutcomes(source.reviewedOutcomes, 'updated'),
      verified_count: countOutcomes(source.reviewedOutcomes, 'verified'),
    },
    client_visible_highlights: highlights,
  };
}
