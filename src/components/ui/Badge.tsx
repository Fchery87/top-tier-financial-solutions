import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-green-500/10 text-green-600 dark:text-green-400',
  warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  danger: 'bg-red-500/10 text-red-600 dark:text-red-400',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  secondary: 'bg-secondary/10 text-secondary',
};

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

function getStatusVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    active: 'success',
    completed: 'success',
    resolved: 'success',
    signed: 'success',
    approved: 'success',
    deleted: 'success',
    sent: 'info',
    pending: 'warning',
    draft: 'default',
    awaiting: 'warning',
    overdue: 'danger',
    cancelled: 'danger',
    rejected: 'danger',
    failed: 'danger',
    inactive: 'default',
  };
  return map[status.toLowerCase()] || 'default';
}

export { Badge, getStatusVariant };
export type { BadgeVariant };
