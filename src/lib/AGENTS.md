# Core Library - Agent Development Guide

## Package Identity
Core business logic, utilities, and services for the credit repair platform. Includes authentication, database helpers, AI integration, credit report parsing, and email services.

## Setup & Run
```bash
# From project root
npm run dev                    # Development server
npm run typecheck             # TypeScript validation
npm run lint                  # ESLint validation
npm run test                  # Unit tests for lib functions
```

## Patterns & Conventions

### File Organization
- Authentication: `auth.ts`, `admin-auth.ts`, `auth-client.ts`
- Database: Database operations handled in API routes, client in `@/db/client`
- Business logic: Domain-specific files (e.g., `credit-analysis.ts`, `ai-letter-generator.ts`)
- Utilities: `utils.ts` for helper functions
- API clients: `admin-api.ts` for admin API calls
- Parsers: `parsers/` directory for credit report parsing logic

### Utility Pattern
Use the `cn()` utility for class merging:
```typescript
// ✅ DO: Copy from src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Authentication Pattern
Role-based auth with database queries:
```typescript
// ✅ DO: Copy from src/lib/admin-auth.ts
export type UserRole = 'user' | 'admin' | 'super_admin';

export async function getUserRole(email: string): Promise<UserRole | null> {
  try {
    const result = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    
    return (result[0].role as UserRole) || 'user';
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
}
```

### API Client Pattern
Typed API client for admin operations:
```typescript
// ✅ DO: Copy from src/lib/admin-api.ts
export const adminClient = {
  clients: {
    list: async (params?: ClientListParams) => {
      const response = await authClient.admin.clients.list(params);
      return response.data;
    },
    create: async (data: CreateClientData) => {
      const response = await authClient.admin.clients.create(data);
      return response.data;
    }
  }
};
```

### Error Handling Pattern
Consistent error logging and user feedback:
```typescript
// ✅ DO: Standard error handling
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.error('Error in operation:', error);
  throw new Error('Operation failed');
}
```

## Touch Points / Key Files
- Auth configuration: `auth.ts`
- Admin auth helpers: `admin-auth.ts`
- Utilities: `utils.ts` (cn function)
- Admin API client: `admin-api.ts`
- Credit analysis: `credit-analysis.ts`
- AI letter generator: `ai-letter-generator.ts`
- Email service: `email-service.ts`
- Parsers: `parsers/` directory for credit report parsing

## JIT Index Hints
- Find utilities: `find src/lib -name "*.ts" | grep -v parsers`
- Find parsers: `find src/lib/parsers -name "*.ts"`
- Search for API clients: `rg -n "authClient|adminClient" src/lib/`
- Find AI integration: `rg -n "generate.*letter|ai.*service" src/lib/`
- Search for credit analysis: `rg -n "credit.*analysis|dispute.*triage" src/lib/`
- Find email automation: `rg -n "triggerAutomation|email.*service" src/lib/`
- Find database operations: `rg -n "db\." src/lib/`

## Common Gotchas
- Always handle errors with try/catch and log appropriately
- Use database client from `@/db/client`, not direct imports
- Auth functions must be async and handle null cases
- Email automation requires proper template names and client data
- AI integration needs proper API key configuration and error handling
- Credit report parsers must handle multiple provider formats
- Use absolute imports: `@/db/client`, `@/lib/utils`

## Pre-PR Checks
```bash
npm run typecheck && npm run lint && npm run test
```
