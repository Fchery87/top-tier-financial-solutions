'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ApexMark } from '@/components/brand/ApexMark';

interface LogoProps {
  variant?: 'default' | 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ variant = 'default', size = 'md', showText = true, className }: LogoProps) {
  const sizes = {
    sm: { mark: 'size-8', text: 'text-lg', subtext: 'text-[10px]' },
    md: { mark: 'size-9', text: 'text-xl', subtext: 'text-[10px]' },
    lg: { mark: 'size-12', text: 'text-2xl md:text-3xl', subtext: 'text-xs' },
  };

  const currentSize = sizes[size];
  const textColor = variant === 'light' ? 'text-white' : 'text-foreground';
  const subtextColor = variant === 'light' ? 'text-brass' : 'text-secondary';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Link href="/" className="flex items-center gap-2.5">
        <ApexMark className={cn('shrink-0', currentSize.mark)} />

        {showText && (
          <span className="flex flex-col justify-center">
            <span className={cn(currentSize.text, 'font-semibold tracking-[-0.03em] leading-none', textColor)}>
              Top Tier
            </span>
            <span className={cn(currentSize.subtext, 'mt-1 font-medium uppercase tracking-[0.2em]', subtextColor)}>
              Financial Solutions
            </span>
          </span>
        )}
      </Link>
    </div>
  );
}

export function LogoHorizontal({ variant = 'default', className }: Omit<LogoProps, 'size' | 'showText'>) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Link href="/" className="flex items-center gap-2">
        <ApexMark className="size-8 shrink-0" />
        <span className={cn('text-lg font-semibold tracking-[-0.03em]', variant === 'light' ? 'text-white' : 'text-foreground')}>
          TTFS
        </span>
      </Link>
    </div>
  );
}

export function LogoIcon({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = {
    sm: 'size-7',
    md: 'size-9',
    lg: 'size-12',
  };

  return <ApexMark className={cn(sizes[size], className)} />;
}
