import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-[160ms] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] disabled:active:scale-100';

    const variants = {
      primary:
        'bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.08),0_1px_2px_hsl(24_10%_10%/0.16)] hover:bg-primary/88',
      secondary:
        'bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.16),0_1px_2px_hsl(24_10%_10%/0.16)] hover:bg-secondary/90',
      outline:
        'border border-border bg-card shadow-[0_1px_2px_hsl(24_10%_10%/0.04)] hover:border-foreground/25 hover:bg-muted/60',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      link: 'text-secondary underline-offset-4 hover:underline',
      destructive:
        'bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12),0_1px_2px_hsl(24_10%_10%/0.16)] hover:bg-destructive/90',
    };

    const sizes = {
      sm: 'h-8 rounded-md px-3 text-[13px]',
      md: 'h-10 px-4 py-2',
      lg: 'h-12 rounded-lg px-7 text-[15px]',
      icon: 'h-10 w-10',
    };

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        type={asChild ? undefined : (props.type ?? 'button')}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
