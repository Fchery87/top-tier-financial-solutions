import type { NormalizationWarning } from './types';

export function requiresNormalizationReview(warnings: NormalizationWarning[]): boolean {
  return warnings.length > 0;
}
