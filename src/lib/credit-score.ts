/**
 * Credit score banding (FICO ranges). Drives the score-band color scale
 * used by ScoreBadge, gauges, and trend zones — the visual signature that
 * makes the app read as a credit tool.
 */

export type ScoreBand = 'poor' | 'fair' | 'good' | 'verygood' | 'excellent';

export interface ScoreBandInfo {
  band: ScoreBand;
  label: string;
  /** Full literal Tailwind classes (Tailwind can't see computed strings). */
  text: string;
  bg: string;
  border: string;
  dot: string;
}

const BANDS: Record<ScoreBand, Omit<ScoreBandInfo, 'band'>> = {
  poor: {
    label: 'Poor',
    text: 'text-score-poor',
    bg: 'bg-score-poor/10',
    border: 'border-score-poor/30',
    dot: 'bg-score-poor',
  },
  fair: {
    label: 'Fair',
    text: 'text-score-fair',
    bg: 'bg-score-fair/10',
    border: 'border-score-fair/30',
    dot: 'bg-score-fair',
  },
  good: {
    label: 'Good',
    text: 'text-score-good',
    bg: 'bg-score-good/10',
    border: 'border-score-good/30',
    dot: 'bg-score-good',
  },
  verygood: {
    label: 'Very Good',
    text: 'text-score-verygood',
    bg: 'bg-score-verygood/10',
    border: 'border-score-verygood/30',
    dot: 'bg-score-verygood',
  },
  excellent: {
    label: 'Excellent',
    text: 'text-score-excellent',
    bg: 'bg-score-excellent/10',
    border: 'border-score-excellent/30',
    dot: 'bg-score-excellent',
  },
};

export function scoreBand(score: number): ScoreBand {
  if (score < 580) return 'poor';
  if (score < 670) return 'fair';
  if (score < 740) return 'good';
  if (score < 800) return 'verygood';
  return 'excellent';
}

export function scoreBandInfo(score: number): ScoreBandInfo {
  const band = scoreBand(score);
  return { band, ...BANDS[band] };
}

/** Position of a score within the 300–850 FICO range, clamped to 0–1. */
export function scorePosition(score: number): number {
  return Math.min(1, Math.max(0, (score - 300) / (850 - 300)));
}
