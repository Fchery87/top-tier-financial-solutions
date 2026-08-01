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
 * The consistent header for every admin page: a mono eyebrow, an editorial
 * serif title (the marketing site's display voice carried into the product),
 * an optional one-line description, and a right-aligned action slot — framed
 * by a hairline like an article header.
 */
export function AdminPageHeader({ eyebrow, title, description, actions, className }: AdminPageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-secondary">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-editorial text-[1.75rem] leading-[1.1] tracking-[-0.01em] text-foreground md:text-[2rem]">
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
