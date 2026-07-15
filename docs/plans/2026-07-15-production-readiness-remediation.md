# Production Readiness Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the five launch-blocking findings from the 2026-07-15 production readiness audit, then harden the important-tier findings, so `npm run validate` + `npm audit --audit-level=high` are green and enforced by CI.

**Architecture:** Three phases. Phase 1 (Tasks 1–7) removes launch blockers: toolchain hygiene, dependency CVEs, flaky tests, rate limiting, encrypted-search fix, and a CI gate. Phase 2 (Tasks 8–15) hardens security and integrity: auth bootstrap, AES-GCM, secret storage, sanitizer, transactions, uploads, RBAC, E2E. Phase 3 is a prioritized backlog — do not start it until Phases 1–2 ship.

**Tech Stack:** Next.js 16 (App Router, Turbopack), Better Auth, Drizzle ORM + Neon Postgres, Upstash Ratelimit, Vitest + Testing Library, Playwright, GitHub Actions.

**Audit reference:** Conversation audit of 2026-07-15. Test evidence: two full Vitest runs each had 4 failures with *different* failing sets (flaky). `npm audit`: 21 vulns (3 critical in `better-auth <=1.6.12`, 6 high incl. `next`, `undici`, `ws`).

**Ground rules for the executor:**
- Work on a branch: `git checkout -b production-readiness-remediation`
- TDD every behavior change: failing test → minimal fix → green → commit.
- After each task: run the focused tests for the touched area, then commit. Full `npm run validate` at each phase boundary.
- Never widen scope. If a task reveals a new problem, add it to Phase 3 backlog in this doc and keep going.

---

## Phase 1 — Launch Blockers

### Task 1: Fix `npm run typecheck` (stale `.next/dev` artifacts break it)

`npx tsc --noEmit` currently fails with syntax errors in generated `.next/dev/types/routes.d.ts` and `.next/dev/types/validator.ts` whenever the dev server has run. Source code itself has zero errors. CI (Task 7) depends on this being deterministic.

**Files:**
- Modify: `tsconfig.json:26-33`

**Step 1: Reproduce the failure**

Run: `npm run dev` in one terminal for ~30s, stop it, then `npx tsc --noEmit`
Expected: errors pointing at `.next/dev/types/*.ts`

**Step 2: Remove the dev-artifact include**

In `tsconfig.json`, delete the `.next/dev/types/**/*.ts` line from `include` (keep `.next/types/**/*.ts` — that one is produced by `next build` and is valid):

```json
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules", "scripts", ".next/dev"]
```

**Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: exit 0, no output — with the `.next/dev` directory still present on disk.

**Step 4: Commit**

```bash
git add tsconfig.json
git commit -m "fix: exclude .next/dev generated types from typecheck"
```

---

### Task 2: Dependency security remediation

`npm audit` (2026-07-15) reports 3 critical (`better-auth <=1.6.12`: OAuth state bypass GHSA-wxw3-q3m9-c3jr, refresh-token replay GHSA-pw9m-5jxm-xr6h, **stale sessions after user deletion GHSA-2vg6-77g8-24mp** — the last one applies to this app), 6 high (`next`, `undici`, `ws`, `fast-uri`, `protobufjs`, `vite`), plus `vitest` critical (dev-only).

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `docs/plans/production-readiness-blockers.md` (stale — claims zero high/critical)

**Step 1: Snapshot the current audit**

Run: `npm audit > /tmp/audit-before.txt; npm audit --audit-level=high; echo "exit=$?"`
Expected: nonzero exit, 21 vulnerabilities listed.

**Step 2: Apply non-breaking fixes**

Run: `npm audit fix` (NO `--force`), then `npm audit --audit-level=high`
Expected: `undici`, `ws`, `fast-uri`, `vitest`, `vite` advisories cleared.

**Step 3: Upgrade better-auth past 1.6.12**

Run: `npm install better-auth@latest && npm ls better-auth`
Expected: version >= 1.6.13.

Check the Better Auth changelog for breaking changes between the installed 1.4.x line and the new version, specifically: `drizzleAdapter` signature, `admin()` plugin exports, `toNextJsHandler`, session `additionalFields`. Touch points in this repo: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`.

**Step 4: Upgrade next within the v16 line**

Run: `npm install next@16 eslint-config-next@16 && npm ls next`
Expected: latest 16.x, which clears the middleware-bypass and cache-poisoning advisories if the patched version is published; if the advisory persists on latest 16.x, record it in the blockers doc with the advisory IDs and move on (do not downgrade, do not `--force`).

**Step 5: Verify nothing broke**

Run: `npx tsc --noEmit && npx vitest run src/__tests__/api --reporter=dot`
Expected: typecheck clean; API tests pass (auth-dependent tests are the canary for the better-auth bump).

Then a live smoke: `npm run dev`, sign in at `/sign-in` with a dev account, confirm `/admin` loads and `/api/admin/stats` returns 200 (not 401). Stop the server.

**Step 6: Verify audit gate**

Run: `npm audit --audit-level=high; echo "exit=$?"`
Expected: exit 0 (moderate advisories may remain; they are recorded, not blocking).

**Step 7: Update the stale blockers doc**

Rewrite the "Release Blockers" / "Security Remediation Applied" sections of `docs/plans/production-readiness-blockers.md` with today's date, the new audit state, and a note that the December claims were stale.

**Step 8: Commit**

```bash
git add package.json package-lock.json docs/plans/production-readiness-blockers.md
git commit -m "fix(security): clear critical/high npm audit findings, bump better-auth and next"
```

---

### Task 3: Stabilize the flaky test suite

Two consecutive full runs each had 4 failures, but **different sets** — this is flakiness, not a single regression. Observed failures across the two runs:

- `src/components/admin/__tests__/AutomationStatus.test.tsx` — "runs escalation dry run from the dashboard" (run 1)
- `src/__tests__/api/admin/dispute-creation-policy-trace.test.ts` — "fails closed before generating a letter when approved policy is missing" AND "persists approved policy decision inputs with generated letter content" (run 2)
- `src/components/admin/__tests__/AdminAnalyticsPanel.test.tsx` — "shows operator and client outcome analytics as separate dashboard sections" (run 2)
- `src/__tests__/integration/DisputeWizardFlow.test.tsx` — "should award escalation points for higher rounds" (run 2)

The policy-trace tests guard the compliance-critical fail-closed AI boundary. **Launch cannot be certified while they are intermittent.**

**Files:**
- Test: the four files above
- Possibly modify: `src/__tests__/setup.tsx` (shared mock state)

**Step 1: Prove flakiness per file, in isolation**

For each of the four files:

Run: `for i in 1 2 3 4 5; do npx vitest run <file> --reporter=dot 2>&1 | tail -2; done`
Expected: record pass/fail per iteration. A file that is green 5/5 in isolation but fails in the full run points at cross-file state leakage (shared `fetchMock`, module-level singletons, unreset timers). A file that fails intermittently alone points at unawaited async (`act(...)` warnings are already known in `WorkQueue` tests per the blockers doc).

**Step 2: Diagnose with the systematic-debugging skill**

Use @superpowers:systematic-debugging. The three usual culprits in this codebase's setup, in likelihood order:
1. `fetchMock.mockResolvedValueOnce(...)` queues consumed out of order when components fire more fetches than the test queued — replace ordered `Once` queues with URL-matched mocks (`fetchMock.mockResponse((req) => ...)` switching on `req.url`).
2. Missing `await waitFor(...)` around assertions that race a state update (the observed `act(...)` warnings).
3. Mock/module state leaking between files — ensure `vi.restoreAllMocks()` + `fetchMock.resetMocks()` in a global `afterEach` in `src/__tests__/setup.tsx`.

**Step 3: Fix each failing test (or the component, if the test exposes a real race)**

One commit per file fixed. If any failure turns out to be a genuine product bug (especially the fail-closed policy trace), STOP, write it up, fix the product code test-first, and flag it in the PR description as a compliance-boundary fix.

**Step 4: Acceptance — three consecutive green full runs**

Run: `for i in 1 2 3; do npx vitest run --reporter=dot 2>&1 | tail -3; done`
Expected: `0 failed` all three times.

**Step 5: Commit (final)**

```bash
git add -A src/__tests__ src/components
git commit -m "test: eliminate flaky failures across automation, policy-trace, analytics, wizard suites"
```

---

### Task 4: Make rate limiting real — fail loud in prod, protect auth endpoints

Today: only 2 of 101 routes are rate-limited, and `src/lib/rate-limit.ts:26-35` silently no-ops when Upstash env vars are missing — including in production. `/api/auth/[...all]` (sign-in/sign-up) has zero brute-force protection.

**Files:**
- Modify: `src/lib/rate-limit.ts`
- Modify: `src/app/api/auth/[...all]/route.ts`
- Test: `src/__tests__/lib/rate-limit-config.test.ts` (create)

**Step 1: Write the failing test for prod fail-loud behavior**

```ts
// src/__tests__/lib/rate-limit-config.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('rate limit production guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('throws at import time in production when Upstash is not configured and not explicitly disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('RATE_LIMIT_DISABLED', '');
    await expect(import('@/lib/rate-limit')).rejects.toThrow(/UPSTASH/);
  });

  it('allows explicit opt-out via RATE_LIMIT_DISABLED=true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('RATE_LIMIT_DISABLED', 'true');
    await expect(import('@/lib/rate-limit')).resolves.toBeTruthy();
  });
});
```

**Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/lib/rate-limit-config.test.ts`
Expected: FAIL — module currently never throws.

**Step 3: Implement the guard in `src/lib/rate-limit.ts`**

After the existing `hasUpstashConfig` computation, add:

```ts
if (
  !hasUpstashConfig &&
  process.env.NODE_ENV === 'production' &&
  process.env.RATE_LIMIT_DISABLED !== 'true'
) {
  throw new Error(
    'Rate limiting is not configured: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, ' +
    'or set RATE_LIMIT_DISABLED=true to explicitly accept running without rate limits.'
  );
}
```

Also add an `authLimiter` alongside the existing limiters — 10 attempts per minute per IP:

```ts
export const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      ephemeralCache: new Map(),
      prefix: '@ratelimit/auth',
    })
  : createNoopLimiter();
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/lib/rate-limit-config.test.ts`
Expected: PASS. Also run `npx vitest run src/__tests__ --reporter=dot` — no regressions (test env is not production, so existing tests keep the noop path).

**Step 5: Wire the auth catch-all through the limiter**

Replace `src/app/api/auth/[...all]/route.ts`:

```ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import type { NextRequest, NextResponse } from 'next/server';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { authLimiter } from '@/lib/rate-limit';

const handler = toNextJsHandler(auth);

export const GET = handler.GET;
// POST covers sign-in, sign-up, password endpoints — the brute-force surface.
export const POST = rateLimited(authLimiter)(
  handler.POST as unknown as (req: NextRequest) => Promise<NextResponse>
);
```

(The cast bridges `Request`/`Response` vs `NextRequest`/`NextResponse`; `rateLimited` only reads headers and returns the handler's response untouched.)

**Step 6: Verify live**

Run: `npm run dev`, then `for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/sign-in/email -H 'content-type: application/json' -d '{"email":"x@x.com","password":"wrong"}'; done`
Expected with Upstash configured in `.env`: eleven-plus requests → at least one `429`. Without Upstash in dev: all `401`/`400` (noop limiter — acceptable in dev). Stop the server.

**Step 7: Add `RATE_LIMIT_DISABLED` to `env.example` with a comment marking it as an explicit opt-out. Commit**

```bash
git add src/lib/rate-limit.ts src/app/api/auth/[...all]/route.ts src/__tests__/lib/rate-limit-config.test.ts env.example
git commit -m "fix(security): fail loud when rate limiting unconfigured in prod; rate-limit auth endpoints"
```

---

### Task 5: Protect public write endpoints and uploads

`/api/public/contact-forms` has no rate limit, no CAPTCHA, and **no length caps** (unbounded `message` → DB flooding). `/api/newsletter/subscribe` same. The purpose-built `uploadLimiter` is unused by any upload route.

**Files:**
- Modify: `src/app/api/public/contact-forms/route.ts`
- Modify: `src/app/api/newsletter/subscribe/route.ts`
- Modify: `src/app/api/portal/documents/upload/route.ts`, `src/app/api/admin/credit-reports/upload/route.ts`, `src/app/api/admin/messages/attachments/route.ts`
- Test: `src/__tests__/api/public-input-limits.test.ts` (create)

**Step 1: Write failing tests for input caps**

```ts
// src/__tests__/api/public-input-limits.test.ts
import { describe, it, expect, vi } from 'vitest';
import { testApiHandler } from 'next-test-api-route-handler';
import * as contactForms from '@/app/api/public/contact-forms/route';

vi.mock('@/db/client', () => ({ db: { insert: vi.fn(() => ({ values: vi.fn() })) } }));

describe('contact form input limits', () => {
  it('rejects a message over 5000 characters', async () => {
    await testApiHandler({
      appHandler: contactForms,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({
            full_name: 'Test User',
            email: 'test@example.com',
            message: 'x'.repeat(5001),
          }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it('rejects a full name over 200 characters', async () => {
    await testApiHandler({
      appHandler: contactForms,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify({
            full_name: 'x'.repeat(201),
            email: 'test@example.com',
          }),
        });
        expect(res.status).toBe(400);
      },
    });
  });
});
```

**Step 2: Run to verify failure**

Run: `npx vitest run src/__tests__/api/public-input-limits.test.ts`
Expected: FAIL (currently accepts any length).

**Step 3: Implement caps + rate limit in the contact form route**

In `src/app/api/public/contact-forms/route.ts`, add after the existing email validation:

```ts
const MAX = { fullName: 200, email: 320, phone: 40, message: 5000, slug: 200 };

if (
  fullName.length > MAX.fullName ||
  email.length > MAX.email ||
  (body.phone_number?.length ?? 0) > MAX.phone ||
  (body.message?.length ?? 0) > MAX.message ||
  (body.source_page_slug?.length ?? 0) > MAX.slug
) {
  return NextResponse.json({ error: 'Input exceeds allowed length' }, { status: 400 });
}
```

Then rename the exported `POST` body to an internal `postHandler` and export:

```ts
import { rateLimited } from '@/lib/rate-limit-middleware';
import { publicLimiter } from '@/lib/rate-limit';

export const POST = rateLimited(publicLimiter)(postHandler);
```

**Step 4: Same pattern on `newsletter/subscribe`** — cap `email` (320), `first_name`/`last_name` (100), `source` (100); validate email with the same regex used by contact forms (current check is only `includes('@')`); wrap with `rateLimited(publicLimiter)`.

**Step 5: Wrap the three upload route handlers with `rateLimited(uploadLimiter)`** — same rename-and-wrap pattern. No behavior change in tests (noop limiter in test env), so this is covered by existing upload tests still passing.

**Step 6: Run tests**

Run: `npx vitest run src/__tests__/api --reporter=dot`
Expected: new tests PASS, no regressions.

**Step 7: Commit**

```bash
git add src/app/api/public src/app/api/newsletter src/app/api/portal/documents/upload src/app/api/admin/credit-reports/upload src/app/api/admin/messages/attachments src/__tests__/api/public-input-limits.test.ts
git commit -m "fix(security): rate-limit and length-cap public write endpoints and uploads"
```

---

### Task 6: Fix client search/sort against encrypted columns

`src/app/api/admin/clients/route.ts:62-69` runs SQL `ilike` on `firstName`/`lastName`/`phone` — but those columns hold AES ciphertext (`ENCRYPTED_FIELDS.clients`), so name/phone search silently returns nothing and "sort by name" orders ciphertext. Email is stored plaintext and still works.

**Chosen approach: decrypt-and-filter in memory.** This is a single-operator business (hundreds, not millions, of clients). YAGNI: a blind-index column is the future optimization (Phase 3), not the fix. In-memory filtering also preserves substring search, which a blind index cannot do.

**Files:**
- Modify: `src/app/api/admin/clients/route.ts`
- Test: `src/__tests__/api/admin-clients-search.test.ts` (create)

**Step 1: Write the failing test**

Mock the db to return two clients whose name fields are `encrypt()`-ed fixtures (use the real `encrypt` from `@/lib/encryption` with a stubbed `ENCRYPTION_KEY` env of 64 hex chars). Call the GET handler with `?search=alice` and assert the response contains exactly the client whose decrypted first name is "Alice". Follow the mocking conventions already used in `src/__tests__/api/` (see existing admin route tests for the db-mock pattern).

**Step 2: Run to verify it fails** — currently returns zero items because ilike can't match ciphertext.

**Step 3: Implement**

In `getHandler`, restructure the search path:

```ts
const emailOnlyCondition = search ? ilike(clients.email, `%${search}%`) : undefined;
// Encrypted fields (firstName, lastName, phone) CANNOT be matched in SQL — they hold ciphertext.
// Strategy: SQL filters status only; decrypt page-superset in app code and filter there.

if (search) {
  const candidates = await db.select({ /* same columns */ })
    .from(clients)
    .leftJoin(user, eq(clients.userId, user.id))
    .where(statusCondition)             // status filter stays in SQL
    .orderBy(orderDirection(sortColumn));

  const q = search.toLowerCase();
  const matches = candidates
    .map((c) => decryptClientData(c))
    .filter((c) =>
      String(c.firstName ?? '').toLowerCase().includes(q) ||
      String(c.lastName ?? '').toLowerCase().includes(q) ||
      String(c.email ?? '').toLowerCase().includes(q) ||
      String(c.phone ?? '').toLowerCase().includes(q)
    );

  const total = matches.length;
  const items = matches.slice(offset, offset + limit);
  // ...same response shape as today
}
```

And fix name sort: when `sortBy === 'name'`, sort **after** decryption (`localeCompare` on decrypted `firstName`), in both the search and non-search paths. For the non-search path this means: if `sortBy === 'name'`, fetch with the default `createdAt` order, decrypt, sort in memory, then slice — same pattern.

Add a guard: if the candidate count exceeds 5,000, log a warning naming the Phase 3 blind-index backlog item.

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/api/admin-clients-search.test.ts src/__tests__/api --reporter=dot`
Expected: PASS.

**Step 5: Live verification**

`npm run dev`, sign in as super_admin, open `/admin/clients`, search for a known client's first name.
Expected: the client appears (this returned nothing before). Stop the server.

**Step 6: Commit**

```bash
git add src/app/api/admin/clients/route.ts src/__tests__/api/admin-clients-search.test.ts
git commit -m "fix: client search/sort now decrypts PII fields instead of matching ciphertext"
```

---

### Task 7: CI pipeline (GitHub Actions)

There is a GitHub remote but no `.github/workflows`. Nothing enforces validate/audit — which is exactly how Tasks 2 and 3's regressions accumulated unnoticed since December.

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the workflow**

Use `npm run typecheck`, not raw `npx tsc --noEmit`, for the typecheck step below. Task 1 added a `pretypecheck` script (`rm -rf .next/dev`) because `next-env.d.ts` statically imports `.next/dev/types/routes.d.ts`, which `tsconfig.json`'s `exclude` cannot filter out (exclude only prunes glob-based `include` matches, not files reached via direct import). Only the npm script's `pretypecheck` hook guarantees a clean typecheck. This is moot today since CI always runs on a fresh checkout (`.next/dev` never exists), but becomes load-bearing the moment `.next` build caching is added to CI — don't revert this to raw `tsc` for a marginal speedup.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      # Tests run without real services (noop rate limiter, test encryption path).
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npx vitest run
      - run: npm audit --audit-level=high

  build:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    # Build prerenders pages that touch the database; requires a real (staging) DATABASE_URL secret.
    if: ${{ github.event_name == 'push' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          DATABASE_URL: ${{ secrets.CI_DATABASE_URL }}
          BETTER_AUTH_SECRET: ${{ secrets.CI_BETTER_AUTH_SECRET }}
          ENCRYPTION_KEY: ${{ secrets.CI_ENCRYPTION_KEY }}
          NEXT_PUBLIC_APP_URL: http://localhost:3000
          RATE_LIMIT_DISABLED: 'true'
```

**Step 2: Add the repo secrets** (human step — flag for the owner): `CI_DATABASE_URL` (a Neon branch/staging DB, never prod), `CI_BETTER_AUTH_SECRET`, `CI_ENCRYPTION_KEY` (fresh `randomBytes(32).toString('hex')`).

**Step 3: Push the branch and verify the `validate` job goes green on the PR.** The `build` job runs on merge; if it fails on missing secrets, that's the owner's cue to add them — the validate gate still protects merges.

**Step 4: Enable branch protection** (human step — flag for the owner): require the `validate` check on `main`.

**Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add validate + audit gate and build job"
```

---

**PHASE 1 CHECKPOINT:** Run `npm run validate && npm audit --audit-level=high`. All green, three consecutive green test runs (Task 3 acceptance). Open a PR — this is the minimum shippable remediation.

---

## Phase 2 — Hardening

### Task 8: Fix the dead first-super-admin bootstrap

`src/app/api/admin/set-role/route.ts:18-53`: when zero super_admins exist, `getAdminSessionUser('super_admin')` is necessarily `null`, so the bootstrap branch always returns 403. First super_admin currently requires manual DB edit.

**Files:**
- Modify: `src/app/api/admin/set-role/route.ts`
- Test: `src/__tests__/api/admin-set-role.test.ts` (create or extend existing)

**Step 1: Failing test** — mock a signed-in session for `alice@example.com` with role `user`, mock zero super_admins in the db; POST `{email: 'alice@example.com', role: 'super_admin'}`; expect 200. Second test: same state but promoting a *different* email → 403. Third: super_admins exist and requester is not super_admin → 401.

**Step 2: Implement** — fetch the raw session separately from the role gate:

```ts
const session = await auth.api.getSession({ headers: await headers() });
const requesterEmail = session?.user?.email?.toLowerCase() ?? null;
const requester = await getAdminSessionUser('super_admin'); // null unless super_admin
const isFirstSuperAdmin = superAdminCount.length === 0;

if (!requester && !isFirstSuperAdmin) {
  return NextResponse.json({ success: false, error: 'Only super_admin can modify roles' }, { status: 401 });
}

// Bootstrap: any signed-in user may promote ONLY THEMSELVES to super_admin when none exists.
if (isFirstSuperAdmin) {
  if (!requesterEmail || requesterEmail !== String(email).toLowerCase() || role !== 'super_admin') {
    return NextResponse.json(
      { success: false, error: 'First super_admin bootstrap requires signed-in user promoting own account' },
      { status: 403 }
    );
  }
}
```

**Step 3–5:** Run tests (PASS), full API suite, commit `fix(auth): make first-super-admin bootstrap actually reachable`.

---

### Task 9: Authenticated encryption (AES-GCM) + kill the decrypt fail-open

`src/lib/encryption.ts` uses AES-256-CBC (malleable, no integrity), and `src/lib/db-encryption.ts:57-63` returns the **raw stored value** when decryption fails — silent ciphertext/stale-plaintext leakage into the UI.

**Design:** versioned format. New writes: `v2:IV_HEX:TAG_HEX:CIPHERTEXT_HEX` (AES-256-GCM). Reads: `v2:` prefix → GCM; legacy 2-part `IV:CIPHER` → CBC decrypt (backward compat, no bulk migration needed — YAGNI; rows re-encrypt to v2 on next write). Decrypt failure now returns the sentinel `'[decryption-failed]'` and reports to Sentry — never the raw value.

**Files:**
- Modify: `src/lib/encryption.ts`, `src/lib/db-encryption.ts`
- Test: `src/lib/__tests__/encryption.test.ts` (extend existing tests in `src/lib/__tests__/`)

**Step 1: Failing tests**

```ts
it('encrypts with v2 GCM format', () => {
  const c = encrypt('hello')!;
  expect(c.startsWith('v2:')).toBe(true);
  expect(decrypt(c)).toBe('hello');
});

it('still decrypts legacy CBC ciphertext', () => {
  const legacy = legacyEncryptCbcForTest('hello'); // helper using old CBC path
  expect(decrypt(legacy)).toBe('hello');
});

it('rejects tampered v2 ciphertext', () => {
  const c = encrypt('hello')!;
  const parts = c.split(':');
  parts[3] = parts[3].replace(/^./, parts[3][0] === '0' ? '1' : '0');
  expect(() => decrypt(parts.join(':'))).toThrow();
});

it('safeDecrypt returns sentinel, not raw ciphertext, on failure', () => {
  // craft a value shaped like legacy ciphertext but undecryptable
  expect(safeDecryptValue('a'.repeat(32) + ':' + 'b'.repeat(32))).toBe('[decryption-failed]');
});
```

**Step 2: Implement** in `encryption.ts`:

```ts
export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);                       // GCM standard nonce size
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  if (ciphertext.startsWith('v2:')) {
    const [, ivHex, tagHex, dataHex] = ciphertext.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf-8');
  }
  return decryptLegacyCbc(ciphertext); // existing CBC path, renamed
}
```

In `db-encryption.ts`, update `safeDecryptValue`: recognize the `v2:` shape as well as legacy; on decrypt error return `'[decryption-failed]'` and `Sentry.captureException(err, { tags: { area: 'pii-decrypt' } })`. **Delete** the return-raw-value fallback. Keep the "doesn't look like ciphertext at all → return as-is" branch (true legacy plaintext rows).

**Step 3–5:** Tests green, run the full lib + API suites (`npx vitest run src/lib src/__tests__ --reporter=dot`), live smoke on `/admin/clients` (existing rows still render — legacy path), commit `fix(security): AES-256-GCM authenticated encryption with versioned format; decrypt failures fail visible`.

---

### Task 10: Encrypt LLM API keys at rest

`src/lib/settings-service.ts:289` stores provider API keys plaintext in `site_settings` while client PII is encrypted.

**Files:**
- Modify: `src/lib/settings-service.ts`
- Test: extend the existing settings-service tests

**Step 1: Failing test** — `setSetting('llm.api_key', ...)` path stores a value beginning `v2:`; `getLlmConfig()` returns the decrypted key.
**Step 2: Implement** — at the `llm.api_key` write site call `encrypt(config.apiKey)`; at the read site (`settings-service.ts:239-245`) run the value through `safeDecryptValue`-style decrypt (plaintext legacy values pass through unchanged, so existing installs keep working and re-encrypt on next save).
**Step 3: Verify + commit** `fix(security): encrypt LLM provider API keys at rest`.

---

### Task 11: Replace the homegrown regex HTML sanitizer

`src/lib/safe-html.ts` is a regex sanitizer — a known bypass class — and the CSP allows `'unsafe-inline'` scripts, so CSP is not a backstop.

**Files:**
- Modify: `src/lib/safe-html.ts` (keep the exported `sanitizeHtml(html: string): string` signature — call sites don't change)
- Test: `src/lib/__tests__/safe-html.test.ts`

**Step 1:** `npm install sanitize-html && npm install -D @types/sanitize-html`
**Step 2: Failing tests** — payloads: `<img src=x onerror=alert(1)>` (stripped), `<p onmouseover=x>hi</p>` (attribute stripped, `<p>` kept), `<scr<script>ipt>alert(1)</scr</script>ipt>` (no `<script` survives), unclosed `<style>` (removed), plus a happy-path test that the allowed tags (`p, br, strong, b, em, i, u, ul, ol, li, blockquote, h2, h3, h4`) pass through.
**Step 3: Implement:**

```ts
import sanitize from 'sanitize-html';

export function sanitizeHtml(html: string): string {
  return sanitize(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4'],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });
}
```

**Step 4:** Run `npx vitest run src/lib --reporter=dot` plus any component tests that render sanitized content. Commit `fix(security): replace regex HTML sanitizer with sanitize-html`.

---

### Task 12: Enable database transactions; wrap multi-step writes

`db/client.ts` uses the `neon-http` driver, which cannot run transactions, and no code uses `db.transaction`. Multi-step writes (document upload + review-task creation; invoice + payment audit log) can partially fail.

**Files:**
- Modify: `db/client.ts`
- Modify: `src/app/api/portal/documents/upload/route.ts:93-139` (first consumer)
- Test: existing upload tests must stay green

**Step 1:** Switch the driver:

```ts
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from './schema';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });
```

(`ws` is already a transitive dep; add it as a direct dependency: `npm install ws && npm install -D @types/ws`.)

**Step 2:** Run the FULL suite + a live smoke (sign in, load `/admin/clients`) — the driver swap touches every query in the app. Expected: no behavioral change; if any test mocks `neon-http` internals, update the mock.
**Step 3:** Wrap the upload flow's `clientDocuments` insert + `tasks` insert + task auto-complete in `await db.transaction(async (tx) => { ... })`, keeping the existing "task automation must never block upload" behavior by catching task errors *inside* the transaction scope decision: document insert commits alone if task automation throws (i.e., two transactions: doc insert is its own; task-create + task-complete share one).
**Step 4:** Commit `refactor(db): neon-serverless driver with transaction support; atomic task automation on upload`.

---

### Task 13: Upload hardening — magic bytes + `caseId` integrity

`portal/documents/upload/route.ts:49` trusts client-declared MIME; line 95 writes `caseId: ''` when no case exists.

**Files:**
- Create: `src/lib/file-signature.ts`
- Modify: `src/app/api/portal/documents/upload/route.ts`
- Check/modify: `db/schema.ts` `clientDocuments.caseId` nullability (+ `npm run db:generate` migration if it is `notNull`)
- Test: `src/lib/__tests__/file-signature.test.ts`

**Step 1: Failing tests** for `matchesDeclaredType(buffer, mimeType)`: `%PDF-` → `application/pdf` true; PNG/JPEG/GIF magic numbers; an EXE header (`MZ`) declared as `application/pdf` → false; `text/plain`/`text/html` → skip signature check (no reliable magic), return true.
**Step 2: Implement** a small signature table (PDF `25504446`, PNG `89504e47`, JPEG `ffd8ff`, GIF `47494638`, DOC `d0cf11e0`, DOCX/zip `504b0304`) and check `buffer.subarray(0, n)`.
**Step 3:** In the upload route, after reading `fileBuffer`, reject with 400 `'File content does not match its declared type'` when the check fails.
**Step 4:** Fix `caseId`: if `clientDocuments.caseId` is nullable in the schema, write `clientCase?.id ?? null`; if it is `notNull`, make it nullable, run `npm run db:generate`, review the generated SQL in `drizzle/`, and `npm run db:migrate` against dev.
**Step 5:** Tests + commit `fix(security): verify upload magic bytes; null caseId instead of empty string`.

---

### Task 14: RBAC — make the `admin` role usable (owner decision required)

47 of 62 admin route files gate on `isSuperAdmin`; the `admin` role can only touch tasks (`src/lib/admin-auth.ts:37-41`). The README's staff roles (manager, dispute specialist, onboarding, billing) don't exist in code.

**This task needs a product decision before code.** Present the owner this default split, then implement:

- **Stays super_admin:** `set-role`, `settings` + `settings/llm*`, `automation`, `subscribers`, billing-adjacent (`billing`, `services-rendered-events`), content deletion.
- **Downgrades to `admin`:** all read paths (stats, dashboards, analytics, lists), and day-to-day workflow writes (leads, clients, tasks, disputes, credit reports, documents, messages, agreements, notes).

**Implementation pattern (one commit per route group):** replace each route's local `validateAdmin()`/`isSuperAdmin` with the existing `getAdminSessionUser('admin' | 'super_admin')` helper — it already implements the minimum-role check — and extend the `AdminPermission` map in `src/lib/admin-auth.ts` as routes need finer grain. Test-first per group: existing route tests get a second case asserting an `admin`-role session now gets 200 where it previously got 401 (and that `user` role still gets 401).

Acceptance: `grep -rl "isSuperAdmin" src/app/api/admin --include=route.ts` returns only the stays-super_admin list.

---

### Task 15: E2E resurrection + error boundaries

The single Playwright spec navigates to `/admin/disputes/wizard` with no auth — `AdminGuard` blocks it, so E2E coverage is effectively zero. Error boundaries: only root-level `error.tsx`; no `global-error.tsx`.

**Files:**
- Create: `e2e/fixtures/auth.ts`, `e2e/auth.setup.ts`
- Modify: `playwright.config.ts`, `e2e/dispute-wizard.spec.ts`
- Create: `src/app/global-error.tsx`

**Step 1:** Playwright auth setup project: a `setup` project that signs in via `POST /api/auth/sign-in/email` with `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` env vars and saves `storageState` to `e2e/.auth/admin.json`; browser projects depend on it and load that storage state. Add `e2e/.auth/` to `.gitignore`.
**Step 2:** Run `npx playwright test --project=chromium` against a dev server with a seeded admin user. Expected: the wizard spec finally executes past the guard (fix selector drift as found — the spec predates the Midnight & Brass reskin).
**Step 3:** Add one portal smoke spec (sign in as client fixture, portal dashboard renders) — the client-facing happy path currently has zero E2E coverage.
**Step 4:** `src/app/global-error.tsx` per Sentry's Next.js docs (captures the error, renders a minimal fallback with its own `<html>/<body>`).
**Step 5:** Commit `test(e2e): authenticated fixtures, portal smoke; add global-error boundary`.

---

**PHASE 2 CHECKPOINT:** `npm run validate` green ×3, `npm audit --audit-level=high` clean, live smoke of sign-in → admin client search → portal upload. Merge.

---

## Phase 3 — Backlog (do not start until Phases 1–2 ship; each needs its own plan)

Ordered by value for this business:

1. **Cloudflare Turnstile on contact + newsletter forms** — completes the public-endpoint protection from Task 5 (use @turnstile-spin skill).
2. **Letter mailing API integration (Lob / PostGrid / Click2Mail)** — the largest competitive feature gap; the manual submission-tracking model in `db/schema.ts` is the natural seam.
3. **One-click credit monitoring import** (IdentityIQ / SmartCredit credential pull) to complement the deterministic parsers.
4. **Structured logging** — replace the 316 `console.*` calls with `pino` + request IDs; add audit-log rows for sensitive reads (client record views, report downloads, letter generation).
5. **Blind-index columns** for encrypted client fields — only if client volume makes Task 6's in-memory filter slow (>5k clients; the warning log added in Task 6 is the trigger).
6. **Zod at API boundaries** — replace hand-rolled validation route-by-route, starting with routes that accept client PII.
7. **Envelope encryption / key rotation** (KMS or versioned keys) — the `v2:` format from Task 9 already leaves room for a key-version segment.
8. **Deploy story** — pin platform (Vercel or container), staging environment, rollback procedure, uptime monitoring, Sentry cron monitors for the two cron routes.
9. **SMTP decision** — either implement nodemailer or delete the SMTP option from `env.example` and `src/lib/email-service.ts:184`.
10. **Server-side admin/portal layout guards** — replace the client-side `AdminGuard` fetch flash with server component session checks.
