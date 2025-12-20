# React Components - Agent Development Guide

## Package Identity
Reusable React components for the credit repair platform. Includes UI foundation components, admin-specific components, and shared business logic components. Built with React 19, TypeScript, and Tailwind CSS.

## Setup & Run
```bash
# From project root
npm run dev                    # Start development server
npm run typecheck             # TypeScript validation
npm run lint                  # ESLint validation
npm run test                  # Component tests
```

## Patterns & Conventions

### File Organization
- UI components: `src/components/ui/` - Basic design system components
- Admin components: `src/components/admin/` - Admin dashboard specific
- Shared components: `src/components/` root - App-wide reusable components
- Component folders: Group related components together (e.g., `ClientTabs/`)

### Component Structure
Follow the Button component pattern:
```typescript
// ✅ DO: Copy from src/components/ui/Button.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

interface ComponentProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <element
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Component.displayName = "Component";

export { Component };
```

### Styling Conventions
- Use `cn()` utility for conditional classes from `@/lib/utils`
- Follow Tailwind utility-first approach
- Define variants and sizes as objects
- Use semantic variant names: `primary`, `secondary`, `outline`, `ghost`, `destructive`

### Admin Component Pattern
Admin components should handle authentication and loading states:
```typescript
// ✅ DO: Copy from src/components/admin/AdminGuard.tsx
'use client';

import { authClient } from '@/lib/admin-auth';
import { ReactNode } from 'react';

export function AdminGuard({ children }: { children: ReactNode }) {
  // Authentication and authorization logic
  return <>{children}</>;
}
```

### Data Table Pattern
For tabular data, use the DataTable pattern:
```typescript
// ✅ DO: Copy from src/components/admin/DataTable.tsx
interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: any, item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
}
```

## Touch Points / Key Files
- Utilities: `src/lib/utils.ts` (cn function)
- UI foundation: `src/components/ui/Button.tsx`
- Admin guard: `src/components/admin/AdminGuard.tsx`
- Data table: `src/components/admin/DataTable.tsx`
- Admin sidebar: `src/components/admin/AdminSidebar.tsx`

## JIT Index Hints
- Find UI components: `find src/components/ui -name "*.tsx"`
- Find admin components: `find src/components/admin -name "*.tsx"`
- Find component exports: `rg -n "export.*function|export const" src/components/`
- Search for Button usage: `rg -n "Button.*variant|Button.*size" src/`
- Find cn usage: `rg -n "cn\(" src/components/`
- Find forwardRef usage: `rg -n "React\.forwardRef" src/components/`

## Common Gotchas
- Always use `React.forwardRef` for components that need ref forwarding
- Include `displayName` for forwardRef components
- Use proper TypeScript interfaces extending HTML element props
- Import `cn` utility from `@/lib/utils` for class merging
- Client components need `'use client'` directive
- Admin components should handle loading and error states

## Pre-PR Checks
```bash
npm run typecheck && npm run lint && npm run test
```
