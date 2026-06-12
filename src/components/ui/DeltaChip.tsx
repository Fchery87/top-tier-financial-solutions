import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeltaChipProps {
  value: number;
  /** Suffix like '%' or ' pts'. */
  suffix?: string;
  /** When false, a positive value is bad (e.g. overdue count) and colors invert. */
  positiveIsGood?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Directional delta indicator: arrow + signed value, colored by direction.
 * The default assumes "up is good" (score rising, items removed).
 */
export function DeltaChip({
  value,
  suffix = '',
  positiveIsGood = true,
  size = 'sm',
  className,
}: DeltaChipProps) {
  const neutral = value === 0;
  const good = positiveIsGood ? value > 0 : value < 0;
  const Icon = neutral ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const color = neutral ? 'text-muted-foreground' : good ? 'text-up' : 'text-down';
  const sign = value > 0 ? '+' : '';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <span className={cn('inline-flex items-center gap-0.5 font-medium tabular-nums', textSize, color, className)}>
      <Icon className={iconSize} strokeWidth={2.5} />
      <span className="font-mono">
        {sign}
        {value}
        {suffix}
      </span>
    </span>
  );
}
