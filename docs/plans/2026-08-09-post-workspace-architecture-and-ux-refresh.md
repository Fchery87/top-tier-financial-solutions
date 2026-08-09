# Post-Workspace Architecture and UX Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce regression risk in the post-workspace application by replacing its largest volatile modules with deep, deterministic seams and finishing targeted workspace UX and test-reliability improvements.

**Architecture:** Preserve domain decisions at their existing deterministic sources, then place small interfaces in front of variable rendering, parsing, persistence, and presentation implementations. Each module's tests cross its public seam; route handlers and UI callers stop reimplementing policy, validation, or normalization. This plan deliberately does not repeat the completed workspace wizard hook extraction or reopen the pending custom-role authorization decision.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Vitest, Playwright, Drizzle/Neon Postgres, FastAPI/Pydantic.

---

## Status and plan reconciliation

- This is the active Phase 5 execution plan for the Remaining Work Completion Program.
- `thermo-nuclear-code-quality-implementation-plan.md` and `ui-ux-overhaul-roadmap.md` are historical audit records. They contain obsolete `src/components/admin` and `/api/admin` targets and must not be implemented directly.
- Preserve completed workspace wizard local-hook work under `src/components/workspace/dispute-wizard/`; do not schedule a second wizard extraction.
- Execute the slices in the order below. Each task is independently shippable and receives its own branch, migration review where applicable, and full repository verification before integration.

## Completion rules for every task

1. Start from a clean, current integration baseline in a dedicated worktree.
2. Use `superpowers:test-driven-development`: write the focused failing test first, observe its failure, then implement the smallest change that passes it.
3. Run `npm run typecheck`, `npm run lint`, focused Vitest suites, `npm run test`, and the configured production build. For FastAPI work, also run its targeted Python test/lint command if present.
4. Preserve safe failure behavior: no fabricated credit facts, no silent parser coercion, no PII/prompt/letter text in logs, and no privilege expansion.
5. Commit a single, conventional, reviewable slice; integration verification is separate evidence, not implied by feature-branch success.

## Task 1: Lock current contracts before structural work

**Files:**
- Create: `docs/architecture/2026-08-09-post-workspace-seam-inventory.md`
- Create: `src/__tests__/architecture/post-workspace-module-contracts.test.ts`
- Modify: `docs/plans/2026-08-09-remaining-work-completion-program.md`
- Test: `src/__tests__/architecture/post-workspace-module-contracts.test.ts`

**Step 1: Write the failing contract test.**

Assert the workspace route root exists, the retired physical `src/app/api/admin` route tree does not exist, the Letter Studio’s state endpoint remains under `/api/workspace`, and the current letter/parser entry modules export the documented public functions.

**Step 2: Run the test to verify the current expectation that needs protection.**

Run: `npx vitest run src/__tests__/architecture/post-workspace-module-contracts.test.ts`

Expected: FAIL until the contract inventory and explicit exports are made testable.

**Step 3: Add the smallest contract inventory.**

Document only stable caller-facing interfaces, invariants, and allowed compatibility locations. Do not add broad source-text scans; use direct imports and the filesystem only for the namespace migration invariant.

**Step 4: Re-run the focused test.**

Run: `npx vitest run src/__tests__/architecture/post-workspace-module-contracts.test.ts`

Expected: PASS.

**Step 5: Commit.**

```bash
git add docs/architecture/2026-08-09-post-workspace-seam-inventory.md src/__tests__/architecture/post-workspace-module-contracts.test.ts docs/plans/2026-08-09-remaining-work-completion-program.md
git commit -m "test: lock post-workspace module contracts"
```

## Task 2: Make dispute-letter rendering deterministic

**Files:**
- Create: `src/lib/letter-rendering/types.ts`
- Create: `src/lib/letter-rendering/render-dispute-letter.ts`
- Create: `src/lib/letter-rendering/build-letter-prompt.ts`
- Create: `src/lib/letter-rendering/provider-adapter.ts`
- Create: `src/lib/letter-rendering/__tests__/render-dispute-letter.test.ts`
- Create: `src/lib/letter-rendering/__tests__/build-letter-prompt.test.ts`
- Modify: `src/lib/ai-letter-generator.ts`
- Modify: `src/app/api/workspace/disputes/generate-letter/route.ts`
- Test: `src/__tests__/lib/dispute-draft-generator.test.ts`
- Test: `src/__tests__/api/workspace/dispute-letter-generation.test.ts`

**Step 1: Write failing renderer tests.**

Define a single `LetterRenderInput` that contains already-approved policy/evidence facts. Test that the deterministic renderer produces the same template substitutions and omissions for identical input, that no source value is invented, and that a provider result cannot change policy decisions.

**Step 2: Run the renderer tests.**

Run: `npx vitest run src/lib/letter-rendering/__tests__/render-dispute-letter.test.ts src/lib/letter-rendering/__tests__/build-letter-prompt.test.ts`

Expected: FAIL because the seam does not yet exist.

**Step 3: Implement the small interfaces.**

Keep `renderDisputeLetter(input)` deterministic. Keep `buildLetterPrompt(renderedLetter, context)` as a projection of approved facts only. Make the LLM adapter accept the completed prompt and return untrusted draft text; it must not receive database access or decide recipient, round, methodology, legal citations, lint context, or escalation eligibility.

**Step 4: Move callers incrementally.**

Turn `ai-letter-generator.ts` into the composition root and leave its public behavior intact. Change the workspace route handler to validate/authenticate, call the existing policy workflow, invoke the renderer composition, and persist only after existing lint/policy gates pass.

**Step 5: Run focused regression tests.**

Run: `npx vitest run src/lib/letter-rendering/__tests__/render-dispute-letter.test.ts src/lib/letter-rendering/__tests__/build-letter-prompt.test.ts src/__tests__/lib/dispute-draft-generator.test.ts src/__tests__/api/workspace/dispute-letter-generation.test.ts src/__tests__/api/workspace/dispute-draft-generation.test.ts`

Expected: PASS, including the existing fail-closed policy case.

**Step 6: Commit.**

```bash
git add src/lib/letter-rendering src/lib/ai-letter-generator.ts src/app/api/workspace/disputes/generate-letter/route.ts src/__tests__/lib/dispute-draft-generator.test.ts src/__tests__/api/workspace/dispute-letter-generation.test.ts src/__tests__/api/workspace/dispute-draft-generation.test.ts
git commit -m "refactor: isolate deterministic letter rendering"
```

## Task 3: Normalize parser and credit-analysis report seams

**Files:**
- Create: `src/lib/credit-report-normalization/types.ts`
- Create: `src/lib/credit-report-normalization/normalize-report.ts`
- Create: `src/lib/credit-report-normalization/__tests__/normalize-report.test.ts`
- Create: `src/lib/credit-analysis-report/assemble-report.ts`
- Create: `src/lib/credit-analysis-report/__tests__/assemble-report.test.ts`
- Modify: `src/lib/parsers/identityiq-parser.ts`
- Modify: `src/lib/credit-analysis.ts`
- Modify: `src/lib/credit-analysis-report.ts`
- Test: `src/lib/parsers/__tests__/identityiq-parser.test.ts`
- Test: `src/lib/parsers/__tests__/source-routing.test.ts`

**Step 1: Write normalization failures from real fixtures.**

Choose one IdentityIQ fixture and one generic/fallback fixture. Assert a normalized report has stable bureau/account identifiers, explicit absence rather than inferred values, source provenance, and validation errors for unsupported or contradictory fields.

**Step 2: Run the focused tests.**

Run: `npx vitest run src/lib/credit-report-normalization/__tests__/normalize-report.test.ts src/lib/parsers/__tests__/identityiq-parser.test.ts src/lib/parsers/__tests__/source-routing.test.ts`

Expected: FAIL until the normalization module exists.

**Step 3: Introduce the normalization module.**

Use `normalizeCreditReport(parsed, source)` as the seam. Parsers remain source adapters; report/domain consumers receive the normalized model and its explicit warnings. Do not make a universal parser framework or change parser routing in this slice.

**Step 4: Extract report assembly.**

Use `assembleCreditAnalysisReport(input)` as a pure module that produces a client-safe report model from normalized facts and deterministic analysis output. Keep persistence, HTTP, and presentation outside this module.

**Step 5: Run focused regression tests.**

Run: `npx vitest run src/lib/credit-report-normalization/__tests__/normalize-report.test.ts src/lib/credit-analysis-report/__tests__/assemble-report.test.ts src/lib/parsers/__tests__/identityiq-parser.test.ts src/lib/parsers/__tests__/source-routing.test.ts src/lib/__tests__/credit-analysis-account-presence.test.ts src/lib/__tests__/credit-analysis-discrepancies.test.ts`

Expected: PASS, with existing source metadata and bureau-presence behavior unchanged.

**Step 6: Commit.**

```bash
git add src/lib/credit-report-normalization src/lib/credit-analysis-report src/lib/parsers/identityiq-parser.ts src/lib/credit-analysis.ts src/lib/credit-analysis-report.ts src/lib/parsers/__tests__ src/lib/__tests__/credit-analysis-account-presence.test.ts src/lib/__tests__/credit-analysis-discrepancies.test.ts
git commit -m "refactor: normalize credit reports before analysis"
```

## Task 4: Split FastAPI content modules by domain seam

> **Implementation correction (2026-08-09):** The FastAPI entrypoint is `api/index.py`, not `api/main.py`. This repository has no existing Python tests, test configuration, virtual environment, or database fixture convention. Establish the isolated test harness below before moving code; do not exercise a developer or shared database while characterizing content routes.

**Files:**
- Create: `api/tests/conftest.py`
- Create: `api/schemas/content.py`
- Create: `api/services/content.py`
- Create: `api/routers/content_admin.py`
- Create: `api/routers/content_public.py`
- Create: `api/tests/test_content_admin.py`
- Create: `api/tests/test_content_public.py`
- Modify: `requirements.txt`
- Modify: `api/routers/admin_content.py`
- Modify: `api/routers/public.py`
- Modify: `api/index.py`

**Step 1: Establish the isolated FastAPI test harness.**

Add `pytest`, `ruff`, and `httpx` to the project test/tool dependencies and create `api/tests/conftest.py`. Before importing `api.index`, configure `DATABASE_URL` to a per-test temporary SQLite database. Provide an in-process HTTPX ASGI fixture that creates tables, clears dependency overrides after each test, and never reads `.env` database configuration. Override the synchronous session dependency with an async generator only inside tests, because this host cannot execute AnyIO threadpool dependencies; use real authentication tokens for authorized administrative cases and leave authentication itself unmodified for the unauthorized case.

**Step 2: Characterize current public and administrative content responses.**

Write tests for list/detail response shapes, validation failures, draft/public visibility, and authorization failures. Keep the fixtures local to `api/tests`; do not add a second application factory or a production-only test switch.

**Step 3: Run the characterization tests against the pre-extraction implementation.**

Run: `./venv/bin/python -m pytest api/tests/test_content_admin.py api/tests/test_content_public.py -q`

Expected: the characterization cases pass against the old implementation before any move; add a deliberately missing schema assertion that fails before the schema module exists.

**Step 4: Extract a small content interface.**

Put request/response validation in `api/schemas/content.py`; put shared visibility and persistence behavior behind a single content module interface in `api/services/content.py`; leave routers as thin authentication/transport adapters. Do not mix leads, auth, or unrelated public site routes into this task.

**Step 5: Keep import and route compatibility explicit.**

Register the replacement routers in `api/index.py`; retain only compatibility re-exports needed by internal imports until tests prove no callers remain. Do not silently change URL paths or response envelopes.

**Step 6: Run focused tests.**

Run: `./venv/bin/python -m pytest api/tests/test_content_admin.py api/tests/test_content_public.py -q`

Expected: PASS.

**Step 7: Commit.**

```bash
git add requirements.txt api/tests/conftest.py api/schemas/content.py api/services/content.py api/routers/content_admin.py api/routers/content_public.py api/routers/admin_content.py api/routers/public.py api/index.py api/tests/test_content_admin.py api/tests/test_content_public.py
git commit -m "refactor: split FastAPI content domain modules"
```

## Task 5: Deepen client-record workspace data and presentation seams

**Files:**
- Create: `src/lib/workspace-client-record.ts`
- Create: `src/lib/__tests__/workspace-client-record.test.ts`
- Create: `src/components/workspace/client-detail/hooks/useClientRecord.ts`
- Create: `src/components/workspace/client-detail/__tests__/useClientRecord.test.tsx`
- Modify: `src/components/workspace/disputes/DisputeDetailPanel.tsx`
- Modify: `src/components/workspace/client-detail/OverviewTab.tsx`
- Modify: `src/app/workspace/clients/[id]/page.tsx`
- Test: `src/__tests__/app/workspace-disputes-page.test.tsx`

**Step 1: Write failing record-model tests.**

Test a compact `buildWorkspaceClientRecord(input)` interface: it derives display-safe identity, actionable work, compliance state, and linked-record counts without fetching or rendering. Include null names, missing optional records, and an immutable response-review state.

**Step 2: Run the test.**

Run: `npx vitest run src/lib/__tests__/workspace-client-record.test.ts src/components/workspace/client-detail/__tests__/useClientRecord.test.tsx`

Expected: FAIL until the shared model and hook exist.

**Step 3: Implement the record model and query hook.**

The model is pure. `useClientRecord(id)` owns loading, request cancellation, retry/error state, and mutation refresh. Presentation modules receive view data and callbacks rather than reassembling record state or issuing duplicate fetches.

**Step 4: Apply only targeted responsive UX changes.**

Use the new hook in the client overview and dispute detail flow. Preserve current user-visible data, keyboard behavior, and server-authoritative immutable states. Verify narrow layouts with existing responsive test helpers or a focused Playwright spec; do not undertake a global redesign.

**Step 5: Run focused regression tests.**

Run: `npx vitest run src/lib/__tests__/workspace-client-record.test.ts src/components/workspace/client-detail/__tests__/useClientRecord.test.tsx src/components/workspace/disputes/__tests__/DisputeDetailPanel.test.tsx src/__tests__/app/workspace-disputes-page.test.tsx`

Expected: PASS.

**Step 6: Commit.**

```bash
git add src/lib/workspace-client-record.ts src/lib/__tests__/workspace-client-record.test.ts src/components/workspace/client-detail src/components/workspace/disputes/DisputeDetailPanel.tsx src/app/workspace/clients/[id]/page.tsx src/__tests__/app/workspace-disputes-page.test.tsx
git commit -m "refactor: centralize workspace client record state"
```

## Task 6: Establish a reproducible test-maintenance fast lane

**Files:**
- Create: `scripts/test-fast-lane.mjs`
- Create: `src/__tests__/test-fast-lane.test.ts`
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Modify: `docs/testing.md`

**Step 1: Write a failing configuration test.**

Assert the fast lane runs deterministic unit/library tests and focused route/component contracts, excludes only the two known serial suites by explicit file path, and never hides a failure by retrying it.

**Step 2: Run the test.**

Run: `npx vitest run src/__tests__/test-fast-lane.test.ts`

Expected: FAIL before the script/config contract exists.

**Step 3: Implement the fast lane.**

Add `npm run test:fast` as a transparent, documented orchestrator. Keep `npm run test` as the full required suite; do not lower worker limits globally or silently skip suites. Record why serialization is required and a removal condition for each exception.

**Step 4: Run validation.**

Run: `npm run test:fast`

Expected: PASS with a clear list of executed shards/suites.

**Step 5: Run the full suite and build as integration evidence.**

Run: `npm run test && BETTER_AUTH_SECRET=<local-non-default-secret> RATE_LIMIT_DISABLED=true npm run build`

Expected: PASS. Never commit the environment values; when host execution is time-limited, capture the real terminal output as the acceptance record.

**Step 6: Commit.**

```bash
git add scripts/test-fast-lane.mjs src/__tests__/test-fast-lane.test.ts package.json vitest.config.ts docs/testing.md
git commit -m "test: add transparent fast validation lane"
```

## Final Phase 5 integration checklist

1. Merge reviewed task branches into `integration/remaining-program` in task order.
2. Run `git diff --check`, `npm run typecheck`, `npm run lint`, `npm run test`, `npx drizzle-kit check`, and the production build with safe local-only environment values.
3. Run focused Playwright checks for Letter Studio, client record, and responsive workspace behavior.
4. Re-run the strict architecture audit; close only findings actually addressed and create a new plan for any remaining significant module.
5. Update `2026-08-09-remaining-work-completion-program.md` with real validation evidence and commit the integration result.
