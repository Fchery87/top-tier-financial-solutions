'use client';

import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const dotStyles = {
  default: 'bg-muted-foreground/50',
  success: 'bg-up',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-secondary',
};

export function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium capitalize text-foreground',
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotStyles[variant])} />
      {status}
    </span>
  );
}

export function getStatusVariant(status: string): StatusBadgeProps['variant'] {
  switch (status.toLowerCase()) {
    case 'new':
      return 'info';
    case 'contacted':
      return 'warning';
    case 'qualified':
    case 'converted':
    case 'approved':
    case 'published':
    case 'active':
      return 'success';
    case 'archived':
    case 'closed':
    case 'inactive':
      return 'danger';
    default:
      return 'default';
  }
}
