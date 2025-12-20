# Admin Dashboard - Agent Development Guide

## Package Identity
Admin dashboard for credit repair management with client tracking, dispute generation, billing, and content management. Built with Next.js App Router, TypeScript, and Tailwind CSS.

## Setup & Run
```bash
# From project root
npm run dev                    # Starts Next.js with hot reload
npm run typecheck             # TypeScript validation
npm run lint                  # ESLint validation
```

## Patterns & Conventions

### File Organization
- Layout: `src/app/admin/layout.tsx` - Contains AdminSidebar and AdminGuard
- Pages: Route-based in subdirectories (e.g., `clients/page.tsx`, `disputes/page.tsx`)
- Components: In `src/components/admin/` directory
- API endpoints: In `src/app/api/admin/` mirroring page structure

### Naming Conventions
- Page components: Default exports in `page.tsx` files
- Admin components: Prefixed with "Admin" (e.g., `AdminSidebar`, `AdminGuard`)
- API routes: Follow REST conventions in `route.ts` files

### Authentication Pattern
All admin routes must use the `validateAdmin()` pattern:
```typescript
// ✅ DO: Copy from src/app/api/admin/clients/route.ts
async function validateAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return null;
  }
  
  const isAdmin = await isSuperAdmin(session.user.email);
  if (!isAdmin) {
    return null;
  }
  
  return session.user;
}
```

### Database Query Pattern
Use Drizzle ORM with consistent error handling:
```typescript
// ✅ DO: Copy pattern from src/app/api/admin/clients/route.ts
const [items, totalResult] = await Promise.all([
  db
    .select({...})
    .from(clients)
    .leftJoin(user, eq(clients.userId, user.id))
    .where(whereClause)
    .orderBy(orderDirection(sortColumn))
    .limit(limit)
    .offset(offset),
  db.select({ count: count() }).from(clients).where(whereClause),
]);
```

### Client-Side Data Fetching
Use the admin API client pattern:
```typescript
// ✅ DO: Copy from src/lib/admin-api.ts
import { authClient } from '@/lib/admin-auth';

export const adminClient = {
  clients: {
    list: async (params?: any) => {
      const response = await authClient.admin.clients.list(params);
      return response.data;
    },
    create: async (data: any) => {
      const response = await authClient.admin.clients.create(data);
      return response.data;
    }
  }
};
```

## Touch Points / Key Files
- Admin auth guard: `src/components/admin/AdminGuard.tsx`
- Admin sidebar: `src/components/admin/AdminSidebar.tsx`
- Admin API client: `src/lib/admin-api.ts`
- Admin auth utilities: `src/lib/admin-auth.ts`
- Main dashboard: `src/app/admin/page.tsx`

## JIT Index Hints
- Find admin pages: `find src/app/admin -name "page.tsx"`
- Find admin components: `find src/components/admin -name "*.tsx"`
- Find admin API routes: `find src/app/api/admin -name "route.ts"`
- Search admin-specific: `rg -n "admin" src/app/admin/`
- Find auth guards: `rg -n "AdminGuard|validateAdmin" src/`

## Common Gotchas
- All admin pages must be wrapped in `AdminGuard` component
- Use `isSuperAdmin()` for role-based access control
- Server actions require proper session validation via headers
- Email automation uses `triggerAutomation()` - pass client data as second argument
- Client data includes new PII fields: `streetAddress`, `city`, `state`, `zipCode`, `dateOfBirth`, `ssnLast4`

## Pre-PR Checks
```bash
npm run typecheck && npm run lint && npm run test
```
