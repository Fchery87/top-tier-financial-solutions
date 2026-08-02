# Workspace (Casework) - Agent Development Guide

## Package Identity
Staff casework workspace for credit repair management: client tracking, dispute generation, billing, tasks, and messaging. Built with Next.js App Router, TypeScript, and Tailwind CSS. Lives at `/workspace`, gated staff+ by the server-side `src/app/workspace/layout.tsx`. The separate `/admin` surface (`src/app/admin/`) holds configuration routes and is gated by its own server layout.

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
- Workspace shell components use descriptive names such as `AdminSidebar` and `WorkspaceShell`.
- API routes: Follow REST conventions in `route.ts` files

### Authentication Pattern
API routes under `src/app/api/admin/` are capability-gated (via `requireCapability()` / `Capability` from `@/lib/capabilities`), not gated by a blanket "is this user an admin" boolean. Route-level capability checks are authoritative.
```typescript
// Shape A — shared helper. ✅ DO: Copy from src/app/api/admin/clients/route.ts
import { requireCapability } from '@/lib/admin-session';

async function getHandler(request: NextRequest) {
  const adminUser = await requireCapability('clients:read');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  // ...
}
```
Team roles are `user`, `staff`, `admin`, and `super_admin`; use `isTeamRole()` for navigation and `can()`/`requireCapability()` for authorization. This per-request API guard is separate from the page-level auth in `src/app/workspace/layout.tsx` and `src/app/admin/layout.tsx`.

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
- Team and role administration: `src/app/admin/team/page.tsx` and `src/app/api/admin/team/route.ts`
- Workspace sidebar: `src/components/workspace/AdminSidebar.tsx`
- Admin API client: `src/lib/admin-api.ts`
- Admin auth utilities: `src/lib/admin-auth.ts`
- Main dashboard: `src/app/workspace/page.tsx`

## JIT Index Hints
- Find workspace pages: `find src/app/workspace -name "page.tsx"`
- Find workspace components: `find src/components/workspace -name "*.tsx"`
- Find admin API routes: `find src/app/api/admin -name "route.ts"`
- Search workspace-specific: `rg -n "workspace" src/app/workspace/`
- Find authorization seams: `rg -n "requireCapability|can\(" src/`

## Common Gotchas
- `/workspace` pages do not wrap themselves in a client guard; auth and team-role checks happen once in `src/app/workspace/layout.tsx`.
- `/admin` configuration pages use the server-side admin layout; API routes still enforce their capability independently.
- Use capability checks (`can()` / `requireCapability()`) for role-based access control in API routes.
- Server actions require proper session validation via headers
- Email automation uses `triggerAutomation()` - pass client data as second argument
- Client data includes new PII fields: `streetAddress`, `city`, `state`, `zipCode`, `dateOfBirth`, `ssnLast4`

## Pre-PR Checks
```bash
npm run typecheck && npm run lint && npm run test
```
