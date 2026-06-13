'use client';

import { ReactNode } from 'react';
import { SlideUp } from '@/components/ui/Motion';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  badge?: string;
  title: string;
  titleHighlight?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  variant?: 'default' | 'minimal' | 'dramatic';
}

export function PageHeader({
  badge,
  title,
  titleHighlight,
  description,
  children,
  className,
  variant = 'default',
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        'platform-shell relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-20',
        className
      )}
    >
      <div
        className={cn(
          'absolute inset-0 rule-grid',
          variant === 'minimal' ? 'opacity-20' : 'opacity-40'
        )}
        aria-hidden
      />
      <div
        className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[hsl(var(--brass)/0.06)] to-transparent"
        aria-hidden
      />

      <div className="container relative z-10 mx-auto max-w-4xl px-4 text-center md:px-6">
        {badge && (
          <div className="mb-7 inline-flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-secondary">
            <span className="h-1 w-1 rounded-full bg-secondary" />
            {badge}
            <span className="h-1 w-1 rounded-full bg-secondary" />
          </div>
        )}

        <SlideUp delay={0.05} className="mb-7">
          <h1 className="font-editorial text-5xl leading-[1.05] text-foreground md:text-6xl lg:text-7xl text-balance">
            {title}
            {titleHighlight && <em className="block md:inline"> {titleHighlight}</em>}
          </h1>
        </SlideUp>

        {description && (
          <SlideUp delay={0.12} className="mx-auto max-w-2xl">
            <p className="text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
              {description}
            </p>
          </SlideUp>
        )}

        {children && (
          <SlideUp delay={0.2} className="mt-9">
            {children}
          </SlideUp>
        )}
      </div>
    </section>
  );
}
