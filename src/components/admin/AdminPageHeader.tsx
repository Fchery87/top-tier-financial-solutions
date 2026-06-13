import * as React from 'react';
import { cn } from '@/lib/utils';

interface AdminPageHeaderProps {
  /** Mono eyebrow above the title (e.g. "Case Management"). */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Right-aligned action buttons. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The consistent header for every admin page: a mono eyebrow, a tight display
 * title, an optional one-line description, and a right-aligned action slot.
 * Mirrors the marketing system's eyebrow + headline rhythm, kept crisp for a
 * dense product surface.
 */
export function AdminPageHeader({ eyebrow, title, description, actions, className }: AdminPageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-secondary">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
