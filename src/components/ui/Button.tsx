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
    const baseStyles = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px';

    const variants = {
      primary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm',
      secondary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
      outline: 'border border-border bg-card/60 hover:bg-muted hover:text-foreground',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      link: 'text-secondary underline-offset-4 hover:underline',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
    };

    const sizes = {
      sm: 'h-9 rounded-md px-3 text-xs',
      md: 'h-10 px-4 py-2',
      lg: 'h-12 rounded-md px-8 text-base',
      icon: 'h-10 w-10',
    };

    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
