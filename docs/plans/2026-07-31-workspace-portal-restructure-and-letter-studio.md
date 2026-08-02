# Workspace/Portal Restructure & Letter Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the single `/admin` surface into a role-appropriate `/workspace` (casework) and `/admin` (business configuration), enforce authorization server-side through a capability model, fix the client portal's navigation dead ends, and add per-dispute letter editing with AI-assisted rewriting.

**Architecture:** Authorization moves from 60 scattered `isSuperAdmin()` calls to a single capability map (`lib/capabilities.ts`) resolved from `user.role`, so custom roles later become a data change rather than a code change. Route protection moves from a client-side `AdminGuard` to server-component layouts that redirect before any HTML ships. Letter text becomes per-dispute editable, with `lintGeneratedLetter` refactored from a binary blocker into **severity tiers** — a narrow set of hard blocks for fabricated data, and overridable warnings for everything else — with the operator's decision recorded in a revision table.

**Tech Stack:** Next.js 15 App Router, TypeScript, Drizzle ORM (Postgres), better-auth, Tailwind, Vitest, Playwright.

---

## Context: why this shape

Findings from the 2026-07-31 review that drive the design:

1. **`staff` is a phantom role.** `UserRole` is `'user' | 'admin' | 'super_admin'` (`src/lib/admin-auth.ts:5`), but the frontend has an unreachable staff tier wired through `src/contexts/AdminContext.tsx:45`, `src/components/admin/AdminTopBar.tsx:76`, `src/app/admin/page.tsx:26`, and `src/app/admin/disputes/page.tsx:65`.
2. **No server-side route protection exists.** There is no `middleware.ts`; `AdminGuard` runs after hydration.
3. **Letter templates are inert.** `dispute_letter_templates` (`db/schema.ts:895-907`) has no owner column, and the route (`src/app/api/admin/dispute-templates/route.ts`) exports **GET and POST only** — no PUT, no DELETE, no `[id]` route, and the only write in `src/` is one `db.insert` at `:76`. More importantly, **nothing consumes the table**: no code in `src/app/api/admin/disputes/`, `src/lib/ai-letter-generator.ts`, or the dispute wizard reads `letterTemplateId` or template content. The only references anywhere in the component tree are three navigation links (`AdminSidebar.tsx:75`, `AdminTopBar.tsx:18`, `OperationsTab.tsx:97`). Letters are generated entirely by the AI generator from item data, reason codes, and `dispute-config-loader.ts` methodology config. **Templates carry no compliance exposure because no path exists from that table to a bureau.** They move to `/admin` because they are configuration, not because they are dangerous. See the companion plan for wiring the real letter library into generation.
4. **Per-dispute letter editing does not exist.** `letterContent` (`db/schema.ts:785`) is not in the PUT allowlist (`src/app/api/admin/disputes/[id]/route.ts:227-310`), and no UI reads or writes it.
5. **Market research (July 2026):** bureaus pattern-match template letters and route them to automated e-OSCAR dismissal under FCRA §611(a)(3). Competitors (Dispute Panda, Ultra Dispute, CreditRefresh) compete on per-item, per-bureau letter uniqueness and real-time rewriting. Static shared templates are a liability; per-letter customization is the current standard.
6. **CFPB complaint policy changed 2026-06-25** — consumers must exhaust FCRA dispute procedures (45 days or no longer pending) before filing. `src/lib/dispute-config-loader.ts:157,186` escalates to CFPB on `no_response` with no such gate.
7. **No competitor hard-blocks letter content.** The industry pattern is disclaim-and-human-review: Client Dispute Manager ("the software itself does not create legal liability; the credit repair business operating the software carries compliance responsibility"), DisputePro AI ToS ("AI-generated content is provided as a starting point and should be reviewed... you are solely responsible for all letters"), Clever Kit (human "compliance moderation," not automated refusal). What competitors market as "compliance engines" is violation *detection in the credit report* plus CROA *workflow* enforcement — not letter-content censorship. **The current binary lint is stricter than the entire market.**
8. **Tone and threat vocabulary are orthogonal axes.** `THREAT_LANGUAGE_PATTERN` (`src/lib/letter-lint.ts:23`) matches `statutory damages|punitive damages|legal action|lawsuit|sue|willful non-compliance` — legal-threat vocabulary, not register. "I demand this item be deleted within 30 days as the law requires" is maximally demanding and trips nothing. DisputeFox ships `concerned → annoyed → disappointed`; Ultra Dispute ships `professional → concerned → annoyed → demanding`. Both are consumer-voice emotional registers, and a genuinely annoyed consumer voice reads *less* third-party-prepared than sterile professional prose. `allowThreatLanguage` already exists as a context flag (`letter-lint.ts:12`) but is hardcoded `false` at **three** sites — `ai-letter-generator.ts:363`, `:378`, and `:1440` — so the escape hatch was designed and never wired.
9. **The statute allowlist is under-maintained, not deliberately tight.** It contains `607`/`607(b)` but not `1681e`/`1681e(b)`, and `604` but not `1681b` — the same provisions under their other statutory name. §1681e(b) is the *maximum possible accuracy* standard, the most-cited provision in FCRA accuracy disputes, and the system blocks it when written in USC form. Also absent: `1681c-2`, `1681n`, `1681o`, `1692e`, `1692f`. Separately, `BUREAU_PATTERN` (`:27`) fails a legitimate cross-reference like "I have also filed this dispute with Equifax and TransUnion" on a letter addressed to Experian.

**Deliberately out of scope** (call it out, do not silently skip):
- Renaming `/api/admin/*` → `/api/workspace/*`. That is 71 route files and 90 referencing files for zero user-visible benefit. Phase 7 stub only.
- Custom user-defined roles. The capability map is built so this is a later data migration, not a rewrite.
- Compliance with S.4144 / H.R.306 (Ending Scam Credit Repair Act). Introduced March 2026, **not law**. Phase 6 adds the CRO disclosure hook so it is a one-line change if it passes.

## Implementation notes — 2026-08-02

- Task 2.0 is obsolete: the existing server-component `/workspace` and `/admin` layouts successfully resolve the Better Auth session and database role before rendering, so no temporary RSC spike route is needed.
- Task 4.0 was landed before library prompt wiring. The lint contract now separates hard fabricated-data blocks from operator-acknowledged warnings.
- The library plan's Phase 1 audit is complete: 20 active library rows, no duplicate signatures, populated prompt context/citations, and 16 documented coverage gaps that use the legacy round-strategy fallback.
- Letter Studio is wired into the workspace dispute detail panel. Manual edits, tone shifts, selected-text rewrites, warning acknowledgement, and revision recording all use the same lint boundary.
- The production build was rerun in the required elevated environment and passes end-to-end; the restricted sandbox still cannot bind Next.js worker ports.

---

## Phase 1: Capability model & the staff role

### Task 1.1: Define capabilities

**Files:**
- Create: `src/lib/capabilities.ts`
- Test: `src/__tests__/lib/capabilities.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { can, ROLE_CAPABILITIES, type Capability } from '@/lib/capabilities';

describe('can', () => {
  it('lets staff work a case', () => {
    expect(can('staff', 'disputes:write')).toBe(true);
    expect(can('staff', 'clients:write')).toBe(true);
    expect(can('staff', 'letters:write')).toBe(true);
  });

  it('lets staff read templates but never write them', () => {
    expect(can('staff', 'templates:read')).toBe(true);
    expect(can('staff', 'templates:write')).toBe(false);
  });

  it('keeps business configuration away from staff', () => {
    expect(can('staff', 'settings:write')).toBe(false);
    expect(can('staff', 'content:write')).toBe(false);
    expect(can('staff', 'billing:system')).toBe(false);
  });

  it('gives admin configuration but not team management', () => {
    expect(can('admin', 'templates:write')).toBe(true);
    expect(can('admin', 'settings:write')).toBe(true);
    expect(can('admin', 'team:manage')).toBe(false);
  });

  it('gives super_admin everything', () => {
    const all = Object.keys(ROLE_CAPABILITIES.super_admin) as Capability[];
    for (const cap of all) expect(can('super_admin', cap)).toBe(true);
    expect(can('super_admin', 'team:manage')).toBe(true);
  });

  it('gives plain users and null roles nothing', () => {
    expect(can('user', 'clients:read')).toBe(false);
    expect(can(null, 'clients:read')).toBe(false);
  });

  it('is monotonic: every staff capability is held by admin and super_admin', () => {
    for (const cap of ROLE_CAPABILITIES.staff) {
      expect(can('admin', cap)).toBe(true);
      expect(can('super_admin', cap)).toBe(true);
    }
  });
});
```

**Step 2: Run it and confirm it fails**

Run: `npx vitest run src/__tests__/lib/capabilities.test.ts`
Expected: FAIL — cannot resolve `@/lib/capabilities`.

**Step 3: Implement**

```typescript
// src/lib/capabilities.ts

/** Every distinct thing a team member can do. Add here first, then grant below. */
export type Capability =
  // Casework — the daily job
  | 'clients:read' | 'clients:write'
  | 'disputes:read' | 'disputes:write'
  | 'letters:write'          // edit THIS dispute's letter text (not the template)
  | 'tasks:read' | 'tasks:write'
  | 'messages:read' | 'messages:write'
  | 'leads:read' | 'leads:write'
  | 'agreements:read' | 'agreements:write'
  | 'billing:client'         // view/charge a specific client
  // Global configuration — one edit affects every client
  | 'templates:read' | 'templates:write'
  | 'content:read' | 'content:write'
  | 'settings:read' | 'settings:write'
  | 'billing:system'
  // Ownership
  | 'team:manage';

export type TeamRole = 'staff' | 'admin' | 'super_admin';
export type AnyRole = TeamRole | 'user' | null;

const STAFF: Capability[] = [
  'clients:read', 'clients:write',
  'disputes:read', 'disputes:write',
  'letters:write',
  'tasks:read', 'tasks:write',
  'messages:read', 'messages:write',
  'leads:read', 'leads:write',
  'agreements:read', 'agreements:write',
  'billing:client',
  'templates:read',
  'content:read',
  'settings:read',
];

const ADMIN: Capability[] = [
  ...STAFF,
  'templates:write',
  'content:write',
  'settings:write',
  'billing:system',
];

const SUPER_ADMIN: Capability[] = [...ADMIN, 'team:manage'];

export const ROLE_CAPABILITIES: Record<TeamRole, Capability[]> = {
  staff: STAFF,
  admin: ADMIN,
  super_admin: SUPER_ADMIN,
};

export function can(role: AnyRole, capability: Capability): boolean {
  if (!role || role === 'user') return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/** True for any role that belongs inside /workspace. */
export function isTeamRole(role: AnyRole): role is TeamRole {
  return role === 'staff' || role === 'admin' || role === 'super_admin';
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/lib/capabilities.test.ts`
Expected: PASS (7 tests).

**Step 5: Commit**

```bash
git add src/lib/capabilities.ts src/__tests__/lib/capabilities.test.ts
git commit -m "feat(auth): add capability model with staff/admin/super_admin tiers"
```

---

### Task 1.2: Add `staff` to the role union

**Files:**
- Modify: `src/lib/admin-auth.ts:5`

No database migration is required. `user.role` is a plain `text` column with a `'user'` default (`db/schema.ts:19`, `drizzle/0000_lazy_marrow.sql:120`) — it has no CHECK constraint or enum, so `'staff'` is already a storable value. **Do not run `drizzle-kit push`.**

**Step 1: Widen the type**

```typescript
export type UserRole = 'user' | 'staff' | 'admin' | 'super_admin';
```

**Step 2: Typecheck to find every exhaustive switch this breaks**

Run: `npm run typecheck`
Expected: errors in `src/lib/admin-auth.ts` (`rolePermissions` record is missing the `staff` key) and possibly `src/contexts/AdminContext.tsx`. Fix each by delegating to the new capability map rather than adding another branch.

**Step 2a: Fix the runtime allowlist typecheck CANNOT catch**

⚠️ `src/app/api/admin/set-role/route.ts` contains a hardcoded string array:

```typescript
const validRoles = ['user', 'admin', 'super_admin'];
```

This is a runtime value, not a type — `npm run typecheck` will pass while `staff` is silently rejected at the API. Replace it with a check derived from the capability map so it can never drift again:

```typescript
import { ROLE_CAPABILITIES } from '@/lib/capabilities';
const validRoles = ['user', ...Object.keys(ROLE_CAPABILITIES)];
```

Also note the **bootstrap rule** in that route (`:13-21` and `:46`): when zero `super_admin` rows exist, an unauthenticated requester may set their own role. Preserve it — it is how the first owner is created — and make sure the Task 2.5 Team screen does not bypass it.

**Landmine to be aware of:** better-auth's `admin()` plugin is registered (`src/lib/auth.ts:28`) alongside `adminClient()` (`src/lib/auth-client.ts:7`), and that plugin carries its own notion of `user.role`. This app does **not** use it — roles are written directly through Drizzle in `set-role/route.ts`. Do not start calling `authClient.admin.setRole` or the two systems will disagree. Either keep the plugin unused for roles, or remove it.

**Step 3: Replace the legacy permission table**

In `src/lib/admin-auth.ts`, delete `AdminPermission`, `rolePermissions`, and `roleHasPermission` — `src/lib/capabilities.ts` supersedes them. The single consumer is `src/app/api/admin/tasks/route.ts:21`; update it in Task 1.4.

**Step 4: Verify**

Run: `npm run typecheck`
Expected: clean, except for the known `tasks/route.ts` import which Task 1.4 fixes.

**Step 5: Commit**

```bash
git add src/lib/admin-auth.ts
git commit -m "feat(auth): add staff to UserRole, retire vestigial permission table"
```

---

### Task 1.3: Server-side capability guard

**Files:**
- Modify: `src/lib/admin-session.ts`
- Test: `src/__tests__/lib/admin-session.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock('@/lib/admin-auth', () => ({ getUserRole: vi.fn() }));

import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { requireCapability } from '@/lib/admin-session';

const session = { user: { id: 'u1', email: 'a@b.com' } };

beforeEach(() => vi.resetAllMocks());

describe('requireCapability', () => {
  it('returns the user when the role holds the capability', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');

    const user = await requireCapability('disputes:write');
    expect(user).toEqual({ id: 'u1', email: 'a@b.com', role: 'staff' });
  });

  it('returns null when the role lacks the capability', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');

    expect(await requireCapability('templates:write')).toBeNull();
  });

  it('returns null when there is no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    expect(await requireCapability('disputes:read')).toBeNull();
  });
});
```

**Step 2: Run it and confirm it fails**

Run: `npx vitest run src/__tests__/lib/admin-session.test.ts`
Expected: FAIL — `requireCapability` is not exported.

**Step 3: Implement**

Add to `src/lib/admin-session.ts`, keeping the existing `getAdminSessionUser` in place so nothing breaks mid-migration:

```typescript
import { can, type Capability } from '@/lib/capabilities';

export async function requireCapability(
  capability: Capability
): Promise<AdminSessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email || !session.user.id) return null;

  const role = await getUserRole(session.user.email);
  if (!can(role, capability)) return null;

  return { id: session.user.id, email: session.user.email, role: role! };
}
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/lib/admin-session.test.ts`
Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add src/lib/admin-session.ts src/__tests__/lib/admin-session.test.ts
git commit -m "feat(auth): add requireCapability server guard"
```

---

### Task 1.4: Migrate the 47 API gate sites (+ 13 others)

This is the largest and riskiest task in the plan. Work in **classified batches**, committing per batch, so a mistake is easy to bisect.

⚠️ **`isSuperAdmin` appears in 60 files, but only 47 are API routes.** The other 13 are three different problems and must not be swept into the same batch:

```bash
grep -rl "isSuperAdmin" src/ --include=*.ts --include=*.tsx | wc -l          # 60 total
grep -rl "isSuperAdmin" src/app/api/admin/ | wc -l                           # 47 ← this task
```

The remaining 13:

| File(s) | Handled by |
|---|---|
| `src/lib/admin-auth.ts` | Task 1.2 (it's the definition) |
| `src/contexts/AdminContext.tsx` | Task 1.5 (client-side role context) |
| `src/app/admin/page.tsx`, `components/admin/dashboard/AnalyticsTab.tsx`, `OperationsTab.tsx` | Task 1.5 — these are **client-side UI gating**, not authorization; convert to `can(...)` |
| 7 test files under `src/__tests__/api/admin/` + `components/admin/__tests__/WorkQueue.test.tsx` | Update in the same batch as the route each one covers, so tests and routes move together |

**Completion check must cover all of them** — the narrower `grep src/app/api/` would report success with 13 files unconverted:

```bash
grep -rn "isSuperAdmin" src/ --include=*.ts --include=*.tsx   # expect: no matches
```

**Classification rule** (from the Phase-1 context findings):

| Route group | Capability |
|---|---|
| `clients/`, `clients-secure/`, `cases/`, `notes/` | `clients:read` / `clients:write` |
| `disputes/`, `dispute-cycles/`, `evidence-packets/`, `credit-reports/` | `disputes:read` / `disputes:write` |
| `tasks/` | `tasks:read` / `tasks:write` |
| `messages/` | `messages:read` / `messages:write` |
| `leads/` | `leads:read` / `leads:write` |
| `agreements/`, `service-engagements/` | `agreements:read` / `agreements:write` |
| `billing/` | `billing:client` (GET) / `billing:system` (mutations) |
| `dispute-templates/` | `templates:read` (GET) / `templates:write` (POST). **No PUT or DELETE exist** — the route exports GET and POST only. |
| `blog-posts/`, `pages/`, `services/`, `testimonials/`, `faqs/`, `disclaimers/`, `email-templates/`, `subscribers/`, `results/` | `content:read` / `content:write` |
| `settings/`, `automation/`, `set-role/` | `settings:write` (`set-role` → `team:manage`) |
| `stats/`, `dashboard/`, `operator-analytics/`, `client-outcome-analytics/` | `clients:read` |

**Per-route mechanical change:**

```typescript
// BEFORE
async function validateAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) return null;
  const isAdmin = await isSuperAdmin(session.user.email);
  if (!isAdmin) return null;
  return session.user;
}
export async function GET() {
  const adminUser = await validateAdmin();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  ...
}

// AFTER — delete the local validateAdmin entirely
import { requireCapability } from '@/lib/admin-session';

export async function GET() {
  const user = await requireCapability('disputes:read');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  ...
}
```

Note the status change: **401 → 403** when authenticated but under-privileged. Keep 401 only for "no session at all" if a route distinguishes; otherwise 403 is correct and the frontend must not treat it as "log in again."

**Critical: `dispute-templates/route.ts` splits by method.** `GET` → `templates:read` (staff must see templates to pick one in the wizard). `POST`/`PUT`/`DELETE` → `templates:write`. This is the whole point of the phase; do not gate the whole file at `templates:write`.

**Per batch:**
1. Convert the batch.
2. Run: `npm run typecheck && npx vitest run src/__tests__/api/`
3. Commit: `git commit -m "refactor(auth): migrate <group> routes to capability guards"`

**After all batches:**

```bash
grep -rn "isSuperAdmin" src/app/api/   # expect: no matches
npm run validate
```

Then delete `isSuperAdmin` from `src/lib/admin-auth.ts` if it has no remaining callers, and commit.

---

### Task 1.5: Wire the real role into the client context

**Files:**
- Modify: `src/contexts/AdminContext.tsx`
- Modify: `src/components/admin/AdminGuard.tsx:12,119-121`
- Modify: `src/app/api/admin/check-access/route.ts`

**Step 1:** In `check-access/route.ts`, replace `getAdminSessionUser('super_admin')` with a check that any team role passes, and return the capability list so the client can gate UI without a round trip per check:

```typescript
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { isTeamRole, ROLE_CAPABILITIES } from '@/lib/capabilities';

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) {
    return NextResponse.json({ authorized: false, role: null, capabilities: [] }, { status: 401 });
  }
  const role = await getUserRole(session.user.email);
  if (!isTeamRole(role)) {
    return NextResponse.json({ authorized: false, role: null, capabilities: [] }, { status: 403 });
  }
  return NextResponse.json({
    authorized: true,
    role,
    capabilities: ROLE_CAPABILITIES[role],
    user_id: session.user.id,
    user_email: session.user.email,
  });
}
```

**Step 2:** In `AdminContext.tsx`, replace the `isSuperAdmin`/`isAdmin`/`isStaff` booleans with a `can(capability)` function backed by the returned list. Keep `role` for display only.

**Step 3:** In `AdminGuard.tsx`, rewrite the denial copy at `:119-121` — it currently leaks the internal slug `super_admin` to end users. Replace with: *"Your account doesn't have access to this area. If you think that's wrong, ask your administrator."*

**Step 4:** Run: `npx vitest run src/components/admin/__tests__/AdminGuard.test.tsx` and update the `staff` assertions at `:439,453` — they now describe real behavior instead of a phantom.

**Step 5: Commit**

```bash
git commit -m "feat(auth): serve real role + capabilities to the client context"
```

---

## Phase 2: Split `/admin` into `/workspace` + `/admin`

### Task 2.0: Spike — prove server-component auth works here (do this first)

⚠️ **This repo has no precedent for it.** Every page and layout under `src/app` that touches auth is a `'use client'` component; `auth.api.getSession` is only ever called from route handlers. Phases 2 and 3 both rest on it working in a server component. Prove it in ten minutes before building on it.

**Files:** Create `src/app/workspace/_spike/page.tsx` (delete after).

```typescript
// NO 'use client'
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';

export default async function Spike() {
  const session = await auth.api.getSession({ headers: await headers() });
  const role = session?.user?.email ? await getUserRole(session.user.email) : null;
  return <pre>{JSON.stringify({ email: session?.user?.email ?? null, role }, null, 2)}</pre>;
}
```

Run `npm run dev`, sign in, visit `/workspace/_spike`.

- **Expected:** your email and role render server-side (confirm via View Source, not devtools — it must be in the initial HTML).
- **If it throws** (edge/runtime, `headers()` misuse, or a Drizzle connection issue in the RSC context): stop. Fall back to a `middleware.ts` cookie-presence check for the cheap redirect plus the existing client guard for authorization, and revise Tasks 2.1/2.3/3.1 accordingly. Do not proceed as written.

Delete the spike directory before committing anything else.

---

### Task 2.1: Server-component auth layout

The current shell is `'use client'` (`src/app/admin/layout.tsx:1`) because it owns sidebar state, which is why authorization could never run server-side. Split it.

**Note on cost:** `/admin` nests inside no shared parent, but if you later nest `/admin` under `/workspace`, both layouts would call `getSession` on every navigation. Keep them siblings, or hoist the lookup into a `cache()`-wrapped helper.

**Files:**
- Create: `src/app/workspace/layout.tsx` (server component)
- Create: `src/components/workspace/WorkspaceShell.tsx` (client, from the old layout body)

```typescript
// src/app/workspace/layout.tsx  — NO 'use client'
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { isTeamRole, ROLE_CAPABILITIES } from '@/lib/capabilities';
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) redirect('/sign-in?next=/workspace');

  const role = await getUserRole(session.user.email);
  if (!isTeamRole(role)) redirect('/portal');

  return (
    <WorkspaceShell
      role={role}
      capabilities={ROLE_CAPABILITIES[role]}
      userId={session.user.id}
      userEmail={session.user.email}
    >
      {children}
    </WorkspaceShell>
  );
}
```

`WorkspaceShell` is the old `AdminLayout` body verbatim (sidebar state, mobile drawer, paper sheet) minus `AdminGuard`, now receiving role/capabilities as props instead of fetching them. **`AdminGuard` is deleted** — the redirect happens before any HTML ships, which is the entire point.

Note the `?next=` param: Task 3.3 makes `/sign-in` honor it.

**Commit:** `git commit -m "feat(workspace): server-side auth layout, retire client AdminGuard"`

---

### Task 2.2: Move the casework routes

```bash
git mv src/app/admin src/app/workspace
git mv src/components/admin src/components/workspace
```

Then move the configuration routes back out into a new `/admin`:

```bash
mkdir -p src/app/admin
for d in content blog services testimonials faqs disclaimers email-templates subscribers settings dispute-templates; do
  git mv "src/app/workspace/$d" "src/app/admin/$d"
done
```

**Final surface split:**

| `/workspace` (staff+) | `/admin` (admin+) |
|---|---|
| Dashboard, Clients, Agreements, Messages | Letter Templates |
| Disputes, Results, Wizard, Compliance | Pages, Blog, Services, Testimonials |
| Tasks, Contact Leads, Bookings | FAQs, Disclaimers, Email Templates, Subscribers |
| Billing (client-level view) | Settings, Billing (system), Team & Roles |

Update every internal link. The literals live in 19 files:

```bash
grep -rln "'/admin\|\"/admin" src/ --include=*.tsx --include=*.ts
```

Specific files needing hand edits (not blind sed — each has a decision):
- `src/components/workspace/AdminSidebar.tsx:50-102` → rewrite `navSections`; Content section becomes a **single footer row** "Admin" rendered only when `can('content:write')`, linking to `/admin`.
- `src/components/workspace/AdminTopBar.tsx:14` → `SEGMENT_LABELS.admin` becomes `workspace: 'Dashboard'`; add `admin: 'Administration'`.
- `src/components/workspace/AdminTopBar.tsx:57` → breadcrumb root `/admin` → `/workspace`.
- `src/components/workspace/CommandPalette.tsx:9-16` → update hrefs.
- `src/components/Header.tsx:122-135,233-241` → the menu item becomes "Workspace" → `/workspace`, shown when the user holds any team role (fixes the admin-sees-link-then-denied bug).
- `src/components/LayoutWrapper.tsx:9` → strip marketing chrome for `/workspace`, `/admin`, **and `/portal`** (see Task 3.1).

**Verify:** `npm run typecheck && npm run build`

**Commit:** `git commit -m "refactor(routes): split /admin into /workspace casework and /admin config"`

---

### Task 2.3: `/admin` layout gated on `content:write`

**Files:** Create `src/app/admin/layout.tsx`

Same server-component shape as Task 2.1, but redirects to `/workspace` (not `/sign-in`) when the user is a team member lacking admin capability — a staff member who guesses the URL lands back at their desk, not at an error page.

```typescript
const role = await getUserRole(session.user.email);
if (!isTeamRole(role)) redirect('/portal');
if (!can(role, 'content:write')) redirect('/workspace');
```

**Commit:** `git commit -m "feat(admin): capability-gated administration layout"`

---

### Task 2.4: Redirects so bookmarks survive

**Files:** Modify `next.config.ts`

`next.config.ts` currently has **no** `redirects()` — only `headers()` at `:43`. You are adding this from scratch.

⚠️ **Do not use a `/admin/:path*` catch-all.** It would drag `/admin/settings` and the other config routes — which legitimately stay at `/admin` — into `/workspace/*`, where nothing exists. Shielding them with identity redirects (`source === destination`) is not a supported Next.js pattern and risks a redirect loop. **Enumerate the moved paths explicitly.** The list is closed and short, and it fails loudly rather than silently:

```typescript
const MOVED_TO_WORKSPACE = [
  'clients', 'agreements', 'messages', 'billing',
  'disputes', 'results', 'compliance',
  'tasks', 'leads', 'bookings',
];

async redirects() {
  return [
    ...MOVED_TO_WORKSPACE.flatMap((s) => [
      { source: `/admin/${s}`,        destination: `/workspace/${s}`,        permanent: true },
      { source: `/admin/${s}/:path*`, destination: `/workspace/${s}/:path*`, permanent: true },
    ]),
    { source: '/admin', destination: '/workspace', permanent: true },
  ];
}
```

The last rule sends the bare `/admin` bookmark to the workspace dashboard. If you would rather it land on an administration index, create `src/app/admin/page.tsx` and drop that rule.

**Verify:** `npm run build && npm start`, then curl each of: `/admin` → 308 `/workspace`; `/admin/clients` → 308 `/workspace/clients`; `/admin/clients/123` → 308 `/workspace/clients/123`; `/admin/settings` → **200, not a redirect**; `/admin/dispute-templates` → **200**.

**Commit:** `git commit -m "feat(routes): preserve /admin bookmarks with redirects"`

---

### Task 2.5: Team & Roles screen

**Files:**
- Create: `src/app/admin/team/page.tsx`
- Create: `src/app/api/admin/team/route.ts` (GET list, PATCH role) — gated `team:manage`
- Test: `src/__tests__/api/admin/team.test.ts`

Matches the market standard (Credit Repair Cloud, DisputeFox both ship this): list team members with role, last active, and a role selector. Guardrails to test explicitly:
- A `super_admin` cannot demote themselves if they are the last one (prevents lockout).
- Only `team:manage` may change roles — `admin` must get 403.
- Every role change writes an audit row (Task 6.2's table).

**Commit:** `git commit -m "feat(admin): team and roles management"`

---

## Phase 3: Client portal fixes

### Task 3.1: Give the portal its own shell

**Files:**
- Create: `src/app/portal/layout.tsx` (server component — auth + chrome)
- Modify: `src/components/LayoutWrapper.tsx:9`
- Modify: `src/components/portal/PortalHeader.tsx:11`

Fixes three defects at once: `PortalNav` vanishing on sub-pages (it renders only inside `src/app/portal/page.tsx:145`), the duplicated inline auth checks in all three portal pages, and the marketing header/footer wrapping a logged-in client's workspace.

The layout renders `PortalHeader` + `PortalNav` once, so `/portal/agreement` and `/portal/audit-report` keep their tabs. Add `/portal` to the `LayoutWrapper` exclusion list, then drop the `pt-28` from `PortalHeader.tsx:11` — the offset only existed to clear the fixed marketing header.

Delete the now-dead `if (!user)` blocks from `src/app/portal/page.tsx:123-138`, `agreement/page.tsx:275-293`, `audit-report/page.tsx:95`.

**Commit:** `git commit -m "feat(portal): dedicated server-authed layout with persistent nav"`

---

### Task 3.2: Surface the portal in navigation

**Files:** `src/components/Header.tsx`, `src/components/Footer.tsx:8-17`

`href="/portal"` currently appears in exactly two places app-wide (`src/app/settings/page.tsx:185`, `src/app/profile/page.tsx:151`) — neither in any nav. Add "My Portal" to the header user menu for signed-in non-team users, and a portal link to the footer's Company column.

**Commit:** `git commit -m "feat(nav): surface client portal in header and footer"`

---

### Task 3.3: Role-aware post-sign-in redirect

**Files:** Modify `src/app/(auth)/sign-in/page.tsx:32`

`router.push('/')` sends everyone to the marketing homepage. Replace with a `?next=` honoring redirect that falls back to a new `GET /api/auth/landing` returning `/workspace` for team roles and `/portal` for clients.

**Test (Playwright):** `e2e/auth-redirect.spec.ts` — a client signing in lands on `/portal`; a staff user lands on `/workspace`; `?next=/workspace/clients` is honored for staff and rejected (falls back to `/portal`) for clients.

**Commit:** `git commit -m "feat(auth): role-aware landing after sign-in"`

---

### Task 3.4: Promote pending approvals

**Files:** Modify `src/app/portal/page.tsx:167-210`

`PortalHeader.tsx:36` promises "Open tasks and approvals are surfaced before everything else," but `PortalLetterConsent` sits fourth in the right rail. When `pendingLetters.length > 0`, render a full-width banner above the grid. This is the one blocking, revenue-gating client action.

**Commit:** `git commit -m "fix(portal): promote pending letter approvals above the fold"`

---

## Phase 4: Letter Studio — per-dispute editing & AI rewriting

The centerpiece. Every path — manual edit, AI rewrite, tone shift — runs through `lintGeneratedLetter`, but that function is first **refactored from a binary blocker into severity tiers** (Task 4.0). The operator, not the software, becomes the decision-maker on everything except fabricated data.

**Where the block/warn line sits, and why:**

| Check | Tier | Rationale |
|---|---|---|
| Account number / creditor / bureau not in source data | **block** | Fabrication. Direct CROA §1679b(a)(1) exposure and the actual FCRA §611(a)(3) frivolous trigger. No legitimate use case. This is also the one control competitors *don't* have — keep it as an edge. |
| Identity-theft claim without documented flag | **block** | Filing false identity-theft claims is explicitly prohibited conduct in every competitor ToS reviewed. |
| Threat / damages vocabulary | **warn** | Overridable. Kept loud because it's a *business* argument, not a compliance one — per creditbutterfly.ai (Apr 2026), explicit litigation threats destroy the letter's evidentiary value in later FCRA litigation, since an attorney can't take a letter into court that telegraphed strategy before the dispute was processed. Operator's call. |
| Statute citation outside allowlist | **warn** | The allowlist blocks correct law today (finding 9). The industry is genuinely split on whether to cite statutes at all — CreditRefresh says cite precisely, CreditButterfly says never. Both are vendor blogs with product incentives. Not a decision software should make silently. |
| Ownership denial without reason code | **warn** | Legitimate when the reason code is simply not yet set. |

**Tone ladder ships in full** — `professional → concerned → annoyed → disappointed → demanding` — because tone is a separate axis from threat vocabulary (finding 8).

---

### Task 4.0: Refactor the lint into severity tiers

**Files:**
- Modify: `src/lib/letter-lint.ts`
- Modify: `src/lib/ai-letter-generator.ts:353-388` (lint context builders + `assertLetterLint`)
- Test: `src/__tests__/lib/letter-lint.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { lintGeneratedLetter } from '@/lib/letter-lint';

const ctx = {
  reasonCodes: ['inaccurate_balance'],
  items: [{ creditorName: 'Acme Bank', accountNumber: '****1234', bureau: 'experian' }],
};

describe('lintGeneratedLetter severity tiers', () => {
  it('BLOCKS a creditor absent from source data', () => {
    const r = lintGeneratedLetter('Creditor Name: Fabricated Corp', ctx);
    expect(r.blocked).toBe(true);
    expect(r.findings.some(f => f.severity === 'block' && f.code === 'unknown_creditor')).toBe(true);
  });

  it('BLOCKS an account number absent from source data', () => {
    const r = lintGeneratedLetter('regarding account ****9999', ctx);
    expect(r.blocked).toBe(true);
  });

  it('BLOCKS an undocumented identity-theft claim', () => {
    const r = lintGeneratedLetter('This is identity theft.', ctx);
    expect(r.blocked).toBe(true);
  });

  it('WARNS but does not block on threat language', () => {
    const r = lintGeneratedLetter('I will pursue legal action.', ctx);
    expect(r.blocked).toBe(false);
    expect(r.findings.some(f => f.severity === 'warn' && f.code === 'threat_language')).toBe(true);
  });

  it('WARNS but does not block on an unlisted statute', () => {
    const r = lintGeneratedLetter('Under 15 U.S.C. § 1681q this is improper.', ctx);
    expect(r.blocked).toBe(false);
    expect(r.findings.some(f => f.severity === 'warn' && f.code === 'statute_not_allowlisted')).toBe(true);
  });

  it('accepts 1681e(b) and 1681b — same provisions as the already-allowed 607(b) and 604', () => {
    const r = lintGeneratedLetter('Under 15 U.S.C. § 1681e(b) and § 1681b...', ctx);
    expect(r.findings).toHaveLength(0);
  });

  it('allows cross-referencing other bureaus', () => {
    const r = lintGeneratedLetter('I have also filed this with Equifax and TransUnion.', ctx);
    expect(r.blocked).toBe(false);
    expect(r.findings).toHaveLength(0);
  });

  it('passes a clean demanding-tone letter with no findings at all', () => {
    const r = lintGeneratedLetter(
      'I demand this item be corrected within 30 days as the law requires.', ctx);
    expect(r.blocked).toBe(false);
    expect(r.findings).toHaveLength(0);
  });
});
```

**Step 2: Run and confirm failure**

Run: `npx vitest run src/__tests__/lib/letter-lint.test.ts`
Expected: FAIL — the current shape returns `{ passed, reasons: string[] }`, not `{ blocked, findings }`.

**Step 3: Implement**

New result shape (keep `passed` as a derived alias so nothing mid-migration explodes):

```typescript
export type LintSeverity = 'block' | 'warn';

export interface LetterLintFinding {
  code: string;            // stable id, e.g. 'threat_language'
  severity: LintSeverity;
  message: string;         // operator-facing, plain language
}

export interface LetterLintResult {
  blocked: boolean;              // any finding with severity 'block'
  findings: LetterLintFinding[];
  /** @deprecated use `blocked`. Retained so existing callers keep compiling. */
  passed: boolean;
  /** @deprecated use `findings`. */
  reasons: string[];
}
```

Required changes inside the function:

1. **Fix the allowlist asymmetry** — add `1681e`, `1681e(b)`, `1681b`, `1681c-2`, `1681n`, `1681o`, `1692e`, `1692f` to `ALLOWED_STATUTE_TOKENS`, then emit `severity: 'warn'` (not block) for anything still unlisted.
2. **Drop the bureau check to informational** — remove `BUREAU_PATTERN` findings entirely for bureaus other than the target; a cross-reference is normal correspondence. Only the account/creditor cross-checks remain as blocks.
3. **Retire `allowThreatLanguage`** — threat language is now always a warn, never a block, so the flag has no meaning. Delete it from `LetterLintContext` and from **all three** sites: `ai-letter-generator.ts:363` and `:378` (the two `build*LintContext` helpers), plus `:1440` inside `generateFactualMetro2DisputeLetter` — that third one is an **inline** `lintGeneratedLetter` call that does not use the helpers and checks `lintResult.passed`, the field this refactor deprecates. Miss it and Metro 2 letter generation breaks silently.
4. `assertLetterLint` (`ai-letter-generator.ts:383`) now throws **only when `blocked`**, so generation still refuses fabricated data but no longer refuses firm language.

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/lib/letter-lint.test.ts && npm run test`
Expected: the 8 new tests PASS; fix any existing letter-generation test asserting the old `{passed, reasons}` shape.

**Step 5: Commit**

```bash
git add src/lib/letter-lint.ts src/lib/ai-letter-generator.ts src/__tests__/lib/letter-lint.test.ts
git commit -m "refactor(compliance): tier letter lint into blocks and overridable warnings"
```

---

### Task 4.1: Revision history table

**Files:**
- Modify: `db/schema.ts` (append)
- Create: migration via `npm run db:generate`

```typescript
export const disputeLetterRevisions = pgTable('dispute_letter_revisions', {
  id: text('id').primaryKey(),
  disputeId: text('dispute_id').notNull().references(() => disputes.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull(),          // 1-based, per dispute
  content: text('content').notNull(),
  source: text('source').notNull(),                 // 'generated' | 'manual' | 'ai_rewrite' | 'ai_tone' | 'revert'
  toneLabel: text('tone_label'),                    // set when source = 'ai_tone'
  promptUsed: text('prompt_used'),                  // audit: what we asked the model
  lintFindings: text('lint_findings'),              // JSON array of LetterLintFinding
  warningsAcknowledged: boolean('warnings_acknowledged').default(false),
  acknowledgedBy: text('acknowledged_by').references(() => user.id),
  createdBy: text('created_by').references(() => user.id),
  createdAt: timestamp('created_at').defaultNow(),
});
```

⚠️ **Generate and apply the migration properly — never `drizzle-kit push`.**

```bash
npm run db:generate    # writes drizzle/NNNN_*.sql — review it
npm run db:migrate
```

**Commit:** `git commit -m "feat(db): dispute letter revision history"`

---

### Task 4.2: Persist edited letter text

**Files:**
- Modify: `src/app/api/admin/disputes/[id]/route.ts:227-310`
- Test: `src/__tests__/api/admin/dispute-letter-edit.test.ts`

**Step 1: Write failing tests**

```typescript
describe('PUT /api/admin/disputes/[id] letterContent', () => {
  it('saves a clean edit and records a revision', async () => { /* 200, revision row source='manual' */ });

  it('BLOCKS an edit naming a creditor absent from source data', async () => {
    // expect 422 { error, findings: [{severity:'block', ...}] } and NO write to disputes.letterContent
  });

  it('saves an edit carrying only warnings when acknowledgeWarnings is true', async () => {
    // threat language + acknowledgeWarnings: true
    // expect 200, revision row with warningsAcknowledged=true and acknowledgedBy set
  });

  it('refuses an edit carrying warnings when acknowledgeWarnings is absent', async () => {
    // expect 409 { error, findings } so the UI can present them for confirmation — NOT a hard failure
  });

  it('never lets acknowledgeWarnings bypass a block-severity finding', async () => {
    // fabricated creditor + acknowledgeWarnings: true → still 422
  });

  it('rejects a caller without letters:write', async () => { /* 403 */ });
  it('refuses to edit a letter on a dispute already sent', async () => { /* 409 */ });
});
```

**Step 2:** Run — FAIL (`letterContent` is silently ignored today).

**Step 3: Implement.** Add to the update block:

```typescript
if (letterContent !== undefined) {
  if (!can(user.role, 'letters:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (dispute.status === 'sent' || dispute.sentAt) {
    return NextResponse.json(
      { error: 'This letter has already been sent and cannot be edited. Start a new round instead.' },
      { status: 409 },
    );
  }

  const lint = lintGeneratedLetter(letterContent, await buildLintContextForDispute(dispute));

  // Blocks are absolute — acknowledgeWarnings must never bypass them.
  if (lint.blocked) {
    return NextResponse.json(
      { error: 'This letter references data that is not in the client\'s file.', findings: lint.findings },
      { status: 422 },
    );
  }

  // Warnings are the operator's call, but must be an explicit call.
  const warnings = lint.findings.filter(f => f.severity === 'warn');
  if (warnings.length > 0 && !acknowledgeWarnings) {
    return NextResponse.json(
      { error: 'needs_acknowledgement', findings: warnings },
      { status: 409 },
    );
  }

  updateData.letterContent = letterContent;
  await recordLetterRevision({
    disputeId,
    content: letterContent,
    source: 'manual',
    lintFindings: lint.findings,
    warningsAcknowledged: warnings.length > 0,
    acknowledgedBy: warnings.length > 0 ? user.id : null,
    createdBy: user.id,
  });
}
```

The 409-with-findings is deliberate: the UI shows the warnings, the operator confirms, the same request replays with `acknowledgeWarnings: true`, and the acknowledgement is attributed in the revision row. That is the human-in-the-loop pattern the market uses, with an audit trail the market mostly doesn't have.

The 409 is a CROA point, not a UX nicety: an already-mailed letter is part of the audit record (15 U.S.C. §1679g) and must stay immutable.

`buildLintContextForDispute` is a new helper in `src/lib/letter-lint-context.ts` that reconstructs `LetterLintContext` from the persisted dispute + its negative item, mirroring `buildLetterLintContext` at `src/lib/ai-letter-generator.ts:353`.

**Steps 4-5:** Run tests → PASS. Commit `feat(disputes): editable per-dispute letter text with compliance gate`.

---

### Task 4.3: AI rewrite endpoint

**Files:**
- Create: `src/app/api/admin/disputes/[id]/letter/rewrite/route.ts`
- Create: `src/lib/letter-rewriter.ts`
- Test: `src/__tests__/lib/letter-rewriter.test.ts`

Three modes, matching the market capability set:

| Mode | Behavior |
|---|---|
| `rewrite` | Regenerate the same substance in fresh language — the anti-pattern-match lever. |
| `tone` | Shift register along the full ladder (below). |
| `custom` | Apply a free-text staff instruction ("lead with the balance discrepancy"). |

**Ship the full ladder.** Matches Ultra Dispute (`professional → concerned → annoyed → demanding`) and DisputeFox (`concerned → annoyed → disappointed`), unioned. These are consumer-voice emotional registers, not legal threats — a genuinely annoyed consumer reads *less* third-party-prepared than sterile professional prose, which is the whole point of the feature. Tone does not touch the threat-vocabulary axis; that stays an independent overridable warning (Task 4.0).

```typescript
// src/lib/letter-rewriter.ts
export type RewriteMode = 'rewrite' | 'tone' | 'custom';
export type LetterTone =
  | 'professional'   // measured, businesslike
  | 'concerned'      // consumer worried about the impact
  | 'annoyed'        // consumer frustrated at repeated failure
  | 'disappointed'   // consumer let down after prior rounds
  | 'demanding';     // insistent on the remedy — firm, still factual

export interface RewriteParams {
  currentLetter: string;
  mode: RewriteMode;
  tone?: LetterTone;
  instruction?: string;
  lintContext: LetterLintContext;
}

export interface RewriteResult {
  letter: string;
  blocked: boolean;                    // model produced fabricated data twice
  findings: LetterLintFinding[];       // warnings ride along for the operator to judge
  attempts: number;
}

export async function rewriteLetter(params: RewriteParams): Promise<RewriteResult>;
```

Implementation notes:
- Reuse `generateWithLLM` and `getLLMConfig` from `src/lib/settings-service.ts`. The google/openai branches force `response_format: json_object` (`src/lib/ai-letter-generator.ts:18,30`), so wrap output as `{"letter": "..."}` and parse with the existing `safeParseJsonObject`.
- **Retry once on `blocked` only.** A warning is not a failure — return the letter with its findings attached and let the operator decide. Retrying on warnings would re-introduce the censorship this refactor removes, and burns a paid LLM call to do it.
- If the second attempt is still `blocked`, return `blocked: true` and do not persist. Never silently fall back to the original — staff must see that the model invented data.
- The prompt states only the **block-tier** invariants: use only account numbers, creditor names, and bureaus present in the source data; do not assert identity theft unless the flag is set. Deliberately say nothing about tone, statutes, or firmness — those are the operator's domain now, and over-constraining the prompt is what produced flat, template-shaped output in the first place.
- Tone prompts should target *consumer voice*, not legal escalation. `annoyed` means "a real person who has explained this twice already," not "a paralegal citing damages."

**Route:** gated `letters:write`; rate-limit per dispute (rewriting is a paid LLM call); on success write a revision row with `source: 'ai_rewrite' | 'ai_tone'`, the `promptUsed`, and the findings.

**Tests** mock `generateWithLLM`: happy path returns a clean letter; a model output with threat language returns `blocked: false` **with a warning finding and no retry**; a model output inventing a creditor retries once and succeeds; two fabricating attempts return `blocked: true` and persist nothing; each of the five tones produces a distinct prompt.

**Commit:** `git commit -m "feat(disputes): AI letter rewrite with full tone ladder"`

---

### Task 4.4: Letter Studio UI

**Files:**
- Create: `src/components/workspace/disputes/LetterStudio.tsx`
- Modify: `src/components/workspace/dispute-wizard/StepReview.tsx`
- Modify: the dispute detail page to mount the studio

The screen that currently does not exist anywhere in the product. Layout:

- **Left:** editable letter body (monospace textarea, autosave-on-blur through Task 4.2's endpoint).
- **Selection-scoped rewriting.** DisputeFox's actual implementation — verified from their features page — is *"highlight the section you want AI to re-write, then choose the escalation level... Sentences, Paragraphs, or even Templates."* Match that: when the operator has text selected, the AI actions apply to the selection and splice the result back in; with no selection they apply to the whole letter. This is a better fit for the workflow than whole-letter-only rewriting, since most edits are one weak paragraph.
- **Right rail:** compliance panel, revision history with one-click revert, and the AI action group — *Rewrite*, the five-step tone selector, and a custom-instruction box.
- **Diff view** between the current draft and any prior revision.
- Read-only with an explanatory banner when the dispute is `sent` (mirrors the 409).

**The compliance panel is the piece that carries the new tiering, and its tone matters.** It is an advisor, not a gatekeeper:

- **Blocks** render red and disable Save, naming the offending value: *"This letter names 'Fabricated Corp', which isn't on the client's file."* Only two conditions reach here.
- **Warnings** render amber, inline, never disabling anything: *"Mentions legal action. Bureaus tend to treat threats as noise, and it can weaken the letter's value if this becomes an FCRA case later."* Save stays enabled; clicking it surfaces a single confirm listing the warnings, which replays the request with `acknowledgeWarnings: true`.
- **Clean** renders a quiet checkmark, not a celebration.

Write the warning copy as information, not permission. The operator is a professional making a judgment call about their own client's letter — the software's job is to make sure they know what's in it, then get out of the way.

Hide every AI action behind `can('letters:write')`. Show template selection as read-only for staff, with an "Ask an admin to change the template" affordance rather than a dead disabled button.

**Test (Playwright):** `e2e/letter-studio.spec.ts` — edit and save; trigger a rewrite and see the body change; each tone produces different text; a warning appears, Save stays enabled, and confirming persists with the acknowledgement recorded; a fabricated creditor disables Save; revert to revision 1; a sent dispute renders read-only.

**Commit:** `git commit -m "feat(workspace): Letter Studio with AI rewrite and revision history"`

---

## Phase 5: Compliance corrections

### Task 5.1: CFPB 45-day exhaustion gate

**Files:**
- Create: `src/lib/cfpb-eligibility.ts`
- Modify: `src/lib/dispute-config-loader.ts:157,186`
- Test: `src/__tests__/lib/cfpb-eligibility.test.ts`

Per the CFPB's 2026-06-25 complaint-system overhaul, a consumer must first pursue the FCRA dispute with the CRA and attest either that 45 days have passed or that the dispute is no longer pending. The escalation triggers currently route `no_response → cfpb_complaint` with no such check.

```typescript
export interface CfpbEligibility { eligible: boolean; reason?: string; eligibleAt?: Date; }

export function assessCfpbEligibility(dispute: {
  sentAt: Date | null;
  status: string;
  responseReceivedAt: Date | null;
}, now: Date = new Date()): CfpbEligibility;
```

Rules: not eligible unless `sentAt` is set; eligible when `responseReceivedAt` is set (no longer pending); otherwise eligible only once `now >= sentAt + 45 days`, returning `eligibleAt` so the UI can say when. Block the escalation path and surface the date rather than failing silently.

**Commit:** `git commit -m "fix(compliance): gate CFPB escalation on 45-day FCRA exhaustion"`

---

### Task 5.2: Direct-dispute advisory

**Files:** Modify `src/components/workspace/dispute-wizard/StepConfigure.tsx`

Under **12 CFR §1022.43(b)(2)** a furnisher need not investigate a direct dispute it reasonably believes was prepared by a credit repair organization. The wizard offers `direct_creditor` (`src/lib/dispute-config-loader.ts:186` escalates `verified → direct_creditor`) with no such warning. Add an inline advisory when the target is `creditor`/`collector`, noting the bureau path carries stronger investigation duties. Advisory only — do not block; direct disputes remain legitimate.

**Commit:** `git commit -m "feat(compliance): Reg V direct-dispute advisory in wizard"`

---

## Phase 6: Audit trail

### Task 6.1: ~~Template change attribution~~ — CUT

**Cut deliberately, after audit.** This task existed to attribute template *edits*, on the belief that a template edit changed outgoing letters. Both halves were wrong (finding 3): templates cannot be edited — the route is GET/POST only — and nothing reads the table, so no template has ever reached a bureau. Attributing writes to an inert table is busywork.

`templates:write` therefore ends up guarding exactly one endpoint (`POST /api/admin/dispute-templates`) that produces rows nobody consumes. Keep the capability — it costs nothing, and it becomes meaningful the moment the companion library-wiring plan lands — but do not build audit machinery around it now.

The real letter-provenance audit belongs to `dispute_letter_revisions` (Task 4.1), which tracks the text that actually gets mailed.

### Task 6.2: Team activity log

**Files:** Create `admin_activity_log` table + write helper; call from role changes, template writes, settings writes.

Matches the DisputeFox pattern (team page shows "the history of actions each has taken"). Surface it on the Task 2.5 Team screen.

**Commit:** `git commit -m "feat(audit): team activity log"`

---

## Phase 7 (deferred, not scheduled)

- Rename `/api/admin/*` → `/api/workspace/*` — 71 routes, 90 referencing files, zero user-visible benefit. Only worth doing alongside another large API change.
- Custom user-defined roles: move `ROLE_CAPABILITIES` from code into a `roles` table. Because every gate calls `can()`, this touches the map and the team UI only — no route changes.
- CRO disclosure on dispute letters (name, state license number, statutory disclosure) if S.4144 / H.R.306 becomes law. Hook: `postProcessLetter` at `src/lib/ai-letter-generator.ts:408`.
- Command palette record search — `src/components/workspace/CommandPalette.tsx` promises "Search clients, disputes…" (`AdminTopBar.tsx:113`) but only filters 8 static links.

---

## Verification gates

Run before every commit:

```bash
npm run typecheck && npm run lint && npm run test
```

Run before each phase is considered done:

```bash
npm run validate      # lint + typecheck + test + build
npm run test:e2e
```

**Manual smoke test per phase** — no phase is done until a real `staff` account has been exercised:

1. Set a test user to `staff` (via the Task 2.5 Team screen, once it exists).
2. Sign in → must land on `/workspace`, not `/`.
3. Open a client, open a dispute, edit letter text, run an AI rewrite, cycle all five tones → all succeed and produce visibly different letters.
3a. Paste a letter containing "I will pursue legal action" → amber warning, Save still enabled, confirm dialog, saves with the acknowledgement attributed.
3b. Paste a letter naming a creditor not on the file → red block, Save disabled, no way to override.
4. Navigate to `/admin` directly → must redirect to `/workspace`, not error.
5. Confirm no "Admin" row appears in the staff sidebar.
6. Sign in as a client → must land on `/portal`; tabs must persist across all three portal pages; no marketing header or footer.

## Completion handoff

Scheduled implementation is consolidated in `docs/plans/2026-08-02-workspace-portal-letter-studio-completion.md`. Capability migration, portal layout ownership, transactional letter workflow, generated draft persistence, Letter Studio modules, CFPB decision policy, and authenticated Playwright setup are implemented in the shared worktree. The remaining verification gates are authenticated browser execution and migration application against the intended development database.

### Validation update — 2026-08-02

- `npm run typecheck`, `npm run lint`, and `git diff --check` pass.
- Current elevated `npm run validate` passes end-to-end; its lint, typecheck, full Vitest, and production-build stages all exit 0.
- Current full Vitest suite passes: 121 files passed, 1 skipped; 885 tests passed, 27 skipped (912 total).
- Focused CFPB closure coverage passes across 5 files and 16 tests, including the missing CRA-item-attribution regression.
- `npm run test:e2e -- --list` passes and enumerates 94 authenticated browser tests across Chromium, Firefox, and WebKit. The live run remains pending because the deterministic `E2E_PASSWORD` and an authorized, seeded development-database run are not available.
- An earlier escalated Chromium run started successfully but stopped at the deterministic setup guard because `E2E_PASSWORD` was missing; 20 dependent browser tests from the then-current suite did not run. The expanded 94-test suite still awaits a credentialed run.
- Migrations `0037` through `0040` are present for the completed schema work; database application must be confirmed against the intended development database.
- `npm run db:migrate` reached the configured Neon driver but exited 1 without a migration result. Escalated application was not performed because the target database ownership/environment could not be verified from the workspace.
- The default Next 16 Turbopack build fails in the restricted sandbox while binding a worker port (`Operation not permitted`), but the current escalated production build passes end-to-end, including compilation, TypeScript, page-data collection, 126 static pages, and route optimization.
- The remaining deferred items are unchanged: API namespace rename, custom roles, contingent statutory disclosure, command-palette record search, and removal of the deprecated decoy table.
