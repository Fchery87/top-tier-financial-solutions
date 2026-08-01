import * as React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatTone = 'default' | 'brass' | 'up' | 'down' | 'warning';

const toneText: Record<StatTone, string> = {
  default: 'text-foreground',
  brass: 'text-secondary',
  up: 'text-up',
  down: 'text-destructive',
  warning: 'text-warning',
};

const toneIcon: Record<StatTone, string> = {
  default: 'text-muted-foreground',
  brass: 'text-secondary',
  up: 'text-up',
  down: 'text-destructive',
  warning: 'text-warning',
};

export interface StatItem {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  href?: string;
  onClick?: () => void;
  /** Renders a brass ring when this stat is acting as an active filter. */
  active?: boolean;
  hint?: string;
}

function StatBody({ item }: { item: StatItem }) {
  const Icon = item.icon;
  const tone = item.tone ?? 'default';
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {item.label}
        </span>
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', toneIcon[tone])} strokeWidth={1.75} />}
      </div>
      <p className={cn('mt-3 font-mono text-[1.75rem] font-semibold leading-none tabular-nums', toneText[tone])}>
        {item.value}
      </p>
      {item.hint && <p className="mt-1.5 truncate text-xs text-muted-foreground">{item.hint}</p>}
    </>
  );
}

/**
 * Dense stat strip: tiles joined by a single hairline (no per-card boxes),
 * mono numbers, de-boxed icons. The operational mirror of the marketing
 * numbered-pillar grid. Tiles can link, toggle a filter, or just display.
 */
export function StatGrid({
  items,
  columns = 4,
  className,
}: {
  items: StatItem[];
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const colClass: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-xl border border-border bg-border',
        colClass[columns],
        className,
      )}
    >
      {items.map((item) => {
        const base = cn(
          'bg-card p-4 text-left transition-colors duration-[160ms] ease-[var(--ease-out)]',
          (item.href || item.onClick) && 'hover:bg-muted/50 cursor-pointer',
          item.active && 'bg-secondary/[0.06] shadow-[inset_0_0_0_1px_hsl(var(--secondary)/0.4)]',
        );

        if (item.href) {
          return (
            <Link key={item.label} href={item.href} className={base}>
              <StatBody item={item} />
            </Link>
          );
        }
        if (item.onClick) {
          return (
            <button key={item.label} type="button" onClick={item.onClick} className={base}>
              <StatBody item={item} />
            </button>
          );
        }
        return (
          <div key={item.label} className={base}>
            <StatBody item={item} />
          </div>
        );
      })}
    </div>
  );
}
