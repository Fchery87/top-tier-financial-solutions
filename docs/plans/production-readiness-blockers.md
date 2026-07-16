# Production Readiness Blockers

Generated during S38 End-To-End Production Readiness Pass. Dependency security section updated 2026-07-15 during the production-readiness-remediation pass — the December 2025 "zero high/critical" claim below had gone stale (no CI existed to catch drift) and a fresh `npm audit` on 2026-07-15 found 21 advisories, including 3 critical and 6 high. See "2026-07-15 Dependency Security Remediation" below for the current, verified state.

## Verification Passed

- `npm run validate` completed successfully: lint, typecheck, full Vitest suite, and production build passed.
- Final full test suite result: 51 test files passed, 1 skipped; 658 tests passed, 27 skipped.
- Production build completed and generated 121 static pages.
- `git diff --check` completed with no whitespace errors.

## Release Blockers (as of 2026-07-15)

No high or critical dependency advisories remain. `npm audit --audit-level=high` exits `0`. Two moderate and one low advisory remain and are documented below as accepted, non-blocking findings — see "Remaining Advisories (2026-07-15)".

**Historical note:** the "no high/critical" claim previously recorded here dated from a December 2025 pass and was stale by 2026-07-15 — `better-auth` had drifted to a version with 3 critical/high CVEs (including a stale-session-after-user-deletion issue affecting this app's admin console) and `next`/`undici`/`ws`/`fast-uri`/`protobufjs`/`vite` had drifted to versions with 6 high-severity CVEs between the two passes, with nothing catching it because no CI pipeline existed yet. Treat any "zero advisories" claim in this doc as time-bound to its stated audit date, not as an ongoing guarantee.

## 2026-07-15 Dependency Security Remediation

A fresh `npm audit` on 2026-07-15 found 21 advisories (4 low, 8 moderate, 6 high, 3 critical), most severely:

- `better-auth <=1.6.12` (critical): OAuth callback state-mismatch bypass (`GHSA-wxw3-q3m9-c3jr`), OAuth refresh-token replay (`GHSA-pw9m-5jxm-xr6h`), and **stale sessions persisting after user deletion across admin/anonymous/SCIM flows** (`GHSA-2vg6-77g8-24mp`) — this last one is a direct concern for this app, since `src/lib/auth.ts` uses the `admin()` plugin for `user`/`admin`/`super_admin` role management. (Reachability note: the two OAuth CVEs don't apply here at all — `src/lib/auth.ts` only configures `emailAndPassword`, no social/OAuth providers. The stale-session CVE has no live exploit path today either, since this codebase has no user-deletion route or `deleteUser` call anywhere — but the fix is now correctly in place for if/when that feature is added.)
- `next` (high): middleware/proxy bypass and cache-poisoning family of advisories (`GHSA-26hh-7cqf-hhc6`, `GHSA-3g8h-86w9-wvmq`, `GHSA-vfv6-92ff-j949`, `GHSA-wfc6-r584-vfw7`, `GHSA-267c-6grr-h53f`, `GHSA-36qx-fr4f-26g5`, `GHSA-492v-c6pp-mqqv`, and related DoS/XSS/SSRF findings).
- `undici`, `ws`, `fast-uri`, `protobufjs` (high, transitive) and `vitest` (critical, dev-only UI-server arbitrary file read/execute).

Remediation applied, in order:

1. `npm audit fix` (no `--force`) — cleared `undici`, `ws`, `fast-uri`, `protobufjs`, `vite`, and `vitest` entirely (21 → 6 vulnerabilities: 3 low, 2 moderate, 1 critical remaining at that point).
2. `npm install better-auth@latest` — bumped `better-auth` from `1.4.18` (range `^1.4.3`) to `1.6.23` (range now `^1.6.23`), clearing the critical advisory. No application code changes were required: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/admin-auth.ts`, `src/lib/admin-session.ts`, and `src/app/api/auth/[...all]/route.ts` all continued to work against the new version's `drizzleAdapter`, `admin()` plugin, `toNextJsHandler`, and session `additionalFields` APIs unchanged. (The install required `--legacy-peer-deps` due to an unrelated, irrelevant ERESOLVE conflict on better-auth's optional `@sveltejs/kit` peer, which this project does not use.)
3. `npm install next@16 eslint-config-next@16` — bumped `next` from `16.1.6`/`16.2.4` (installed) to `16.2.10`, the latest release on the current v16 line. This **fully cleared** the middleware/proxy-bypass and cache-poisoning advisories — the patched fix was already published on stable 16.2.10, so no next-major upgrade or forced fix was needed.
4. Verified: `npm run typecheck` clean; `npx vitest run src/__tests__/api --reporter=dot` — 143/145 tests passed (2 pre-existing failures in `dispute-creation-policy-trace.test.ts` unrelated to this change, see below); live smoke test against the real Neon database confirmed sign-in, `/admin` (200), and `/api/admin/stats` (200 authenticated / 401 unauthenticated) all work correctly post-upgrade.

Result: `npm audit --audit-level=high` now exits `0`. 21 advisories → 3 (1 low, 2 moderate), all below the high threshold. (A follow-up pass bumped the `@esbuild-kit/core-utils` esbuild override from `^0.27.7` to `^0.28.1`, clearing 2 of the 3 low findings — see "Remaining Advisories" below for the one that's left.)

## Remaining Advisories (2026-07-15)

**Moderate — `postcss <8.5.10` (via `next@16.2.10`'s vendored `postcss@8.4.31`):** `GHSA-qx2v-qp2m-jg93` (XSS via unescaped `</style>` in PostCSS stringify output). `npm`'s only suggested fix is `npm audit fix --force`, which would install `next@9.3.3` — a major downgrade, not a valid remediation for this Next.js 16 app, and explicitly not applied per this project's standing policy against forced/downgrading audit fixes. Per prior research (Vercel issue `vercel/next.js#93234`, PR `vercel/next.js#93288`), Vercel maintainers state this does not affect ordinary Next.js apps because the bundled PostCSS path only runs at build time against trusted source. Revisit when Next ships a stable release incorporating PR #93288, or when npm's advisory metadata recognizes a valid Next.js remediation path.

**Low — `esbuild 0.27.3–0.28.0` (remaining instance: `tsx@4.21.0`, a dev-only transitive dep of `drizzle-kit`):** `GHSA-g7r4-m6w7-qqqr` (arbitrary file read via the esbuild dev server, Windows-only). The `@esbuild-kit/core-utils` instance of this same advisory (the other transitive path, also via `drizzle-kit`) is now fixed: the `overrides["@esbuild-kit/core-utils"].esbuild` entry in `package.json` was bumped from `^0.27.7` to `^0.28.1`, which resolves outside the vulnerable range (confirmed via `npm ls esbuild`). The `tsx` instance genuinely can't be moved the same way: `tsx@4.21.0` pins its own esbuild dependency to `~0.27.0` (no override reaches it, since `tsx` — not `@esbuild-kit/core-utils` — is the direct dependent). Upgrading `tsx` doesn't fully solve it either: even `tsx@4.23.1` (latest, checked 2026-07-15) still pins `~0.28.0`, which includes the vulnerable `0.28.0` floor — a fix requires `tsx` itself to bump past `0.28.0`, which is not yet available upstream. Dev-only, not Windows-targeted in this deployment, accepted as-is; revisit when `tsx` ships a release with `esbuild >0.28.0`.

## Sentry Version Drift (Side Effect of `npm audit fix`)

Regenerating the lockfile during this remediation carried the `@sentry/*` family from `10.51.0` to `10.65.0` (14 minor versions) as a side effect of `npm audit fix`, which also dropped some `@opentelemetry/instrumentation-*` sub-dependencies Sentry used for auto-instrumentation. This is within the already-declared floating range in `package.json` (`@sentry/nextjs: ^10.38.0`, unchanged) and not a spec violation, but the dependency-upgrade verification (typecheck, targeted API tests, dev-server smoke) didn't exercise the Sentry error-capture path. A full production build (`npm run build`, which wires up `withSentryConfig` in `next.config.ts`) was run as a cheap confirmation and completed cleanly with no Sentry-plugin errors and the full expected route manifest generated. This does not verify Sentry's runtime error-capture behavior end-to-end — only that the build-time plugin integration still works — so treat this as a documentation note, not a full regression test.

## Pre-Existing Test Failure Found During 2026-07-15 Verification (Not Fixed — Out of Scope)

While running `npx vitest run src/__tests__/api` as part of the dependency-upgrade verification, 2 of 145 tests failed in `src/__tests__/api/admin/dispute-creation-policy-trace.test.ts`. This is unrelated to the better-auth/next upgrade: the test's `dbMock.select` mock chain (`from().where().limit()`) doesn't account for the `.orderBy()` call that `requireLatestApprovedReportForClient` (`src/lib/parser-review-gate.ts`) added ahead of the mocked calls, a mismatch introduced by an earlier feature commit (`c1afa36`, "enhance credit report parsing and dispute automation logic"), not by this dependency remediation. Confirmed pre-existing and dependency-version-independent because the mock is a locally-defined `vi.fn()` stub with no dependency on the installed `drizzle-orm`/`better-auth`/`next` versions, and this task did not touch `parser-review-gate.ts`, the test file, or the disputes route. Left unfixed as out of scope for a dependency-security task; flagged here for a follow-up.

## Non-Blocking Warnings

- Full test output still includes React `act(...)` warnings in `WorkQueue` tests.
- Full test output still includes mocked `framer-motion` DOM prop warnings in `DisputeWizardProgressBar` tests.
- Build output warns that Next.js inferred `/home/nochaserz/package-lock.json` as workspace root because multiple lockfiles exist.
