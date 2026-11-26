# Project Audit — 2026-11-25

Full audit run after cloning the project onto a new Windows 11 machine. This file covers what was checked, what was fixed, and what's still open. It's meant as the starting point for the next session.

> **No credentials appear in this file.** Env files were only ever inspected by variable *name*. Secret scans report file paths only.

## At a glance

**Done (awaiting merge):**
- [x] Critical vulnerabilities in `next`, `better-auth` and `@sentry/nextjs`: PR #11
- [x] Windows script issues (`pretypecheck`, `test:fast`, the route-tree test): PR #12
- [x] Project moved from exFAT E: to NTFS `C:\Coding-Projects\top-tier-financial-solutions`

**Still open from the audit** (details in [section 3](#3-open-items-prioritized)):
- [x] **High:** remaining vulnerabilities: 2 high (`undici`, `vite`), 13 moderate, `zod` < 4.6.6 (#1). Now 0 critical, 0 high; 5 moderate left, all in the `@sentry/nextjs` 10.x tree (`glob`/`minimatch`), fixable only by the major Sentry 11 upgrade
- [x] **High:** newsletter unsubscribe has no auth or rate limit, and it leaks whether an email is subscribed (#2). Now signed token + uniform response + rate limit + zod; new `/unsubscribe` page. Note: no email in the code sends an unsubscribe link yet; use `buildUnsubscribeUrl()` when one is added
- [x] **High:** no CI pipeline (#3). `.github/workflows/ci.yml` runs lint, typecheck, test and build on PRs and pushes to `main`. Coverage and the Playwright E2E specs are not in CI yet (items 8 and 9)
- [ ] **High:** all 27 DisputeWizard tests skipped (#4)
- [x] **Medium:** Sentry client reporting likely inactive under Turbopack; `onRequestError` and `global-error.tsx` missing (#5). Client init moved to `instrumentation-client.ts`, `onRequestError` and `global-error.tsx` added, `error.tsx` now reports. Session Replay left off on purpose (PII). Needs a live check that events reach Sentry after deploy
- [ ] **Medium:** rate limiting not configured locally, so `npm run start` throws (#6)
- [ ] **Medium:** `env.example` missing 5 variables the code reads (#7)
- [ ] **Medium:** 6 Playwright E2E specs not run (#8)
- [ ] **Medium:** coverage thresholds not enforced (#9)
- [ ] **Medium:** no tests for the 2FA settings UI or the public newsletter and contact routes (#10)
- [ ] **Low:** committed agent artifacts (`.pi-subagents/` and others) (#11)
- [ ] **Low:** orphan migration `drizzle/0014_client_visible_tasks.sql` (#12)
- [ ] **Low:** stale docs (Python backend references, old plans) (#13)
- [ ] **Low:** broken `src/app/admin/AGENTS.md` link (#14)
- [ ] **Low:** stray `console.log` calls in `useAIAnalysis.ts` (#15)
- [ ] **Planned:** major dependency upgrades, one PR each (see the table in section 3)

---

## 1. Location and environment

| Item | Status |
|---|---|
| Working copy | **`C:\Coding-Projects\top-tier-financial-solutions`** (NTFS). Use this one. |
| Old copy | `E:\Dev\top-tier-financial-solutions`, untouched, safe to delete. |
| Why it moved | E: is **exFAT**, which breaks the project. Turbopack can't create junctions (`os error 1`). Webpack fails on `readlink` (`EISDIR`). Git refuses to run (`dubious ownership`). Installs take 8 minutes there versus 2 on C:. |
| Env files | `.env` and `.env.local` were copied byte-identical to the C: copy. Both are git-ignored and have never been committed in git history. |
| Toolchain | Node 22.21.1, npm 11.16.0, PowerShell 7 and Git Bash |
| Database | Neon (pooled). **54 of 54 migrations applied** and in sync with `drizzle/meta/_journal.json`; checked with a read-only query. |

**Rule going forward:** keep this repo on an NTFS drive. Don't move it back to E: or to any exFAT/FAT drive.

---

## 2. Work completed

### PR #11: Critical vulnerabilities (branch `fix/critical-security-deps`)
https://github.com/Fchery87/top-tier-financial-solutions/pull/11

| Package | From | To | Issue |
|---|---|---|---|
| `next` | 16.4.0 | 16.4.6 | **Critical:** unauthenticated RCE via the Image Optimization API (SVG) |
| `better-auth` | 1.6.23 | 1.7.28 | **Critical:** device login approval hides the requesting client and permissions |
| `@sentry/nextjs` | 10.65.0 | 10.78.0 | **Critical:** middleware bypass via tunnel route |
| `eslint-config-next` | 16.2.10 | 16.4.6 | Kept in step with `next` |
| `vitest` / `@vitest/coverage-v8` | 4.1.10 | 4.1.12 | Accepts Vite 8, which `better-auth` 1.7's optional framework peers (SvelteKit, TanStack Start) need to resolve |
| `@vitejs/plugin-react` | 5.1.1 | 5.2.0 | Same reason |

- **Code change:** `src/components/settings/TwoFactorSettings.tsx`. In `better-auth` 1.7, `twoFactor.enable()` returns `{ method: "otp" } | { method: "totp", … }`. The component now narrows on `method === 'totp'`, since the app only enrolls TOTP authenticator apps.
- **Verified:**
  - lint and typecheck pass.
  - 1,356 tests pass, including the real better-auth 2FA flow in `auth-two-factor-flow.test.ts`.
  - The production build succeeds (128/128 pages) on NTFS.
  - `npm audit`: 0 critical.
- **After deploy:** smoke-test sign-in, sign-out, sessions, and enabling 2FA. The 2FA settings UI has no component test.

### PR #12: Windows script fixes (branch `fix/windows-scripts`)
https://github.com/Fchery87/top-tier-financial-solutions/pull/12

| Problem | Fix |
|---|---|
| `pretypecheck` used `rm -rf`, which fails in cmd.exe/PowerShell and breaks `typecheck` and `validate` | Node `fs.rmSync('.next/dev', { recursive: true, force: true })` |
| `scripts/test-fast-lane.mjs` spawned `npx`, which is `npx.cmd` on Windows and fails without a shell | New `resolveVitestLauncher()` runs Vitest's CLI through `process.execPath` |
| `src/__tests__/api/workspace-route-tree.test.ts` compared `\` against `/` paths | Normalizes with `.split(sep).join('/')` |

- **Regression tests added** in `src/__tests__/test-fast-lane.test.ts`.
- **Verified in PowerShell:**
  - `npm run lint`, `npm run typecheck`, `npm run test:fast` and `npm run test` all exit 0.
  - Totals: 1,363 passed, 27 skipped, 0 failed.

The two PRs are independent and can merge in any order. Both edit `package.json` on different lines.

---

## 3. Open items (prioritized)

### High

1. **Remaining vulnerabilities.** After PR #11, `npm audit` shows 2 high (`undici`, `vite`; both transitive), 13 moderate and 2 low. Most clear with `npm audit fix` (non-breaking). Also bump `zod` to ≥ 4.6.6, which fixes memory exhaustion on oversized collections.
2. **Newsletter unsubscribe is unauthenticated.** In `src/app/api/newsletter/unsubscribe/route.ts`:
   - Anyone can unsubscribe *any* email by POSTing it.
   - No rate limiting.
   - No input validation (no zod).
   - It responds "Email not found in our list." versus "You have been unsubscribed.", which allows **email enumeration**.

   Fix: a signed, per-subscriber unsubscribe token in the email link, a uniform response, `rateLimited(publicLimiter)`, and zod validation.
3. **No CI pipeline.** There's no `.github/workflows/`, so nothing runs lint, typecheck, test or build on PRs. `validation.config.json` already defines a `ci` profile (`lint`, `typecheck`, `test:coverage`, `build`) that a workflow could use.
4. **Dispute Wizard tests are entirely skipped.** `src/__tests__/components/workspace/DisputeWizard.test.tsx` has 7 `describe.skip` blocks with 27 tests: rendering, client selection, item selection, validation, error handling, navigation, accessibility. This is a core workflow with no component coverage.

### Medium

5. **Sentry setup is outdated.** These are warnings from `@sentry/nextjs` during the build:
   - `sentry.client.config.ts` isn't loaded under Turbopack, which is the default bundler, so **client-side error reporting is likely inactive**. Move its contents to `instrumentation-client.ts`.
   - `instrumentation.ts` lacks an `onRequestError` hook (`export const onRequestError = Sentry.captureRequestError`).
   - There's no `src/app/global-error.tsx` with Sentry instrumentation for React render errors.
6. **Rate limiting isn't configured locally.** `src/lib/rate-limit.ts` throws at startup when `NODE_ENV=production` and `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are missing. Neither local env file has them, so a local `npm run start` fails. Add the keys, or set `RATE_LIMIT_DISABLED=true` locally. Production (Vercel) env must have them.
7. **`env.example` is missing variables the code reads:** `CRON_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ZHIPU_API_KEY`, `RATE_LIMIT_DISABLED`. The local env files also lack several vars that `env.example` lists (Sentry, Upstash, Resend/SendGrid, `EMAIL_FROM`, `COMPANY_*`, `ENCRYPTION_KEYRING` / `ENCRYPTION_ACTIVE_KEY_ID`). The legacy `ENCRYPTION_KEY` fallback in `src/lib/encryption.ts` covers encryption.
8. **Untested E2E suite.** `e2e/` has 6 Playwright specs (auth-redirect, dispute-wizard, letter-studio, portal-shell, team-roles, workspace-search) that weren't run during this audit. They need a running app plus an auth setup.
9. **Coverage isn't enforced.** `validation.config.json` says minimum 70% and target 80%, but `vitest.config.ts` has no `coverage.thresholds`.
10. **Missing tests** for `TwoFactorSettings.tsx` (UI), the public newsletter subscribe/unsubscribe routes, and the public contact-forms route.

### Low (cleanup and accuracy)

11. **Committed agent and tool artifacts:** `.pi-subagents/` (119 transcript files), `.harness/`, `.audit/`, `.scans/`, `.codex`. A secret scan found **no real credentials** in them (all hits were long encoded blobs that match no real env value), but they don't belong in the repo. Untrack them and add them to `.gitignore`.
12. **Orphan migration:** `drizzle/0014_client_visible_tasks.sql` isn't in the journal and never runs. Its columns are already created by `0001_bizarre_gorilla_man.sql` and `0014_wealthy_kree.sql`. Safe to delete.
13. **Stale docs:**
    - `VALIDATION_TASKS.md` (Dec 2025) and `PHASE_4_TESTING_SUMMARY.md` describe a FastAPI/Python backend and an `api/` dir that no longer exist. `ruff.toml` belongs to that backend.
    - `DISPUTE_WIZARD_STRENGTHENING_PLAN.md` and `generate-agents.md` are one-off planning prompts.
    - `metadata.json` holds an early marketing-site idea brief.
    - Archive or delete these.
14. **Broken link:** the root `AGENTS.md` links to `src/app/admin/AGENTS.md`, which doesn't exist.
15. **Stray `console.log`:** two calls in `src/components/workspace/dispute-wizard/hooks/useAIAnalysis.ts` (lines ~26 and ~124). Use the project logger or remove them.

### Dependency currency (major upgrades; each needs its own migration PR)

| Package | Locked | Latest |
|---|---|---|
| typescript | 5.9.3 | 7.x |
| eslint | 9.39 | 10.x |
| vitest | 4.1 | 5.x |
| @anthropic-ai/sdk | 0.72 | 1.x |
| openai | 6.18 | 7.x |
| @google/genai | 1.40 | 3.x |
| @sentry/nextjs | 10.x | 11.x |
| pdf-parse | 1.1.1 | 2.x (API rewrite) |
| lucide-react | 0.555 | 1.x |
| framer-motion | 12.23 | 14.x |
| jsdom | 27 | 31 |
| @playwright/test | 1.58 | 1.65 |
| @types/node | 20 | should match Node 22 in use |
| react / react-dom | 19.2.0 (pinned exact) | 19.3.1 |

Also: `npm ci` warns that 8 packages have install scripts not covered by `allowScripts` (esbuild, @sentry/cli, core-js, protobufjs, unrs-resolver). Review them with `npm approve-scripts`.

---

## 4. What was checked and found OK

- **ESLint:** 0 errors, 0 warnings.
- **TypeScript strict:** 0 errors.
- **API auth coverage:** all 115 route handlers checked.
  - Every `/api/workspace/**` route uses `requireCapability`, `validateAdmin` or `getAuthenticatedUser`.
  - `disputes/drafts/generate` re-exports the guarded `generate-letter` handler.
  - Unguarded routes are intentionally public: auth, blog, services, public FAQs, testimonials and disclaimers, newsletter, and contact forms.
  - Cron routes check `CRON_SECRET`.
- **Proxy (`src/proxy.ts`):** sets security headers (HSTS, CSP, frame options, nosniff, referrer and permissions policy) and a request ID. CSP still allows `'unsafe-inline'` scripts, which is a possible future hardening via nonces.
- **Secrets:** no `.env*` file has ever been committed (history checked). `env.example` and `docs/SETUP_GUIDE.md` contain only placeholders.
- **Code hygiene:** no real TODO or FIXME markers. The `XXX` hits are SSN masks.

---

## 5. Suggested next session order

1. Merge PR #11 and PR #12; smoke-test auth after deploy.
2. `npm audit fix` and `zod` ≥ 4.6.6, to clear the remaining high vulnerabilities.
3. Fix the newsletter unsubscribe endpoint (signed token, uniform response, rate limit).
4. Add a GitHub Actions CI workflow (lint, typecheck, test, build).
5. Fix the Sentry setup (`instrumentation-client.ts`, `onRequestError`, `global-error.tsx`).
6. Un-skip and repair the DisputeWizard tests.
7. Cleanup: artifacts, orphan migration, stale docs, `env.example`, the AGENTS.md link.
8. Plan major dependency upgrades one at a time.
