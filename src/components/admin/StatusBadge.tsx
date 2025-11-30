'use client';

import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variantStyles = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-green-500/10 text-green-600 dark:text-green-400',
  warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
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
