'use client';

import { ReactNode } from 'react';
import { BlurIn, SlideUp } from '@/components/ui/Motion';
import { GradientOrbs, AnimatedGrid, NoiseOverlay, ParticleField } from '@/components/ui/AnimatedBackground';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

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
      "relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden",
      className
    )}>
      {/* Multi-layered animated background */}
      <GradientOrbs className="opacity-60" />
      <AnimatedGrid className="opacity-30" />
      {variant === 'dramatic' && <ParticleField count={15} className="opacity-50" />}
      <NoiseOverlay opacity={0.02} />
      
      {/* Radial gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background z-[1]" />
      
      {/* Decorative radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-secondary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="container relative z-10 mx-auto px-4 md:px-6 text-center">
        {badge && (
          <BlurIn duration={0.6} className="mb-8">
            <div className="relative inline-flex group">
              <div className="absolute -inset-1 bg-secondary/20 rounded-full blur-md group-hover:bg-secondary/30 transition-colors" />
              <div className="relative inline-flex items-center gap-3 px-6 py-3 rounded-full bg-background/80 backdrop-blur-sm border border-secondary/30 text-foreground text-sm font-medium uppercase tracking-widest">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
                </span>
                {badge}
                <Sparkles className="w-4 h-4 text-secondary" />
              </div>
            </div>
          </BlurIn>
        )}
        
        <SlideUp delay={0.1} className="mb-8">
          <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-serif font-bold tracking-tight leading-[1.1]">
            <span className="text-foreground">{title}</span>
            {titleHighlight && (
              <span className="text-gradient-gold block md:inline"> {titleHighlight}</span>
            )}
          </h1>
        </SlideUp>
        
        {/* Decorative divider */}
        <SlideUp delay={0.15}>
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px w-12 md:w-20 bg-gradient-to-r from-transparent to-secondary/50" />
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <div className="h-px w-12 md:w-20 bg-gradient-to-l from-transparent to-secondary/50" />
          </div>
        </SlideUp>
        
        {description && (
          <SlideUp delay={0.2} className="max-w-3xl mx-auto">
            <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground leading-relaxed font-light">
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
      
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-[2]" />
    </section>
  );
}
