# Production Readiness Blockers

Generated during S38 End-To-End Production Readiness Pass. Dependency security section updated 2026-07-15 during the production-readiness-remediation pass — the December 2025 "zero high/critical" claim below had gone stale (no CI existed to catch drift) and a fresh `npm audit` on 2026-07-15 found 21 advisories, including 3 critical and 6 high. See "2026-07-15 Dependency Security Remediation" below for the current, verified state.

## Verification Passed

- `npm run validate` completed successfully: lint, typecheck, full Vitest suite, and production build passed.
- Final full test suite result: 51 test files passed, 1 skipped; 658 tests passed, 27 skipped.
- Production build completed and generated 121 static pages.
- `git diff --check` completed with no whitespace errors.

## Release Blockers (as of 2026-07-15)

No high or critical dependency advisories remain. `npm audit --audit-level=high` exits `0`. Two moderate and three low advisories remain and are documented below as accepted, non-blocking findings — see "Remaining Advisories (2026-07-15)".

**Historical note:** the "no high/critical" claim previously recorded here dated from a December 2025 pass and was stale by 2026-07-15 — `better-auth` had drifted to a version with 3 critical/high CVEs (including a stale-session-after-user-deletion issue affecting this app's admin console) and `next`/`undici`/`ws`/`fast-uri`/`protobufjs`/`vite` had drifted to versions with 6 high-severity CVEs between the two passes, with nothing catching it because no CI pipeline existed yet. Treat any "zero advisories" claim in this doc as time-bound to its stated audit date, not as an ongoing guarantee.

## 2026-07-15 Dependency Security Remediation

A fresh `npm audit` on 2026-07-15 found 21 advisories (4 low, 8 moderate, 6 high, 3 critical), most severely:

- `better-auth <=1.6.12` (critical): OAuth callback state-mismatch bypass (`GHSA-wxw3-q3m9-c3jr`), OAuth refresh-token replay (`GHSA-pw9m-5jxm-xr6h`), and **stale sessions persisting after user deletion across admin/anonymous/SCIM flows** (`GHSA-2vg6-77g8-24mp`) — this last one is a direct concern for this app, since `src/lib/auth.ts` uses the `admin()` plugin for `user`/`admin`/`super_admin` role management.
- `next` (high): middleware/proxy bypass and cache-poisoning family of advisories (`GHSA-26hh-7cqf-hhc6`, `GHSA-3g8h-86w9-wvmq`, `GHSA-vfv6-92ff-j949`, `GHSA-wfc6-r584-vfw7`, `GHSA-267c-6grr-h53f`, `GHSA-36qx-fr4f-26g5`, `GHSA-492v-c6pp-mqqv`, and related DoS/XSS/SSRF findings).
- `undici`, `ws`, `fast-uri`, `protobufjs` (high, transitive) and `vitest` (critical, dev-only UI-server arbitrary file read/execute).

Remediation applied, in order:

1. `npm audit fix` (no `--force`) — cleared `undici`, `ws`, `fast-uri`, `protobufjs`, `vite`, and `vitest` entirely (21 → 6 vulnerabilities: 3 low, 2 moderate, 1 critical remaining at that point).
2. `npm install better-auth@latest` — bumped `better-auth` from `1.4.18` (range `^1.4.3`) to `1.6.23` (range now `^1.6.23`), clearing the critical advisory. No application code changes were required: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/admin-auth.ts`, `src/lib/admin-session.ts`, and `src/app/api/auth/[...all]/route.ts` all continued to work against the new version's `drizzleAdapter`, `admin()` plugin, `toNextJsHandler`, and session `additionalFields` APIs unchanged. (The install required `--legacy-peer-deps` due to an unrelated, irrelevant ERESOLVE conflict on better-auth's optional `@sveltejs/kit` peer, which this project does not use.)
3. `npm install next@16 eslint-config-next@16` — bumped `next` from `16.1.6`/`16.2.4` (installed) to `16.2.10`, the latest release on the current v16 line. This **fully cleared** the middleware/proxy-bypass and cache-poisoning advisories — the patched fix was already published on stable 16.2.10, so no next-major upgrade or forced fix was needed.
4. Verified: `npm run typecheck` clean; `npx vitest run src/__tests__/api --reporter=dot` — 143/145 tests passed (2 pre-existing failures in `dispute-creation-policy-trace.test.ts` unrelated to this change, see below); live smoke test against the real Neon database confirmed sign-in, `/admin` (200), and `/api/admin/stats` (200 authenticated / 401 unauthenticated) all work correctly post-upgrade.

Result: `npm audit --audit-level=high` now exits `0`. 21 advisories → 5 (3 low, 2 moderate), all below the high threshold.

## Remaining Advisories (2026-07-15)

**Moderate — `postcss <8.5.10` (via `next@16.2.10`'s vendored `postcss@8.4.31`):** `GHSA-qx2v-qp2m-jg93` (XSS via unescaped `</style>` in PostCSS stringify output). `npm`'s only suggested fix is `npm audit fix --force`, which would install `next@9.3.3` — a major downgrade, not a valid remediation for this Next.js 16 app, and explicitly not applied per this project's standing policy against forced/downgrading audit fixes. Per prior research (Vercel issue `vercel/next.js#93234`, PR `vercel/next.js#93288`), Vercel maintainers state this does not affect ordinary Next.js apps because the bundled PostCSS path only runs at build time against trusted source. Revisit when Next ships a stable release incorporating PR #93288, or when npm's advisory metadata recognizes a valid Next.js remediation path.

**Low — `esbuild 0.27.3–0.28.0` (via `@esbuild-kit/core-utils` and `tsx`, both dev-only transitive deps of `drizzle-kit`):** `GHSA-g7r4-m6w7-qqqr` (arbitrary file read via the esbuild dev server, Windows-only). Pre-existing override (`overrides["@esbuild-kit/core-utils"].esbuild = "^0.27.7"`) already pins this to the newest available compatible version; a newer non-vulnerable esbuild release is not yet available through this transitive path. Dev-only, not Windows-targeted in this deployment, accepted as-is.

## Pre-Existing Test Failure Found During 2026-07-15 Verification (Not Fixed — Out of Scope)

While running `npx vitest run src/__tests__/api` as part of the dependency-upgrade verification, 2 of 145 tests failed in `src/__tests__/api/admin/dispute-creation-policy-trace.test.ts`. This is unrelated to the better-auth/next upgrade: the test's `dbMock.select` mock chain (`from().where().limit()`) doesn't account for the `.orderBy()` call that `requireLatestApprovedReportForClient` (`src/lib/parser-review-gate.ts`) added ahead of the mocked calls, a mismatch introduced by an earlier feature commit (`c1afa36`, "enhance credit report parsing and dispute automation logic"), not by this dependency remediation. Confirmed pre-existing and dependency-version-independent because the mock is a locally-defined `vi.fn()` stub with no dependency on the installed `drizzle-orm`/`better-auth`/`next` versions, and this task did not touch `parser-review-gate.ts`, the test file, or the disputes route. Left unfixed as out of scope for a dependency-security task; flagged here for a follow-up.

## Non-Blocking Warnings

- Full test output still includes React `act(...)` warnings in `WorkQueue` tests.
- Full test output still includes mocked `framer-motion` DOM prop warnings in `DisputeWizardProgressBar` tests.
- Build output warns that Next.js inferred `/home/nochaserz/package-lock.json` as workspace root because multiple lockfiles exist.
