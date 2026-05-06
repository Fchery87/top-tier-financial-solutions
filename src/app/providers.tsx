'use client';

import { TooltipProvider } from '@radix-ui/react-tooltip';
import { Toaster } from 'sonner';
import { ReactNode } from 'react';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider } from '@/components/ThemeProvider';

export function TooltipWrapper({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <TooltipProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--foreground))',
              },
            }}
          />
        </TooltipProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
