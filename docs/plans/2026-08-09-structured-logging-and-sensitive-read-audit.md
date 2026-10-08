# Structured Logging and Sensitive-Read Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add request-correlated structured server logs and durable, PII-minimized audit records for protected client, report, and letter reads.

**Architecture:** A server-only logger owns JSON formatting, redaction, error normalization, and test injection. The proxy generates a request ID, forwards it to handlers, and returns it to callers. A typed sensitive-read helper extends `admin_activity_log`; protected data is not returned if its audit write fails.

**Tech Stack:** Next.js 16 Proxy and route handlers, TypeScript strict mode, Pino, Drizzle ORM, Vitest.

## Completion record — 2026-08-09

- Task 1: complete. Added a server-only Pino seam with recursive sensitive-key
  redaction, error-name normalization, and a typed `recordSensitiveRead`
  contract backed by `admin_activity_log`.
- Task 2: complete. The proxy generates a UUID request ID, overrides client
  input, forwards it to handlers, and returns it to callers.
- Task 3: complete. Client record, audit-report preview, and dispute-letter
  reads write one PII-minimized audit event after authorization and resource
  existence checks; an audit failure returns `500` without the protected body.
- Task 4: complete. Removed 197 direct server `console.*` calls across API
  routes and libraries. The AST source audit prevents their reintroduction.
- Task 5: complete. Focused tests, typecheck, lint, the full suite, and a
  production build passed. The isolated build emitted Better Auth default-secret
  warnings because it does not inherit the production secret; deployment must
  provide `BETTER_AUTH_SECRET`.

## Invariants

1. Server logs never contain credentials, cookies, email/phone/address/SSN, letter text, prompt context, report HTML, document URLs, or raw bodies.
2. The proxy replaces any client-supplied request ID with a generated UUID and exposes it as `x-request-id`.
3. Client record, audit-report, and dispute-letter reads produce exactly one durable audit row containing only actor ID, subject type/id, route, and request ID.
4. Audit failure fails closed for those protected responses.
5. Browser-only `console` feedback is outside this task.

## Task 1: Safe logger and audit contracts

**Files:**

- Create `src/lib/server-logger.ts` and `src/lib/sensitive-read-audit.ts`.
- Modify `src/lib/admin-activity.ts`, `package.json`, and `package-lock.json`.
- Create `src/lib/__tests__/server-logger.test.ts` and `src/lib/__tests__/sensitive-read-audit.test.ts`.

1. Write a failing logger test with an injected sink. Require a JSON-safe event containing `level` and `event`; require recursive removal of metadata keys `email`, `phone`, `address`, `ssn`, `content`, `prompt`, `letter`, `html`, `url`, `cookie`, `token`, and `secret`; require normalized `Error` data only.
2. Run `npx vitest run --pool=threads --maxWorkers=1 src/lib/__tests__/server-logger.test.ts`; it must fail because the module is absent.
3. Add `pino` and implement one deep `logServerEvent` interface accepting level, event, request/route/method/status identifiers, actor/resource identifiers, error, and optional metadata. The module owns redaction and Pino configuration; callers cannot obtain the Pino instance.
4. Write a failing audit test for a discriminated `recordSensitiveRead` input. It must prove serialized metadata includes only `route` and `requestId` and cannot receive letter/prompt content.
5. Extend `AdminActivitySubjectType` with `client_record`, `credit_report`, and `dispute_letter`; implement `recordSensitiveRead` by delegating to `recordAdminActivity`.
6. Re-run both library suites and commit `feat(observability): add safe server logging seam`.

## Task 2: Request identity propagation

**Files:** Modify `src/proxy.ts` and `src/__tests__/proxy.test.ts`.

1. Write failing tests that assert a UUID-shaped generated `x-request-id` appears in response and forwarded request headers, and client input cannot control it.
2. Generate with `crypto.randomUUID()`, clone/replace request headers, and use `NextResponse.next({ request: { headers } })` before applying security headers. Do not derive identity from IP, session, or cookies.
3. Run `npx vitest run --pool=threads --maxWorkers=1 src/__tests__/proxy.test.ts` and commit `feat(observability): propagate request identifiers`.

## Task 3: Protected-read audit integration

**Files:**

- Modify `src/app/api/admin/clients/[id]/route.ts`.
- Modify `src/app/api/admin/clients/[id]/audit-report/route.ts`.
- Modify `src/app/api/admin/disputes/[id]/letter/route.ts`.
- Create `src/__tests__/api/admin/client-sensitive-read-audit.test.ts`.
- Modify `src/__tests__/api/admin/dispute-letter-state.test.ts`.

1. Write failing route tests for successful client, report, and letter reads. Assert exactly one audit call with actor ID, subject ID, route, and request header ID; assert no decrypted fields, report HTML, letter/revision content, or lint context enter audit input.
2. Add the failure test: rejected audit write returns `500` before protected response content.
3. After authorization and existence/ownership checks, call `recordSensitiveRead`. Replace route-level `console.error` with `logServerEvent`, carrying only safe route/status/request/resource data and the normalized error.
4. Run the two changed route suites and commit `feat(audit): record sensitive workspace reads`.

## Task 4: Server logging migration

**Files:** Server route and `src/lib` files using `console.log`, `console.warn`, or `console.error`; create `src/__tests__/lib/server-logging-source-audit.test.ts`.

1. Write a source-audit test that fails for direct `console.*` in server routes/libraries but permits test fixtures, browser-only components, and the logger’s own adapter.
2. Migrate in independently reviewable commits: first `/api/admin` and `/api/portal`; then public/auth/cron routes; then server-side libraries, parsers, encryption, rate-limit, and dispute workflows.
3. Every migrated call must use a stable event name and safe metadata; preserve all response and fallback behavior.
4. Run the source audit, typecheck, and lint after each batch.

## Task 5: Documentation and verification

**Files:** Modify `env.example` only if log-level configuration is added; update `docs/plans/2026-07-15-production-readiness-remediation.md`, the remaining-work program after its branch is integrated, and `src/lib/AGENTS.md`.

1. Document log-level defaults, request-ID behavior, redaction guarantees, fail-closed audit semantics, and the audit-log query path without including PII or secrets.
2. Run `git diff --check`, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.
3. Run a defect-focused review; verify the source audit is green and sensitive-read tests cover failed audit writes. Commit `docs(observability): document logging and read audits`.

## Rollback

Revert logger migration commits first. Do not remove audit rows. An availability incident may use a documented maintenance response for a protected route, but must never bypass its audit requirement.
