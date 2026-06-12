import * as React from 'react';
import { cn } from '@/lib/utils';
import { scoreBandInfo, scorePosition } from '@/lib/credit-score';

interface ScoreBadgeProps {
  score: number | null | undefined;
  /** pill = tinted chip; plain = colored number; gauge = number + mini band bar */
  variant?: 'pill' | 'plain' | 'gauge';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: { num: 'text-sm', label: 'text-[10px]', pad: 'px-2 py-0.5' },
  md: { num: 'text-base', label: 'text-[11px]', pad: 'px-2.5 py-1' },
  lg: { num: 'text-3xl', label: 'text-xs', pad: 'px-3 py-1.5' },
};

/**
 * Credit-score chip colored by FICO band (red → emerald). Numbers use
 * tabular figures so they stay aligned in tables.
 */
export function ScoreBadge({
  score,
  variant = 'pill',
  size = 'md',
  showLabel = false,
  className,
}: ScoreBadgeProps) {
  const s = sizeStyles[size];

  if (score == null || Number.isNaN(score)) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-md text-muted-foreground', s.pad, className)}>
        <span className={cn('font-mono tabular-nums font-semibold', s.num)}>—</span>
      </span>
    );
  }

  const info = scoreBandInfo(score);

  if (variant === 'plain') {
    return (
      <span className={cn('inline-flex items-baseline gap-1.5', className)}>
        <span className={cn('font-mono tabular-nums font-semibold', s.num, info.text)}>{score}</span>
        {showLabel && <span className={cn('font-medium', s.label, info.text)}>{info.label}</span>}
      </span>
    );
  }

  if (variant === 'gauge') {
    return (
      <span className={cn('inline-flex flex-col gap-1', className)}>
        <span className="inline-flex items-baseline gap-1.5">
          <span className={cn('font-mono tabular-nums font-semibold', s.num, info.text)}>{score}</span>
          {showLabel && <span className={cn('font-medium', s.label, 'text-muted-foreground')}>{info.label}</span>}
        </span>
        <span className="relative h-1.5 w-full min-w-[64px] overflow-hidden rounded-full bg-muted">
          <span
            className={cn('absolute inset-y-0 left-0 rounded-full', info.dot)}
            style={{ width: `${Math.round(scorePosition(score) * 100)}%` }}
          />
        </span>
      </span>
    );
  }

  // pill
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-medium',
        info.bg,
        info.border,
        s.pad,
        className,
      )}
    >
      <span className={cn('font-mono tabular-nums font-semibold', s.num, info.text)}>{score}</span>
      {showLabel && <span className={cn(s.label, info.text)}>{info.label}</span>}
    </span>
  );
}
