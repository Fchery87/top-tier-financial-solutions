import * as React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeltaChip } from '@/components/ui/DeltaChip';
import { Sparkline } from '@/components/ui/Sparkline';

interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  /** Tints the icon + sparkline. Defaults to the muted-foreground. */
  accent?: 'default' | 'emerald' | 'amber' | 'red' | 'slate';
  delta?: number;
  deltaSuffix?: string;
  positiveIsGood?: boolean;
  trend?: number[];
  href?: string;
  loading?: boolean;
  compact?: boolean;
  className?: string;
}

const accentText: Record<NonNullable<MetricTileProps['accent']>, string> = {
  default: 'text-muted-foreground',
  emerald: 'text-up',
  amber: 'text-warning',
  red: 'text-down',
  slate: 'text-foreground/70',
};

/**
 * Dense operational metric tile: label, big tabular number, directional delta,
 * and an optional sparkline. The pattern competitor dashboards lead with.
 */
export function MetricTile({
  label,
  value,
  icon: Icon,
  accent = 'default',
  delta,
  deltaSuffix,
  positiveIsGood = true,
  trend,
  href,
  loading = false,
  compact = false,
  className,
}: MetricTileProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', accentText[accent])} strokeWidth={1.75} />}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cn(
              'font-mono font-semibold tabular-nums leading-none text-foreground',
              compact ? 'text-2xl' : 'text-[2rem]',
            )}
          >
            {loading ? <span className="text-muted-foreground">—</span> : value}
          </div>
          {delta != null && !loading && (
            <div className="mt-1.5">
              <DeltaChip value={delta} suffix={deltaSuffix} positiveIsGood={positiveIsGood} />
            </div>
          )}
        </div>
        {trend && trend.length > 1 && !loading && (
          <Sparkline data={trend} className={accentText[accent]} width={compact ? 56 : 72} height={compact ? 20 : 28} />
        )}
      </div>
    </>
  );

  const base = cn(
    'block rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_hsl(24_10%_10%/0.03)] transition-colors duration-[160ms] ease-[var(--ease-out)]',
    href && 'hover:border-secondary/40 hover:bg-muted/40',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={base}>
        {content}
      </Link>
    );
  }
  return <div className={base}>{content}</div>;
}
