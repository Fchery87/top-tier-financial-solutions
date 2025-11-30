'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'default' | 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ variant = 'default', size = 'md', showText = true, className }: LogoProps) {
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-lg', subtext: 'text-xs' },
    md: { icon: 'w-10 h-10', text: 'text-xl md:text-2xl', subtext: 'text-[10px]' },
    lg: { icon: 'w-14 h-14', text: 'text-2xl md:text-3xl', subtext: 'text-xs' },
  };

  const currentSize = sizes[size];

  return (
    <motion.div
      className={cn("flex items-center gap-3", className)}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Link href="/" className="flex items-center gap-3 group">
        {/* Logo Mark */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-secondary/20 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Main logo container */}
          <div className={cn(
            currentSize.icon,
            "relative bg-gradient-to-br from-secondary via-secondary to-secondary/80 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-secondary/30 transition-all duration-300 group-hover:rotate-3 overflow-hidden"
          )}>
            {/* Decorative elements inside logo */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-white/10 rounded-bl-full" />
            
            {/* Stacked T letters for depth effect */}
            <div className="relative">
              <span className="absolute -top-[1px] -left-[1px] text-primary/30 font-bold font-serif text-xl">T</span>
              <span className="relative text-primary font-bold font-serif text-xl">T</span>
            </div>
            
            {/* Small decorative bar */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-primary/50 rounded-full" />
          </div>
          
          {/* Animated ring on hover */}
          <motion.div
            className="absolute -inset-1 border border-secondary/30 rounded-xl opacity-0 group-hover:opacity-100"
            initial={false}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Text */}
        {showText && (
          <div className="flex flex-col">
            <span className={cn(
              currentSize.text,
              "font-serif font-bold tracking-tight leading-tight",
              variant === 'light' ? 'text-white' : 'text-foreground'
            )}>
              Top Tier{' '}
              <span className={cn(
                variant === 'light' ? 'text-secondary' : 'text-gradient-gold'
              )}>
                Financial
              </span>
            </span>
            <span className={cn(
              currentSize.subtext,
              "uppercase tracking-[0.2em] font-medium",
              variant === 'light' ? 'text-white/70' : 'text-muted-foreground'
            )}>
              Solutions
            </span>
          </div>
        )}
      </Link>
    </motion.div>
  );
}

// Alternative logo variant with horizontal layout
export function LogoHorizontal({ variant = 'default', className }: Omit<LogoProps, 'size' | 'showText'>) {
  return (
    <motion.div
      className={cn("flex items-center gap-2", className)}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Link href="/" className="flex items-center gap-2 group">
        {/* Compact logo mark */}
        <div className="relative">
          <div className="absolute -inset-0.5 bg-secondary/30 rounded-lg blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative w-8 h-8 bg-gradient-to-br from-secondary to-secondary/80 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-primary font-bold font-serif text-sm">TT</span>
          </div>
        </div>

        <span className={cn(
          "text-lg font-serif font-bold tracking-tight",
          variant === 'light' ? 'text-white' : 'text-foreground'
        )}>
          TTFS
        </span>
      </Link>
    </motion.div>
  );
}

// Icon only logo for favicon/small spaces
export function LogoIcon({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-lg',
    lg: 'w-16 h-16 text-2xl',
  };

  return (
    <div className={cn(
      sizes[size],
      "relative bg-gradient-to-br from-secondary via-secondary to-secondary/80 rounded-xl flex items-center justify-center shadow-lg overflow-hidden",
      className
    )}>
      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-white/10 rounded-bl-full" />
      <span className="relative text-primary font-bold font-serif">T</span>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1/3 h-0.5 bg-primary/50 rounded-full" />
    </div>
  );
}
