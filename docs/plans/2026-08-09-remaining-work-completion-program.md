# Remaining Work Completion Program

> **For Claude:** Execute one phase at a time in an isolated worktree. Use
> `superpowers:brainstorming`, `superpowers:writing-plans`,
> `superpowers:test-driven-development`, and
> `superpowers:verification-before-completion` for each implementation phase.

**Goal:** Complete every internally actionable item in the current planning
set, make external prerequisites explicit and secure, and retire or reconcile
superseded plans so an unchecked box never misrepresents shipped behavior.

**Architecture:** Treat plans as evidence-backed program records rather than
as a second source of truth. Each phase begins with a focused implementation
plan and a fresh baseline in an isolated worktree. Provider and platform work
uses environment-backed adapters that fail closed in production; activation is
not simulated when it needs credentials, account authority, cost approval, or
law-change confirmation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode,
Drizzle/Neon Postgres, Better Auth, Vitest, Playwright, Cloudflare Turnstile,
Upstash, and provider adapters.

## Completion boundary

“Complete all remaining” includes every actionable product, security,
maintainability, and documentation item in the plans below. It does not permit
inventing external credentials, incurring provider cost without explicit
development opt-in, dropping retained production data without retention
approval, or adding a legal disclosure before its triggering legislation is
law.

## Evidence reconciliation — 2026-08-09

The following are complete and must not be scheduled again:

1. Workspace, portal, Letter Studio, response-review, secure-evidence, and
   rate-limit implementation slices. Their latest completion records and
   repository validation are in
   `2026-08-02-workspace-portal-letter-studio-completion.md` and
   `2026-08-04-production-rate-limit-hardening.md`.
2. Credit Brain P0–P3. Focused verification for the previously stale P1
   markers passed on 2026-08-09: six suites and fourteen tests covering
   tri-merge evidence, bureau presence, same-pull discrepancy detection, and
   triage behavior.
3. Credit Repair Platform S01–S38. The roadmap checklist is reconciled to the
   named API/library/component/browser test seams.
4. The WizardContext extraction plan’s local-hook phases are already present
   under `src/components/workspace/dispute-wizard/`; the former
   `src/components/admin/` paths are obsolete.

## Phase 1 — Bot protection and public-write verification

### 1.1 Cloudflare Turnstile

Protect the contact and newsletter forms end-to-end using the canonical
server-side Siteverify flow. Keep rate limiting as a separate first layer.

**External prerequisite:** a Cloudflare API token with
`Account.Turnstile:Edit`, the target account, and approval of the registered
production hostname. The read-only probe on 2026-08-09 found no
`CLOUDFLARE_API_TOKEN` in the environment.

**Implementation plan required before code:** identify form components and
route handlers, create the managed widget for `localhost`, `127.0.0.1`, and
the approved hostname, add the client widget only at approved forms, validate
the submitted token on the server with `TURNSTILE_SECRET`, test all rejection
paths, and run the Turnstile skill validator. Never send the secret to the
browser or commit it.

**Acceptance evidence:** widget configuration returned by Cloudflare, focused
client/server tests, validation script output, and production environment
configuration review.

## Phase 2 — Observability and boundary hardening

### 2.1 Structured logging and sensitive-read audit trail

Replace server-side operational `console.*` calls with a structured logging
seam carrying a request ID. Add transactional audit rows for sensitive client
record views, report downloads, and letter generation. Keep client-side user
feedback unchanged and do not log PII, letter text, prompt text, credentials,
or storage URLs.

### 2.2 Schema validation at API boundaries

Adopt Zod schemas at request boundaries, beginning with routes accepting
client PII, uploads, role/settings changes, and public writes. The schema must
bound strings and arrays before database, provider, or storage work and return
the route’s established error contract.

### 2.3 Envelope encryption and key rotation

Introduce a versioned key-provider seam around existing AES-GCM ciphertext.
Support decrypting existing data, encrypting new data with the current key
version, and a tested, resumable rotation command. Key material belongs only in
the deployment secret store.

**Gate:** each task requires TDD coverage, TypeScript/lint, affected API
tests, full repository test, production build, and a PII/log-redaction review.

## Phase 3 — Operational provider integrations

### 3.1 Mailing-provider adapter

Add a provider-neutral mailing seam for Lob, PostGrid, or Click2Mail. Preserve
the existing manual submission-tracking workflow as the fallback; no dispute
may be marked submitted until the provider response is normalized into the
same tracking/proof model.

**Decision required:** select provider, account, budget, and live/sandbox
authority before provider calls are enabled.

### 3.2 Credit-monitoring import adapter

Add an explicitly authorized IdentityIQ/SmartCredit pull adapter that stores a
controlled report import and sends it through the existing parser-review gate.

**Decision required:** select provider, obtain permitted integration
credentials, and document consumer authorization/terms constraints.

### 3.3 Deployment, monitoring, and SMTP closure

Choose the production platform, define staging and rollback, configure uptime
and cron monitoring, and decide whether to implement SMTP or remove the unused
SMTP option. This phase is complete only after a production-like deployment
exercise and a rollback drill.

## Phase 4 — Remaining architecture migrations

### 4.1 API namespace migration

Migrate `/api/admin/*` to `/api/workspace/*` through a compatibility layer,
contract tests, and an announced deprecation window. This is a large routing
change, so it has its own plan and migration matrix; do not break stored links
or external consumers.

### 4.2 Custom roles

Move role definitions and capability assignments from the static map into a
validated database model. Preserve the final-super-admin protection and make
all existing authorization decisions query the same capability interface.

### 4.3 Deprecated table disposition

Keep `dispute_letter_templates` read-only until a retention period, backup
verification, rollback plan, and owner approval allow a separate destructive
migration. No production data is dropped as part of this program without that
approval.

### 4.4 Contingent disclosure watch

Do not implement the S.4144/H.R.306 disclosure speculatively. Re-check the
law’s enacted status before this task; if it is law, write an implementation
plan around `postProcessLetter` and jurisdictional configuration.

## Phase 5 — Maintainability and UX program refresh

The existing thermo-nuclear and UI/UX plans use many obsolete
`src/components/admin` and `/admin` casework paths. Before implementation,
perform a fresh code-quality and interface audit against the post-workspace
structure, then replace those drafts with current, independently testable
plans. Preserve completed WizardContext extractions rather than repeating
them.

Priority order after the refresh:

1. deterministic AI-letter renderer modules and route-handler seams;
2. parser and report-generation seams;
3. FastAPI content-router and schema-domain splits;
4. focused client-record CRM and responsive workspace UX improvements;
5. test maintainability cleanup and a final architecture audit.

## Phase 6 — Letter-library execution decision

The read-only pilot is complete. Synthetic provider execution may run only
with `NODE_ENV=development`, `PILOT_ALLOW_LLM=true`, and `--execute` after the
user explicitly approves provider cost and usage writes. The default command
remains read-only.

## Program-level verification

For every completed implementation phase, record:

1. failing test observed before production changes;
2. focused tests passing;
3. `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`;
4. required migration review/application and `npx drizzle-kit check`;
5. browser/production-like exercise where the phase changes user behavior;
6. documentation, environment-template, and security-review updates;
7. a conventional commit and integration verification on `main`.

## Current external handoffs

| Item | Needed from owner | Why it cannot be inferred |
| --- | --- | --- |
| Turnstile | Cloudflare token/account/domain approval | Widget creation and secret issuance are account mutations. |
| Mailing integration | provider selection, credentials, spend authority | Provider APIs can create billable mail. |
| Monitoring import | provider authorization and credentials | Credit-report access is regulated and account-bound. |
| Deployment | target platform and production secret store | Deployment/rollback changes external infrastructure. |
| LLM pilot execution | explicit development-only approval | It can incur cost and increment usage metrics. |
| Deprecated table removal | retention/backup/rollback approval | It is a destructive production-data migration. |
