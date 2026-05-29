'use client';

import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variantStyles = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-secondary/10 text-secondary',
};

export function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
        variantStyles[variant]
      )}
    >
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
