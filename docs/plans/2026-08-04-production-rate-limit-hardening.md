# Production Rate-Limit Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce real production rate limiting and protect authentication, upload, and public-write endpoints from abuse.

**Architecture:** Keep configuration validation and no-op behavior behind the existing `rate-limit` module. In production, missing Upstash configuration is a server-startup error unless an explicit `RATE_LIMIT_DISABLED=true` override is set; Next's `phase-production-build` is exempt because route modules are imported while compiling, not serving requests. Route handlers remain shallow callers that select `authLimiter`, `uploadLimiter`, `publicLimiter`, or `sensitiveLimiter`; the limiter module owns keying, headers, and failure semantics.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript strict mode, Upstash Ratelimit/Redis, Vitest.

## Task 1: Enforce production configuration and protect authentication

**Files:**

- Modify: `src/lib/rate-limit.ts`
- Modify: `src/app/api/auth/[...all]/route.ts`
- Create: `src/__tests__/lib/rate-limit-config.test.ts`
- Modify: `env.example`

1. Write a failing import-time test proving production rejects missing Upstash settings unless `RATE_LIMIT_DISABLED=true` is explicit.
2. Add the minimal configuration guard and an IP-keyed `authLimiter` (10 attempts/minute).
3. Wrap Better Auth `POST` only; leave its read-only `GET` handler unchanged.
4. Document the explicit development/emergency override in `env.example`.

## Task 2: Protect controlled uploads

**Files:**

- Modify: `src/app/api/admin/disputes/evidence/upload/route.ts`
- Modify: `src/app/api/portal/documents/upload/route.ts`
- Test: existing upload route tests plus focused new coverage where the current route testing seam allows it

1. Write a failing route-level test proving the configured upload limiter wraps the staff evidence upload.
2. Apply the existing `uploadLimiter` to staff evidence and portal document upload mutations.
3. Verify rejected attempts return the existing standard `429` response without entering storage or database work.

## Task 3: Protect public writes and cap payloads

**Files:**

- Modify: `src/app/api/public/contact-forms/route.ts`
- Modify: `src/app/api/newsletter/subscribe/route.ts`
- Test: relevant public-route tests (create if absent)

1. Write failing tests for the limiter wrapping and oversized message rejection.
2. Apply `publicLimiter` to write methods and validate bounded request fields before persistence or provider calls.
3. Preserve current success/error response contracts for valid requests.

## Task 4: Verification and handoff

1. Run focused tests after each red-green loop.
2. Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` before completion.
3. Record the executed work and any intentionally deferred CAPTCHA/Turnstile integration in `docs/plans/2026-07-15-production-readiness-remediation.md`.

## Acceptance criteria

- Production startup fails loudly without real rate limiting, unless an explicit documented override is supplied.
- Authentication POSTs, controlled uploads, and public writes are rate-limited.
- Public payloads are bounded before writes.
- Existing development/test environments can use the explicit no-op path without contacting Upstash.
- Full validation passes.

## Completion record — 2026-08-04

- [x] Added production runtime configuration enforcement, the explicit emergency override, and a Next build-phase exemption. The production server still fails closed when Redis configuration is absent.
- [x] Added the 10-per-minute IP-keyed Better Auth POST limiter.
- [x] Applied the upload limiter to portal document uploads and staff dispute-evidence uploads.
- [x] Applied the public limiter and bounded all persisted contact-form and newsletter string fields before database work.
- [x] Added focused route and configuration coverage. The focused suite passes with 17 tests; full typecheck, lint, test, and build gates pass after the build-phase regression fix.
- [ ] CAPTCHA/Turnstile remains intentionally deferred; it requires separate Cloudflare configuration and client-side integration.
- [ ] The historical rate-limit plan's credit-report and message-attachment upload routes remain outside this focused slice and need their own coverage before being wrapped.
