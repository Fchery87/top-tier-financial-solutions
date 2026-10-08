# API Workspace Namespace Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Make `/api/workspace/*` the canonical authenticated-team API while preserving `/api/admin/*` responses through November 7, 2026.

**Architecture:** Move the existing App Router handler tree wholesale from `api/admin` to `api/workspace`, retaining each handler's implementation and authorization behavior. A small proxy-level compatibility adapter rewrites legacy requests to the canonical route before route matching, marks successful compatibility responses with standard deprecation metadata, and returns a data-free `410 Gone` after the announced sunset date. This keeps the route tree and all future changes in one canonical location.

**Tech Stack:** Next.js 16 App Router and Proxy, TypeScript strict mode, Vitest, Playwright, existing structured logging.

## Fixed migration decision

The compatibility window is **90 calendar days**, ending at
`2026-11-07T00:00:00.000Z`. This is an explicit working assumption because no
alternative window was supplied. The date is centralized and covered by tests;
changing it requires an announced replacement date and a new compatibility
review, not an untracked environment edit.

## Contract invariants

1. `/api/workspace/*` is the only physical handler tree after the move.
2. Before the sunset, `/api/admin/*` is rewritten—not redirected—to the exact
   `/api/workspace/*` path, preserving HTTP method, body, query string,
   request ID, authentication cookies, and status/body behavior.
3. A legacy response includes `Deprecation: true`, `Sunset: Fri, 07 Nov 2026
   00:00:00 GMT`, and `Link: </api/workspace/...>; rel="successor-version"`.
   Canonical requests do not include these headers.
4. After the sunset, legacy requests return a generic JSON `410` response;
   they must not reach an authorization, database, storage, or provider call.
5. Workspace UI, admin configuration UI, unit tests, E2E mocks, and setup
   fixtures call `/api/workspace/*`. The legacy namespace appears only in the
   compatibility adapter tests, historic documentation, and the deprecation
   matrix.
6. No public or portal route is moved. `/api/auth/*`, `/api/portal/*`,
   `/api/public/*`, `/api/services/*`, and cron routes retain their paths.

## Route migration matrix

Move all 80 existing handlers from `src/app/api/admin/**` to
`src/app/api/workspace/**`, preserving the final path segment exactly. This
includes the 19-dispute route family, five client routes, three dashboard
routes, three credit-report routes, and every singleton route currently under
the old namespace. Before moving files, capture the exact source list with:

```bash
find src/app/api/admin -name route.ts | sort
```

After moving, assert the corresponding canonical list exists and the old tree
does not:

```bash
test ! -d src/app/api/admin
find src/app/api/workspace -name route.ts | sort
```

## Task 1: Pure compatibility policy

**Files:**

- Create: `src/lib/api-workspace-namespace.ts`.
- Create: `src/lib/__tests__/api-workspace-namespace.test.ts`.

1. Write failing unit tests for a legacy path before the cutoff, an already
   canonical path, an admin page path, an expired legacy path, and a legacy
   query string. The desired interface is a pure function that accepts a
   pathname, search string, and timestamp and returns one of these
   discriminated results:

   ```ts
   { kind: 'canonical' }
   { kind: 'rewrite'; destination: string; sunset: string }
   { kind: 'gone' }
   ```

2. Run:

   ```bash
   npx vitest run src/lib/__tests__/api-workspace-namespace.test.ts
   ```

   Expected: FAIL because the module does not exist.

3. Implement a small, server-safe module with the fixed ISO cutoff and RFC
   7231 date. Match only `/api/admin/` (not `/admin`, `/api/admin`, or a
   string containing the prefix). Construct the destination by replacing the
   prefix once and retain the search string byte-for-byte.

4. Re-run the focused test. Expected: all policy cases pass.

5. Commit:

   ```bash
   git add src/lib/api-workspace-namespace.ts src/lib/__tests__/api-workspace-namespace.test.ts
   git commit -m "feat(api): add workspace namespace compatibility policy"
   ```

## Task 2: Proxy adapter and deprecation contract

**Files:**

- Modify: `src/proxy.ts`.
- Modify: `src/__tests__/proxy.test.ts`.

1. Add failing proxy tests using `NextRequest` that prove a pre-sunset legacy
   GET rewrites to `/api/workspace/...` with the query string intact and adds
   the three deprecation headers. Add a test proving canonical workspace calls
   retain the request-ID/CSP behavior without deprecation headers. Add an
   expired test that receives `410` and the generic `{ error: 'API endpoint
   retired' }` body.

2. Run:

   ```bash
   npx vitest run src/__tests__/proxy.test.ts
   ```

   Expected: new tests fail because no API-namespace handling exists.

3. At the beginning of `proxy()`, after creating the request ID but before
   security-header construction, evaluate the pure policy. For `rewrite`,
   create `NextResponse.rewrite()` using a cloned request-header set that adds
   `x-api-namespace: legacy-admin`; set the request ID, `Deprecation`,
   `Sunset`, and successor `Link` on the response. For `gone`, return the
   generic JSON response with the request ID and security headers. Do not
   write logs containing request bodies or credentials.

4. Re-run proxy tests. Expected: all pass.

5. Commit:

   ```bash
   git add src/proxy.ts src/__tests__/proxy.test.ts
   git commit -m "feat(api): add admin namespace compatibility adapter"
   ```

## Task 3: Move the canonical route tree

**Files:**

- Move: `src/app/api/admin/**` → `src/app/api/workspace/**`.
- Modify: handler-import tests under `src/__tests__/api/admin/**` only when
  they import a moved handler by filesystem path.
- Create: `src/__tests__/api/workspace-route-tree.test.ts`.

1. Add a failing route-tree test that reads the application source tree and
   asserts the canonical tree has the same sorted relative `route.ts` paths as
   the baseline matrix, while the old physical route tree is absent. Store the
   expected list in the test as a literal derived from the source inventory,
   not from the directory being tested.

2. Run the test. Expected: FAIL because the canonical tree is absent.

3. Use `git mv src/app/api/admin src/app/api/workspace`. Do not edit route
   implementations as part of this task. Update direct test imports to their
   new filesystem paths; preserve historical test filenames until a separate
   test-organization task.

4. Run the route-tree test and the representative high-risk handler tests:

   ```bash
   npx vitest run \
     src/__tests__/api/workspace-route-tree.test.ts \
     src/__tests__/api/admin/clients.test.ts \
     src/__tests__/api/admin/disputes.test.ts \
     src/__tests__/api/admin/set-role.test.ts
   ```

   Expected: all pass with no handler logic changes.

5. Commit:

   ```bash
   git add src/app/api/workspace src/__tests__/api
   git rm -r src/app/api/admin
   git commit -m "refactor(api): move team routes to workspace namespace"
   ```

## Task 4: Migrate first-party callers and E2E fixtures

**Files:**

- Modify: every `src/**/*.ts` and `src/**/*.tsx` caller containing
  `/api/admin/`.
- Modify: `e2e/fixtures/routes.ts`, `e2e/setup/auth.setup.ts`, and the
  affected `e2e/*.spec.ts` files.
- Modify: `package.json` only where test commands contain a moved route path.

1. Add a failing static-contract test that scans application client source and
   fails when it finds `/api/admin/`. Exclude the proxy compatibility module,
   its tests, historic plans, and the migration matrix from this assertion.

2. Run it. Expected: FAIL with the current caller list.

3. Update all workspace components, workspace pages, remaining admin
   configuration pages, hooks, component tests, E2E fixtures, and E2E setup
   to call or mock `/api/workspace/`. Preserve URL encoding and all query
   parameters. Do not change public, portal, auth, or cron endpoints.

4. Re-run the static-contract test and focused UI/E2E test selection:

   ```bash
   npx vitest run \
     src/components/workspace/__tests__/CommandPalette.test.tsx \
     src/components/workspace/disputes/__tests__/LetterStudio.test.tsx \
     src/__tests__/app/workspace-disputes-page.test.tsx
   npx playwright test e2e/workspace-search.spec.ts e2e/dispute-wizard.spec.ts
   ```

5. Commit:

   ```bash
   git add src e2e package.json
   git commit -m "refactor(api): migrate first-party callers to workspace routes"
   ```

## Task 5: Compatibility smoke coverage, documentation, and verification

**Files:**

- Modify: `docs/CREDIT-ANALYSIS-IMPLEMENTATION.md` and any current route
  reference found by `rg -n "/api/admin" docs README.md AGENTS.md`.
- Create: `docs/api-admin-namespace-deprecation.md`.
- Modify: `env.example` only if an operator-facing compatibility cutoff needs
  explicit configuration; otherwise do not add a no-op environment variable.

1. Add a route-contract integration test that invokes one representative
   GET, one authenticated write, one upload-adjacent route, and one dynamic
   `[id]` route through `/api/workspace/*`. Keep request authentication mocked
   exactly as existing handler tests do. The proxy unit tests remain the proof
   for legacy transport behavior.

2. Update route references to the canonical namespace. The deprecation
   document must state the fixed sunset, successor path rule, deprecation
   headers, 410 behavior, and removal checklist. Do not claim external
   consumers have migrated unless production evidence exists.

3. Run fresh verification:

   ```bash
   git diff --check
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   npx playwright test
   ```

4. Review the diff for duplicate handlers, residual first-party legacy calls,
   missing deprecation headers, request-ID regression, and any affected
   snapshots. Record only actual command output.

5. Commit:

   ```bash
   git add docs src e2e package.json next.config.ts
   git commit -m "docs(api): announce admin namespace deprecation"
   ```

## Post-window removal task

On or after November 7, 2026, do not simply delete the adapter. First collect
production request-volume evidence for `x-api-namespace: legacy-admin`, notify
any remaining external consumer, replace the adapter with a focused 410 test,
and run the complete verification suite. This is a separate destructive
compatibility-removal change requiring owner approval.
