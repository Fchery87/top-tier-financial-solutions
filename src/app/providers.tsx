'use client';

import { TooltipProvider } from '@radix-ui/react-tooltip';
import { ThemeProvider } from 'next-themes';
import { ReactNode } from 'react';

export function TooltipWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </ThemeProvider>
  );
}
