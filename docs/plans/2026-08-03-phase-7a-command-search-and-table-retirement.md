# Phase 7A Command Search and Deprecated Table Retirement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the workspace command palette search real clients and disputes while safely removing active dependencies on the deprecated `dispute_letter_templates` model.

**Architecture:** Add one capability-protected `/api/admin/search` seam that returns a discriminated, PII-minimized result set for clients and disputes. The existing client-side command palette owns debouncing, request cancellation, loading/error/empty states, keyboard movement, and navigation. Keep `dispute_letter_templates` physically present for migration compatibility, but classify every remaining source reference as historical, diagnostic, or retired and prevent legacy seed/check scripts from treating it as active system data.

**Tech Stack:** Next.js 16 App Router route handlers, React, TypeScript, Drizzle ORM, Vitest, Testing Library, Playwright.

## Scope decisions

- Search starts after two non-whitespace characters and returns at most five clients and five disputes.
- Search results expose only identifiers, display labels, short context, status, and destination paths. They never expose phone numbers, addresses, dates of birth, SSN fragments, account numbers, letter text, notes, or report data.
- Client names and dispute creditor names remain encrypted at rest. The search module decrypts only the narrow projected fields inside the authorized server process and filters there; no decrypted corpus is cached or sent to the browser.
- The first implementation favors correctness and PII locality over adding a plaintext search index. Query-time scan cost must be documented and can be replaced later by a keyed search index if production scale requires it.
- Selecting a client opens `/workspace/clients/:id`. Selecting a dispute opens `/workspace/disputes?dispute=:id`; the disputes page must recognize that parameter and open the matching detail panel.
- `dispute_letter_templates` is not dropped in Phase 7A. Historical migrations stay immutable. Active scripts must not seed, repair, or certify the deprecated table as production data.

## Task 1: Define and test the workspace-search interface

**Files:**

- Create: `src/lib/workspace-search.ts`
- Create: `src/__tests__/lib/workspace-search.test.ts`

1. Write failing tests for query normalization, minimum length, encrypted-name matching, result ranking, category limits, and PII-minimized output.
2. Run `npm run test -- src/__tests__/lib/workspace-search.test.ts` and confirm the failure is caused by the missing module.
3. Implement a discriminated `WorkspaceSearchResult` union and pure matching/ranking helpers.
4. Re-run the focused test and confirm it passes.

## Task 2: Add the authenticated search route

**Files:**

- Create: `src/app/api/admin/search/route.ts`
- Create: `src/__tests__/api/admin/workspace-search.test.ts`

1. Write failing route tests for `clients:read`/`disputes:read` enforcement, short-query handling, category limits, stable JSON shape, decryption at the server seam, and forbidden PII fields.
2. Run the focused route test and confirm the expected failures.
3. Implement `GET /api/admin/search?q=...` with narrow database projections and no response caching.
4. Re-run both search test files.

## Task 3: Wire record results into the command palette

**Files:**

- Modify: `src/components/workspace/CommandPalette.tsx`
- Create: `src/components/workspace/__tests__/CommandPalette.test.tsx`
- Modify: `src/app/workspace/disputes/page.tsx`

1. Write failing component tests for the two-character threshold, debounce, loading state, grouped client/dispute results, empty/error states, stale-request cancellation, keyboard movement, Enter selection, and Escape close.
2. Add a failing disputes-page test for `?dispute=<id>` opening the matching detail panel after data loads.
3. Implement the minimal UI and URL selection behavior.
4. Re-run the focused component and page tests.

## Task 4: Quarantine deprecated-table tooling

**Files:**

- Create: `scripts/audit-deprecated-letter-templates.ts`
- Modify: `scripts/check-and-migrate.ts`
- Modify: `scripts/verify-system-integration.ts`
- Modify: legacy seed/update scripts that import `disputeLetterTemplates`
- Modify: `package.json`
- Test: `src/__tests__/lib/deprecated-letter-table-audit.test.ts`

1. Write a failing source-audit test that permits only the schema declaration, historical Drizzle artifacts, the read-only audit, and explicitly marked legacy scripts.
2. Add a read-only audit command that reports row count and reference categories without mutating the database.
3. Remove the deprecated table from active bootstrap/integration checks.
4. Convert legacy writers into explicit archived entry points that exit with actionable guidance toward `dispute_letter_library`; do not delete historical migrations.
5. Run the audit test and command against the authorized development database only if the command is read-only.

## Task 5: Browser coverage and documentation closure

**Files:**

- Create: `e2e/workspace-search.spec.ts`
- Modify: `docs/plans/2026-07-31-workspace-portal-restructure-and-letter-studio.md`
- Modify: `docs/plans/2026-07-31-letter-library-wiring.md`
- Modify: `docs/plans/2026-08-02-workspace-portal-letter-studio-completion.md`

1. Add an authenticated browser journey that searches a seeded client and dispute and navigates to each record.
2. Run the focused Chromium journey.
3. Record Phase 7A completion and keep API rename, custom roles, and contingent statutory disclosure deferred.
4. Run `git diff --check`, focused tests, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and the configured Playwright gates.

## Rollback and migration rules

- No destructive database migration is included.
- If search scanning is too expensive, disable record results by reverting the palette and route; static commands continue to work.
- The deprecated table can be dropped only in a separate migration after production data retention and rollback requirements are approved.

## Completion record (2026-08-03)

- [x] Added the capability-protected, PII-minimized `/api/admin/search` route and pure client/dispute ranking module.
- [x] Added debounced, cancellable command-palette search with grouped results, keyboard selection, semantic navigation, and dispute deep-link opening.
- [x] Added the read-only deprecated-table audit. The authorized development database currently reports 65 deprecated rows, 65 active deprecated rows, and 20 active library rows; the table is retained and no drop is recommended.
- [x] Removed the deprecated table from active bootstrap/integration checks and converted legacy writers into explicit archived entry points.
- [x] Validation passed: focused tests (15), full Vitest (896 passed, 27 skipped), ESLint, TypeScript, Chromium/Firefox/WebKit workspace-search coverage, `git diff --check`, and production build.
- [ ] Deferred by design: API namespace rename, custom database roles, contingent statutory disclosure, and any destructive physical table removal.
