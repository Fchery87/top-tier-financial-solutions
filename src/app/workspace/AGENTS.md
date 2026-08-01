# Workspace (Casework) - Agent Development Guide

## Package Identity
Staff casework workspace for credit repair management: client tracking, dispute generation, billing, tasks, and messaging. Built with Next.js App Router, TypeScript, and Tailwind CSS. Lives at `/workspace`, gated staff+ by the server-side `src/app/workspace/layout.tsx`. The separate `/admin` surface (`src/app/admin/`) holds site-configuration routes (content, blog, templates, settings) and is *intended* to be admin+ only once a server-side layout for that tree lands (tracked as a follow-up task) — as of this writing `/admin` has no page-level or layout-level guard of its own, so don't assume it's currently enforced. See that tree's own docs, not this one, once it has one.

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
API routes under `src/app/api/admin/` are capability-gated (via `can()` / `Capability` from `@/lib/capabilities`), not gated by a blanket "is this user an admin" boolean. Two equivalent shapes currently coexist in the codebase — match whichever your target file already uses rather than introducing a third:
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
```typescript
// Shape B — local per-file helper. ✅ DO: Copy from src/app/api/admin/tasks/route.ts
import { getUserRole } from '@/lib/admin-auth';
import { can, type Capability } from '@/lib/capabilities';

async function validateAdmin(capability: Capability) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) return { error: 'Unauthorized' as const };
  const role = await getUserRole(session.user.email);
  if (!can(role, capability)) return { error: 'Forbidden' as const };
  return { user: { ...session.user, role } };
}
```
`isSuperAdmin()` (`@/lib/admin-auth`) still exists but is now narrow — use it only where a check must specifically require the `super_admin` role, not as the general admin-route gate.

This is a per-request API guard, separate from the page-level auth described in Common Gotchas below (`/workspace` pages are gated once by `src/app/workspace/layout.tsx`; `/admin` pages currently have no equivalent).

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
- `/workspace` pages do NOT wrap themselves in `AdminGuard` — auth is handled once, server-side, in `src/app/workspace/layout.tsx`, before any page under this tree renders. `AdminGuard` is legacy: its only remaining consumer in the whole codebase is `src/app/admin/email-templates/page.tsx` (a config route, not a workspace route). Don't add new `AdminGuard` wraps under `/workspace` — it would be redundant with the layout guard.
- `/admin` config routes currently have no equivalent guard at all (page-level or layout-level) — don't assume they're protected just because `/workspace` is.
- Use capability checks (`can()` / `requireCapability()`) for role-based access control in API routes, not `isSuperAdmin()` (see Authentication Pattern above — `isSuperAdmin()` is narrow, super_admin-only)
- Server actions require proper session validation via headers
- Email automation uses `triggerAutomation()` - pass client data as second argument
- Client data includes new PII fields: `streetAddress`, `city`, `state`, `zipCode`, `dateOfBirth`, `ssnLast4`

## Pre-PR Checks
```bash
npm run typecheck && npm run lint && npm run test
```
