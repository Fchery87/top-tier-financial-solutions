'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'default' | 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const logoPath = '/brand/top-tier-logo.svg';

export function Logo({ variant = 'default', size = 'md', showText = true, className }: LogoProps) {
  const sizes = {
    sm: { mark: 'size-9', text: 'text-lg', subtext: 'text-[10px]' },
    md: { mark: 'size-11', text: 'text-xl md:text-2xl', subtext: 'text-[10px]' },
    lg: { mark: 'size-16', text: 'text-3xl md:text-4xl', subtext: 'text-xs' },
  };

  const currentSize = sizes[size];
  const textColor = variant === 'light' ? 'text-white' : 'text-foreground';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Link href="/" className="flex items-center gap-3">
        <span className={cn('relative block shrink-0 overflow-hidden rounded-md', currentSize.mark)}>
          <Image
            src={logoPath}
            alt="Top Tier Financial Solutions logo"
            fill
            priority={size !== 'sm'}
            sizes="(max-width: 768px) 44px, 64px"
            className="object-contain"
          />
        </span>

        {showText && (
          <span className="flex flex-col justify-center">
            <span className={cn(currentSize.text, 'font-display font-semibold tracking-[-0.04em] leading-none', textColor)}>
              Top Tier
            </span>
            <span className={cn(currentSize.subtext, 'mt-1 font-medium uppercase tracking-[0.22em] text-secondary')}>
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
        <span className="relative block size-9 overflow-hidden rounded-md">
          <Image
            src={logoPath}
            alt="Top Tier Financial Solutions logo"
            fill
            sizes="36px"
            className="object-contain"
          />
        </span>
        <span className={cn('font-display text-lg font-semibold tracking-[-0.03em]', variant === 'light' ? 'text-white' : 'text-foreground')}>
          TTFS
        </span>
      </Link>
    </div>
  );
}

export function LogoIcon({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = {
    sm: 'size-7',
    md: 'size-11',
    lg: 'size-16',
  };

  return (
    <span className={cn('relative block overflow-hidden rounded-md', sizes[size], className)}>
      <Image
        src={logoPath}
        alt="Top Tier Financial Solutions logo"
        fill
        sizes="64px"
        className="object-contain"
      />
    </span>
  );
}
