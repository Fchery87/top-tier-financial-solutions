# Workspace (Casework) - Agent Development Guide

## Package Identity
Staff casework workspace for credit repair management: client tracking, dispute generation, billing, tasks, and messaging. Built with Next.js App Router, TypeScript, and Tailwind CSS. Lives at `/workspace` (staff+ access); the separate `/admin` surface (`src/app/admin/`) holds site-configuration routes (content, blog, templates, settings) and is admin+ only — see that tree's own docs, not this one.

## Setup & Run
```bash
# From project root
npm run dev                    # Starts Next.js with hot reload
npm run typecheck             # TypeScript validation
npm run lint                  # ESLint validation
```

## Patterns & Conventions

### File Organization
- Layout: `src/app/workspace/layout.tsx` - server component; handles auth/role gating before `WorkspaceShell` (which renders `AdminSidebar`) ever mounts
- Pages: Route-based in subdirectories (e.g., `clients/page.tsx`, `disputes/page.tsx`)
- Components: In `src/components/workspace/` directory
- API endpoints: In `src/app/api/admin/` mirroring page structure (the API namespace still uses `admin` historically; not renamed by this move)

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
- Workspace auth guard (server-side): `src/app/workspace/layout.tsx`
- Legacy client-side auth guard (still used only by `src/app/admin/email-templates/page.tsx`): `src/components/workspace/AdminGuard.tsx`
- Workspace sidebar: `src/components/workspace/AdminSidebar.tsx`
- Admin API client: `src/lib/admin-api.ts`
- Admin auth utilities: `src/lib/admin-auth.ts`
- Main dashboard: `src/app/workspace/page.tsx`

## JIT Index Hints
- Find workspace pages: `find src/app/workspace -name "page.tsx"`
- Find workspace components: `find src/components/workspace -name "*.tsx"`
- Find admin API routes: `find src/app/api/admin -name "route.ts"`
- Search workspace-specific: `rg -n "workspace" src/app/workspace/`
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
