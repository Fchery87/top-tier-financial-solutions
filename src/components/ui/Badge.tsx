import * as React from 'react';
import { Badge as ShadcnBadge } from '@/components/ui/shadcn-badge';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  info: 'border-secondary/30 bg-secondary/10 text-secondary',
  secondary: 'bg-secondary text-secondary-foreground',
};

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <ShadcnBadge
      variant={variant === 'secondary' ? 'secondary' : 'outline'}
      className={cn(
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
