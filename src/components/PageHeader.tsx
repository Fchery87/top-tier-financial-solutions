'use client';

import { ReactNode } from 'react';
import { SlideUp } from '@/components/ui/Motion';
import { cn } from '@/lib/utils';
import { ShieldCheck } from 'lucide-react';

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
  variant = 'default'
}: PageHeaderProps) {
  return (
    <section className={cn(
      "platform-shell relative pt-32 pb-16 md:pt-40 md:pb-20 overflow-hidden",
      className
    )}>
      <div className={cn("absolute inset-0 rule-grid", variant === 'minimal' ? 'opacity-15' : 'opacity-30')} />
      
      <div className="container relative z-10 mx-auto px-4 md:px-6 text-center">
        {badge && (
          <div className="mb-8 inline-flex items-center gap-2 rounded-md border border-border bg-card/70 px-4 py-2 text-sm font-medium text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-secondary" />
                {badge}
          </div>
        )}
        
        <SlideUp delay={0.1} className="mb-8">
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl xl:text-8xl tracking-[-0.05em] leading-[0.95]">
            <span className="text-foreground">{title}</span>
            {titleHighlight && (
              <span className="text-secondary block md:inline"> {titleHighlight}</span>
            )}
          </h1>
        </SlideUp>
        
        {description && (
          <SlideUp delay={0.2} className="max-w-3xl mx-auto">
            <p className="text-lg md:text-xl text-muted-foreground leading-8">
              {description}
            </p>
          </SlideUp>
        )}
        
        {children && (
          <SlideUp delay={0.3} className="mt-10">
            {children}
          </SlideUp>
        )}
      </div>
      
    </section>
  );
}
