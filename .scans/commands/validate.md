# Validation Command Specification

## 1. Purpose

This is the canonical validation specification for the Top Tier Financial Solutions repository. It documents the practical checks that give high confidence before handoff, release, or broad changes.

The spec is evidence-based:

- **Detected** commands and tooling come from `package.json`, `vitest.config.ts`, `playwright.config.ts`, `drizzle.config.ts`, `eslint.config.mjs`, `env.example`, `README.md`, `docs/SETUP_GUIDE.md`, `e2e/`, `src/__tests__/`, `db/`, `drizzle/`, `api/`, and `scripts/`.
- **Documented workflows** come primarily from `README.md` and `docs/SETUP_GUIDE.md`.
- **Inferred workflows** come from app routes, API routes, tests, schema, and utility scripts when the docs do not provide a step-by-step flow.

The goal is high confidence, not absolute certainty. Several workflows depend on live credentials, seeded data, admin authentication, Cloudflare R2, Neon PostgreSQL, AI providers, email providers, or Cal.com and cannot be fully validated safely in every local run.

## 2. Repository summary

- **Primary app:** Next.js 16 App Router application with React 19, TypeScript, Tailwind CSS v4, Framer Motion, and API routes.
- **Primary backend:** Next.js route handlers under `src/app/api/`.
- **Optional legacy backend:** Python FastAPI service under `api/`, started by `npm run fastapi-dev` and backed by `requirements.txt`.
- **Database:** Neon PostgreSQL with Drizzle ORM. Schema is in `db/schema.ts`; migrations are under `drizzle/`; Drizzle Kit is configured by `drizzle.config.ts`.
- **Auth:** Better Auth with user/session/account tables in the Drizzle schema.
- **Storage:** Cloudflare R2 through S3-compatible AWS SDK clients.
- **AI providers:** Google Gemini and OpenAI packages are installed; project docs state AI must render from deterministic policy inputs rather than decide policy.
- **Other integrations:** Cal.com public scheduling config, email providers, Upstash Redis for rate limiting, and Sentry for monitoring.
- **Test layers detected:**
  - Vitest + Testing Library unit/component/API/integration tests under `src/**/__tests__` and `src/**/*.{test,spec}.*`.
  - Playwright end-to-end tests under `e2e/`.
  - Integration verification scripts under `scripts/`, mostly credentialed.
- **Package manager/task runner:** npm scripts in `package.json`.

## 3. Validation phases

Run phases in the order below unless doing a quick targeted check. Earlier phases catch cheaper failures before slower test/build phases.

### Phase 1: Environment and dependency checks

**Why this exists**

Local setup is documented in `README.md` and `docs/SETUP_GUIDE.md`: install npm dependencies, copy `env.example` to `.env`, configure credentials, run migrations, then start the dev server.

**Detection evidence**

- `README.md` documents `npm install`, `cp env.example .env`, `npm run db:migrate`, `npm run dev`, and optional `npm run fastapi-dev`.
- `env.example` lists required and optional variables.
- `package.json` contains the npm scripts used below.

**Commands**

```bash
node --version
npm --version
npm install

test -f .env || cp env.example .env
```

For a non-mutating check that expected env names are still documented:

```bash
test -f env.example
grep -E '^(DATABASE_URL|ENCRYPTION_KEY|BETTER_AUTH_SECRET|NEXT_PUBLIC_APP_URL)=' env.example
```

**Pass criteria**

- Node and npm are available.
- Dependencies install successfully.
- `env.example` exists and includes the core expected variables.
- `.env` exists for local runs that require credentials.

**Notes/prerequisites**

- The repo does not include evidence of Docker or Compose, so Docker is not required by this spec.
- Do not commit real `.env` files or secrets.
- `npm install` is used because `package.json` documents npm commands and the repo contains npm scripts.

### Phase 2: Linting

**Why this exists**

ESLint catches JavaScript/TypeScript/React quality issues before tests and builds.

**Detection evidence**

- `package.json`: `"lint": "eslint"`.
- `eslint.config.mjs` exists.

**Command**

```bash
npm run lint
```

**Pass criteria**

- Command exits with status `0`.
- No ESLint errors remain.

### Phase 3: Python linting for optional FastAPI code

**Why this exists**

The repository includes an optional legacy Python FastAPI backend under `api/` and a Python lint script.

**Detection evidence**

- `api/index.py` defines a FastAPI app.
- `requirements.txt` includes FastAPI, uvicorn, SQLModel, and related packages.
- `package.json`: `"fastapi-dev": "./venv/bin/pip install -r requirements.txt && ./venv/bin/python3 -m uvicorn api.index:app --reload"`.
- `package.json`: `"lint:python": "./venv/bin/ruff check api/"`.

**Command**

Run only when a Python virtual environment exists or when validating Python-backed changes:

```bash
./venv/bin/pip install -r requirements.txt
npm run lint:python
```

**Pass criteria**

- Ruff exits with status `0`.

**Notes/prerequisites**

- This phase is optional for changes that do not touch `api/` because the main app backend is Next.js API routes.
- The command assumes `./venv/bin/python3`, `./venv/bin/pip`, and `./venv/bin/ruff` exist. If they do not, create a virtual environment first or skip with an explicit note.

### Phase 4: Type checking

**Why this exists**

The app is TypeScript-heavy and uses Next.js, React components, route handlers, database types, and domain logic.

**Detection evidence**

- `tsconfig.json` exists.
- `package.json`: `"typecheck": "tsc --noEmit"`.

**Command**

```bash
npm run typecheck
```

**Pass criteria**

- TypeScript exits with status `0`.

### Phase 5: Formatting/style checks

**Why this exists**

There is no detected Prettier, Biome, or other dedicated formatting script in `package.json`. The practical style gate is ESLint plus Git whitespace checking.

**Detection evidence**

- No dedicated `format` or `format:check` npm script was detected.
- Git can detect whitespace errors in the working diff.

**Command**

```bash
git diff --check
```

**Pass criteria**

- Command produces no whitespace error output and exits with status `0`.

**Notes/prerequisites**

- This only checks the working diff, not the entire repository.
- Do not invent a formatter command unless a formatter is added to the repo.

### Phase 6: Unit, component, API, and integration tests

**Why this exists**

The repo has broad Vitest coverage for components, hooks, API route handlers, parsers, proxy/auth behavior, admin workflows, portal behavior, and domain logic.

**Detection evidence**

- `package.json`: `"test": "vitest run"`, `"test:coverage": "vitest run --coverage"`, `"test:watch": "vitest"`.
- `vitest.config.ts` sets `environment: 'jsdom'`, uses `src/__tests__/setup.tsx`, and includes `src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`.
- `src/__tests__/` contains API, component, integration, parser, and library tests.

**Commands**

Standard test run:

```bash
npm run test
```

Optional coverage run:

```bash
npm run test:coverage
```

Focused tests for touched areas are encouraged before broad validation, for example:

```bash
npx vitest run src/components/admin/__tests__/WorkQueue.test.tsx
npx vitest run src/__tests__/integration/DisputeWizardFlow.test.tsx
```

**Pass criteria**

- Vitest exits with status `0`.
- Any skipped tests are intentional and understood.
- Expected audit logs on stdout are acceptable if assertions pass.
- React `act(...)`, unknown-prop, and unexpected `console.error`/`console.warn` noise should be treated as warnings to fix or explicitly justify.

### Phase 7: Build verification

**Why this exists**

Next.js production build validates route compilation, server/client boundaries, static generation, and production TypeScript checks.

**Detection evidence**

- `package.json`: `"build": "next build"`.
- `next.config.ts` exists.
- `README.md` recommends `npm run validate` before production release or major handoff.

**Command**

```bash
npm run build
```

**Pass criteria**

- Next.js production build exits with status `0`.
- App routes and API routes compile successfully.
- Static generation completes.

**Notes/prerequisites**

- Build is slower than lint/typecheck/tests and should be included in standard/full validation, especially before handoff.
- If build depends on environment variables in future changes, ensure `.env` is configured with safe non-production values.

### Phase 8: Database and migration validation

**Why this exists**

The documented setup requires migrations, and the application depends heavily on Drizzle schema and PostgreSQL data structures for auth, clients, disputes, billing, content, reports, and portal workflows.

**Detection evidence**

- `package.json`: `db:generate`, `db:migrate`, `db:repair-migrations`, `db:push`, and `db:studio` scripts.
- `drizzle.config.ts` uses `schema: './db/schema.ts'`, `out: './drizzle'`, and `DATABASE_URL`.
- `db/schema.ts` defines Better Auth and application tables.
- `drizzle/` contains generated SQL migrations.
- `scripts/test-connections.mjs`, `scripts/verify-all-integrations.mjs`, `scripts/verify-integrations.ts`, and `scripts/verify-system-integration.ts` exercise database/integration health with credentials.

**Commands**

For schema-change validation, generate migrations and inspect the diff before committing:

```bash
npm run db:generate
git diff -- db/schema.ts drizzle/
```

For a configured local or development database only:

```bash
npm run db:migrate
```

Credentialed operational smoke checks, run only against an approved non-production database:

```bash
node scripts/test-connections.mjs
node scripts/verify-all-integrations.mjs
npx tsx scripts/verify-integrations.ts
npx tsx scripts/verify-system-integration.ts
```

**Pass criteria**

- Generated migrations match intentional schema changes.
- `npm run db:migrate` completes against the chosen database.
- Credentialed verification scripts report database/Drizzle/Better Auth success and only acceptable optional-integration warnings.

**Notes/prerequisites**

- `DATABASE_URL` is required.
- These commands can modify or inspect real data. Use a disposable local/test/development database, not production.
- `npm run db:push` is intentionally not part of standard validation because it can push schema changes directly without migration review.
- Cleanup any test records created by manual validation.

### Phase 9: End-to-end workflow tests

**Why this exists**

E2E validation should reflect user-visible behavior. The repo currently has Playwright tests for the admin dispute wizard UI, validation states, error handling, accessibility, and performance checks.

**Detection evidence**

- `package.json`: `test:e2e`, `test:e2e:ui`, `test:e2e:debug`, and `test:e2e:headed`.
- `playwright.config.ts` uses `testDir: './e2e'`, launches `npm run dev`, and sets `baseURL: 'http://localhost:3000'`.
- `e2e/dispute-wizard.spec.ts` documents prerequisites: development server, test database with sample data, and admin authentication configured. It includes a skipped full authenticated flow pending auth helpers.

**Commands**

Local/headless:

```bash
npm run test:e2e
```

Debugging or visual review:

```bash
npm run test:e2e:headed
npm run test:e2e:ui
```

**Pass criteria**

- Playwright exits with status `0`.
- Browser projects pass or any skipped tests are intentional.
- The dispute wizard route renders and expected validation/error/accessibility behavior is observed.

**Notes/prerequisites**

- Requires a runnable dev server; Playwright starts one through config.
- Some tests may require admin auth and seeded data. The full authenticated wizard completion test is currently skipped in code.
- Do not treat passing E2E tests as full coverage of all public, admin, and portal workflows; current E2E coverage is narrower than the app surface.

### Phase 10: Optional legacy FastAPI smoke check

**Why this exists**

The repo still includes an optional FastAPI service, but docs identify Next.js API routes as the primary backend.

**Detection evidence**

- `README.md` says to start the optional legacy FastAPI service only when working on Python-backed flows.
- `api/index.py` exposes `/`, `/api/hello`, and `/docs` and includes routers under `/api/v1`.
- `package.json`: `fastapi-dev`.

**Commands**

In one terminal:

```bash
npm run fastapi-dev
```

In another terminal:

```bash
python - <<'PY'
import json, urllib.request
print(json.load(urllib.request.urlopen('http://127.0.0.1:8000/api/hello')))
PY
```

**Pass criteria**

- FastAPI starts successfully.
- `/api/hello` returns a JSON response with `message`.

**Notes/prerequisites**

- Requires Python dependencies and a configured FastAPI database environment.
- Only run this phase for changes touching `api/` or Python-backed flows.
- Stop the uvicorn process after validation.

### Phase 11: Security and configuration sanity checks

**Why this exists**

The product handles regulated credit repair workflows, authentication, PII, document uploads, billing gates, and AI-assisted dispute letters.

**Detection evidence**

- `README.md` lists PII encryption, admin permission checks, client-facing minimization, sanitized rendered HTML, CSP hardening, R2 storage, and rate limiting support.
- `env.example` includes auth, encryption, storage, AI, email, Cal.com, Upstash, and Sentry variables.
- `docs/SECURITY-REMEDIATION-PLAN.md` exists.

**Commands/checks**

```bash
git diff --check
git grep -n "sk-[A-Za-z0-9]\|BEGIN PRIVATE KEY\|R2_SECRET_ACCESS_KEY=.*[^\"]" -- ':!node_modules' ':!.next' || true
```

Manual review checklist for sensitive changes:

- New API routes enforce appropriate authentication and admin/client authorization boundaries.
- Client-facing responses do not leak unnecessary PII or internal operational metrics.
- Billing/payable logic remains gated by services-rendered and compliance rules.
- AI calls receive approved deterministic policy inputs only; they do not decide eligibility, claims, or facts.
- Upload/download changes preserve R2 access controls and do not expose arbitrary object keys.
- HTML rendering remains sanitized and CSP-compatible.
- Secrets are read from env/config and not committed.

**Pass criteria**

- No obvious committed secret material is present in the diff.
- Manual checklist is satisfied for touched sensitive areas.

**Notes/prerequisites**

- The grep command is a shallow safety net, not a full secret scanner.
- Use a dedicated secret scanning tool in CI if one is later added.

### Phase 12: Cleanup and teardown

**Why this exists**

Some validation modes start servers, create build artifacts, generate coverage reports, or touch databases.

**Commands/checks**

```bash
# Stop any foreground/background dev, FastAPI, Playwright UI, or Drizzle Studio processes started for validation.
# Inspect uncommitted files before committing:
git status --short
```

Optional local cleanup:

```bash
rm -rf coverage playwright-report test-results
```

**Pass criteria**

- No unintended generated files are left staged or modified.
- Any test data created in a live database or R2 bucket is removed.
- Long-running processes are stopped.

## 4. Workflow validation matrix

| Workflow | Status | Evidence source | Dependencies | Validation method | Success signal | Cleanup needed |
|---|---|---|---|---|---|---|
| Install and local Next.js development | Documented | `README.md` Local Setup; `docs/SETUP_GUIDE.md`; `package.json` | Node/npm, `.env`, database for data-backed routes | `npm install`, `npm run dev`; optionally visit public and admin routes | Dev server starts without compile errors | Stop dev server |
| Production build/release handoff | Documented | `README.md` Verification; `package.json` `validate` script | Node/npm, env values as required by build | `npm run validate` or standard mode below | Lint, typecheck, tests, and build pass | Inspect build artifacts/status |
| Database migration setup | Documented | `README.md`; `docs/SETUP_GUIDE.md`; `drizzle.config.ts` | `DATABASE_URL`, non-production PostgreSQL | `npm run db:migrate`; for schema changes, `npm run db:generate` and review `drizzle/` diff | Migration completes and generated SQL is intentional | Remove/reset test DB records if created |
| Public prospect site | Documented | `README.md` What The Platform Does; routes under `src/app` | Next.js app; optional Cal.com/env content | Unit/API tests plus manual route smoke for `/`, `/services`, `/blog`, `/faq`, `/contact`; Playwright coverage is currently limited | Pages render; forms/API routes behave as expected | Remove any test contact/newsletter records |
| Admin operations dashboard | Documented | `README.md` Admin Operations; routes under `src/app/admin`; admin API tests | Admin auth, database, seeded data for manual/E2E | Vitest admin API/component tests; manual authenticated smoke; Playwright dispute wizard tests | Admin routes load; protected actions enforce role checks; tests pass | Remove test clients/tasks/disputes |
| Credit report and dispute workflow | Documented | `README.md` Credit Report And Dispute Workflow; `e2e/dispute-wizard.spec.ts`; `src/__tests__/integration/DisputeWizardFlow.test.tsx` | Admin auth, database, sample client/report/items; optional AI/R2 for full flow | `npm run test`; `npm run test:e2e` where auth/data are configured; manual full flow for letter/submission paths | Wizard renders, validation works, deterministic policy tests pass, disputes can be created in test env | Delete generated disputes/letters/uploads |
| Client portal collaboration | Documented | `README.md` Client Collaboration Workspace; portal routes/API routes | Client auth, database, R2 for uploads | Vitest portal/API coverage plus manual authenticated smoke for `/portal`, agreement, documents, messages, audit report | Portal renders; client-visible data is scoped and minimized | Remove uploaded test docs/messages |
| Compliance and billing readiness | Documented | `README.md` Compliance And Billing; tests under admin/API areas | Database with service engagements, invoices, services-rendered records | `npm run test`; manual review of billing gate changes | Tests pass and payable/billing behavior remains gated by services rendered | Remove test invoices/events |
| Optional FastAPI backend | Documented as optional | `README.md`; `api/index.py`; `requirements.txt` | Python venv, requirements, database config | `npm run fastapi-dev`; request `/api/hello`; `npm run lint:python` if venv/ruff available | Health endpoint responds and Ruff passes | Stop uvicorn |
| External integration health | Inferred/gated | `env.example`; integration scripts under `scripts/` | Non-production credentials for Neon, R2, Better Auth settings, possibly AI/email | `node scripts/test-connections.mjs`, `node scripts/verify-all-integrations.mjs`, `npx tsx scripts/verify-integrations.ts`, `npx tsx scripts/verify-system-integration.ts` | Scripts report OK for configured integrations; optional missing integrations are understood | Remove created cloud/test resources if any |
| Full authenticated dispute wizard E2E completion | Inferred/incomplete | Skipped test in `e2e/dispute-wizard.spec.ts` with TODO for auth helpers | Admin auth helpers and seeded test data not yet implemented | Currently manual only; automate once auth fixtures exist | Dispute created and user-visible success observed | Delete created dispute/test data |

## 5. Gaps and risk notes

- **No existing canonical validation spec was detected before this file.** This file is the source of truth going forward.
- **E2E coverage is limited.** Playwright exists, but the current E2E suite focuses on the admin dispute wizard and contains skipped/TODO tests for complete authenticated flows.
- **Credentials gate full validation.** Database migrations, R2 bucket checks, AI generation, email delivery, Cal.com behavior, Upstash rate limiting, and Sentry behavior need non-production credentials or must be manually reviewed/mocked.
- **Live side effects are possible.** Migration and integration scripts can inspect or modify real services if pointed at production. Use test/development resources only.
- **No dedicated formatter was detected.** Style validation is ESLint plus `git diff --check` unless a formatter is later added.
- **No Docker/Compose evidence was found.** Do not require Docker for validation unless the repo adds it.
- **Python backend is optional.** The primary backend is Next.js API routes; validate FastAPI only for Python-backed changes or release checks that include legacy service support.
- **Security checks are partly manual.** Current automated commands do not prove PII minimization, authorization correctness, billing compliance, or AI-boundary safety across every path.
- **Seed data requirements are not fully standardized.** Some manual and E2E checks require admin/client accounts and sample credit report data; create these only in a disposable test environment.

## 6. Execution modes

### Quick mode: fast local confidence for small changes

Use for focused changes before broader validation.

```bash
git diff --check
npm run lint
npm run typecheck
npm run test
```

If the touched area has a known test file, prefer a focused Vitest command first, for example:

```bash
npx vitest run path/to/touched.test.tsx
```

### Standard mode: default developer validation

This mirrors the repository's documented validation script and is appropriate before handoff of most changes.

```bash
git diff --check
npm run lint
npm run typecheck
npm run test
npm run build
```

Equivalent project script for the core checks except `git diff --check`:

```bash
npm run validate
```

### Full mode: broad release or risky-change validation

Use before release, after schema changes, after auth/security/billing/AI changes, or when touching cross-cutting workflows.

```bash
git diff --check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Add database checks only against non-production resources:

```bash
npm run db:generate
git diff -- db/schema.ts drizzle/
npm run db:migrate
node scripts/test-connections.mjs
```

For optional Python/FastAPI changes:

```bash
./venv/bin/pip install -r requirements.txt
npm run lint:python
npm run fastapi-dev
```

### CI mode: deterministic non-interactive core validation

No CI workflow file was detected, but if one is added, the safe baseline should be:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

Recommended CI additions when credentials/fixtures are available:

```bash
npm run test:e2e
npm run test:coverage
```

Use CI secrets and disposable databases/buckets for any credentialed integration verification. Never run migration or cloud integration scripts against production from CI unless explicitly designed as a production deployment gate.
