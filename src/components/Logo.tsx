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

const LogoMark = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 48 48" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    <path 
      d="M24 4L42 14V34L24 44L6 34V14L24 4Z" 
      className="fill-secondary/10 stroke-secondary" 
      strokeWidth="2" 
      strokeLinejoin="round"
    />
    <path 
      d="M24 11V37M13 17L24 11L35 17M13 25L24 31L35 25" 
      className="stroke-secondary" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <circle cx="24" cy="11" r="2" className="fill-secondary" />
    <circle cx="13" cy="17" r="2" className="fill-secondary" />
    <circle cx="35" cy="17" r="2" className="fill-secondary" />
  </svg>
);

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
          <div className="absolute -inset-2 bg-secondary/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* Main logo container */}
          <div className={cn(
            currentSize.icon,
            "relative flex items-center justify-center transition-all duration-300"
          )}>
             <LogoMark className="w-full h-full drop-shadow-lg" />
          </div>
        </div>

        {/* Text */}
        {showText && (
          <div className="flex flex-col justify-center">
            <span className={cn(
              currentSize.text,
              "font-serif font-bold tracking-tight leading-none",
              variant === 'light' ? 'text-white' : 'text-foreground'
            )}>
              Top Tier
            </span>
            <span className={cn(
              currentSize.subtext,
              "uppercase tracking-[0.25em] font-medium mt-0.5 text-secondary"
            )}>
              Financial Solutions
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
        <div className="relative w-8 h-8">
          <div className="absolute -inset-1 bg-secondary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <LogoMark className="w-full h-full" />
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
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  return (
    <div className={cn(
      sizes[size],
      "relative flex items-center justify-center",
      className
    )}>
       <LogoMark className="w-full h-full" />
    </div>
  );
}
