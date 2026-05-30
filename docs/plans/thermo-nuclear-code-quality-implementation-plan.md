# Thermo-Nuclear Code Quality Implementation Plan

Status: Draft  
Created: 2026-05-29  
Scope: Maintainability remediation plan for the executive-summary findings from the strict code quality review.

## Purpose

This plan converts the thermo-nuclear maintainability review into an implementation sequence. The goal is not to rewrite the app. The goal is to reduce regression risk by extracting stable seams around the most volatile, compliance-sensitive workflows:

1. Dispute wizard orchestration
2. AI-assisted letter generation
3. Credit report parsing
4. Admin API route handlers
5. Admin CRUD page patterns
6. Database schema organization
7. Report generation
8. Test maintainability

## Guiding principles

- Preserve behavior first; refactor behind tests.
- Keep compliance decisions deterministic and testable.
- Keep LLMs as renderers only; never let prompt-building code decide eligibility, reason codes, evidence requirements, billing readiness, lifecycle transitions, or escalation paths.
- Prefer small service extractions over sweeping rewrites.
- Introduce shared abstractions only after at least two real call sites prove the shape.
- Keep each milestone independently shippable.
- Run `npm run lint`, `npm run typecheck`, `npm test -- --run`, and `npm run build` before closing each phase.

## Current verification baseline

At the time of review, the project passed:

- `npm run lint`
- `npm run typecheck`
- `npm test -- --run`
- `npm run build`

This plan assumes the baseline should remain green after each slice.

---

# Phase 0 — Safety harness and refactor boundaries

## Objective

Prepare the codebase for behavior-preserving refactors by adding explicit characterization coverage and documenting module boundaries before moving code.

## Target files

- `src/components/admin/dispute-wizard/WizardContext.tsx`
- `src/lib/ai-letter-generator.ts`
- `src/app/api/admin/disputes/route.ts`
- `src/app/api/admin/disputes/[id]/route.ts`
- `src/lib/parsers/identityiq-parser.ts`
- `src/lib/parsers/*-parser.ts`

## Tasks

### 0.1 Add a refactor tracking checklist

Create a short tracker in `docs/plans/` or extend this document with completion status for each phase.

Acceptance criteria:

- Each phase has status: Not started, In progress, Blocked, Complete.
- Each phase lists validation commands.
- Each risky extraction has an explicit rollback note.

### 0.2 Add characterization tests for wizard letter generation

Before extracting `generateLetters`, capture current behavior with tests around:

- no selected client exits safely
- AI generation uses analysis summary reason codes when present
- selected negative items are included in generated payload
- personal information and inquiry dispute selections are included correctly
- combined-vs-per-item generation behavior remains stable
- failures surface user-visible errors instead of only logging

Recommended location:

```text
src/components/admin/dispute-wizard/__tests__/letter-generation.behavior.test.tsx
```

Acceptance criteria:

- Tests fail if generated payload shape changes unexpectedly.
- Tests do not depend on CSS selectors.
- API calls are mocked at the network boundary only.

### 0.3 Add characterization tests for AI letter generation templates

Add tests that assert the current prompt rendering and fallback rendering behavior.

Recommended location:

```text
src/lib/letter-generation/__tests__/characterization.test.ts
```

If the module has not been split yet, tests may temporarily target `src/lib/ai-letter-generator.ts`.

Acceptance criteria:

- Tests cover required placeholder replacement.
- Tests cover missing methodology/prompt fallback behavior.
- Tests cover provider-independent generation behavior by mocking LLM calls.

### 0.4 Add route-handler characterization tests for dispute create/update

Existing tests already cover many dispute routes. Before extraction, identify missing route behavior around:

- auth failure response shape
- validation failure response shape
- compliance gate failure response shape
- successful dispute creation response shape
- update lifecycle transition behavior

Acceptance criteria:

- Current behavior is locked before route helpers are introduced.
- Tests assert response envelopes consistently enough to detect drift.

## Validation

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

---

# Phase 1 — Extract dispute wizard letter generation

## Objective

Reduce the blast radius of `src/components/admin/dispute-wizard/WizardContext.tsx` by extracting letter-generation orchestration into a typed hook/service.

## Problem summary

`WizardContext.tsx` is a god-context of roughly 1,025 lines with many unrelated state domains. Its `generateLetters` flow begins around `src/components/admin/dispute-wizard/WizardContext.tsx:660` and mixes UI state, validation, API payload construction, progress tracking, and response assembly.

## Proposed structure

```text
src/components/admin/dispute-wizard/
  WizardContext.tsx
  hooks/
    useLetterGeneration.ts
  services/
    buildLetterGenerationPayload.ts
    normalizeGeneratedLetters.ts
    validateLetterGenerationInputs.ts
  types/
    letter-generation.ts
```

## Tasks

### 1.1 Define letter-generation input/output types

Create typed interfaces for:

- selected client summary
- selected negative item dispute input
- personal information dispute input
- inquiry dispute input
- AI analysis summary input
- methodology/generation settings
- letter generation request payload
- normalized generated letter result

Acceptance criteria:

- No business logic is moved yet.
- Types compile independently.
- Existing `WizardContext` can import these types without circular dependencies.

### 1.2 Extract payload construction

Move selected item filtering and payload shaping from `generateLetters` into:

```ts
buildLetterGenerationPayload(input): LetterGenerationPayload
```

Acceptance criteria:

- Function is pure.
- Function has unit tests.
- Function does not call `fetch`.
- Function does not read React state directly.

### 1.3 Extract generation input validation

Move pre-generation checks into:

```ts
validateLetterGenerationInputs(input): ValidationResult
```

Acceptance criteria:

- Validation returns typed errors/warnings.
- Validation does not mutate state.
- Wizard UI maps typed errors to display messages.

### 1.4 Extract API orchestration into `useLetterGeneration`

Create a hook that owns:

- generation progress
- generated letters
- generation errors
- request lifecycle

The hook should receive stable input objects from `WizardContext`.

Acceptance criteria:

- `WizardContext.tsx` line count decreases materially.
- `WizardContext` no longer directly constructs the letter-generation API payload.
- Existing wizard behavior tests remain green.

### 1.5 Remove direct fetch duplication from wizard generation path

If practical, route the hook through a shared `apiFetch` helper introduced in Phase 4. If Phase 4 has not happened yet, leave a narrow wrapper to ease future migration.

Acceptance criteria:

- Errors are surfaced consistently.
- No silent `console.error`-only failure path for letter generation.

## Validation

```bash
npm run lint
npm run typecheck
npm test -- --run src/components/admin/dispute-wizard
npm test -- --run
npm run build
```

## Rollback strategy

Keep the old `generateLetters` implementation intact until the extracted hook is fully covered and wired. Remove old code only after tests pass.

---

# Phase 2 — Split AI letter generation into deterministic renderer modules

## Objective

Break `src/lib/ai-letter-generator.ts` into small modules with explicit boundaries between deterministic policy inputs, prompt rendering, fallback rendering, provider calls, and post-processing.

## Problem summary

`src/lib/ai-letter-generator.ts` is roughly 1,713 lines and mixes provider dispatch, prompt construction, methodology rendering, fallback construction, and post-processing. This is compliance-sensitive because letter language must be generated only from approved deterministic inputs.

## Proposed structure

```text
src/lib/letter-generation/
  index.ts
  types.ts
  llm-provider.ts
  prompt-builder.ts
  prompt-template-renderer.ts
  template-placeholder-validator.ts
  fallback-letter-renderer.ts
  letter-post-processor.ts
  multi-item-letter-generator.ts
  methodology-loader.ts
```

Keep a compatibility export from `src/lib/ai-letter-generator.ts` during migration.

## Tasks

### 2.1 Extract provider dispatch

Move provider-specific API calls into:

```ts
callLLMProvider(config, prompt): Promise<string>
```

Acceptance criteria:

- Google, OpenAI, Anthropic, and Zhipu branches are preserved.
- Provider tests mock SDK clients.
- No prompt construction logic remains in provider code.

### 2.2 Extract template rendering

Create a renderer that performs placeholder replacement from a typed data object.

Acceptance criteria:

- Renderer takes `template` and `values`.
- Renderer returns rendered text plus unresolved placeholder diagnostics.
- No chained ad-hoc `.replace()` calls remain in the high-level generator.

### 2.3 Add strict placeholder validation

Create:

```ts
validateRequiredPlaceholders(template, requiredPlaceholders): PlaceholderValidationResult
```

Acceptance criteria:

- Missing required placeholders fail closed.
- Tests prove required compliance placeholders cannot be silently omitted.
- Optional placeholders are documented.

### 2.4 Extract fallback renderer

Move fallback letter construction into a deterministic renderer module.

Acceptance criteria:

- Fallback rendering receives the same approved input model as prompt rendering.
- Fallback renderer has unit tests.
- Fallback logic does not select reason codes or infer eligibility.

### 2.5 Extract post-processing

Move cleanup and formatting into:

```ts
postProcessLetter(rawText, options): string
```

Acceptance criteria:

- Post-processing is pure.
- Tests cover trimming, formatting, and preservation of required sections.

### 2.6 Replace compatibility wrapper internals

Make `src/lib/ai-letter-generator.ts` a thin compatibility wrapper that imports from `src/lib/letter-generation`.

Acceptance criteria:

- Existing imports continue to work.
- New code imports from `src/lib/letter-generation`.
- File size of `ai-letter-generator.ts` drops substantially.

## Validation

```bash
npm run lint
npm run typecheck
npm test -- --run src/lib
npm test -- --run
npm run build
```

## Rollback strategy

Retain the original implementation in git history. Migrate one exported function at a time and preserve public function signatures until all call sites are updated.

---

# Phase 3 — Introduce shared admin API route infrastructure

## Objective

Stop duplicating auth, validation, error envelopes, and response shaping across large Next.js API route handlers.

## Problem summary

Routes such as `src/app/api/admin/disputes/route.ts` and `src/app/api/admin/disputes/[id]/route.ts` mix auth, validation, compliance checks, DB operations, serialization, and audit behavior. Local admin validation differs route by route, creating drift risk.

## Proposed structure

```text
src/lib/api/
  api-error.ts
  api-response.ts
  parse-json-body.ts
  require-admin.ts
  with-admin-route.ts
  validation.ts

src/lib/services/disputes/
  createDispute.ts
  updateDispute.ts
  getDispute.ts
  disputePolicyChecks.ts
  disputeSerializers.ts
```

## Tasks

### 3.1 Define a standard API error envelope

Use one response shape:

```ts
export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

Acceptance criteria:

- Helper functions produce all error responses.
- Existing tests are updated intentionally where response shape changes are accepted.
- If response shape cannot change yet, helpers support a compatibility mode.

### 3.2 Create `requireAdmin` and `requireSuperAdmin`

Centralize admin authentication and permission checks.

Acceptance criteria:

- No route-local `validateAdmin` helper remains in migrated routes.
- Unauthorized and forbidden responses are consistent.
- Tests cover both failure modes.

### 3.3 Create `parseJsonBody`

Centralize request JSON parsing and validation.

Acceptance criteria:

- Invalid JSON produces a typed error.
- Schema validation failure produces a typed error with safe details.
- Route handlers no longer manually destructure unvalidated request bodies.

### 3.4 Migrate `src/app/api/admin/disputes/route.ts`

Move business behavior into `disputeService.createDispute`.

Acceptance criteria:

- Route handler becomes mostly HTTP adaptation.
- Existing dispute creation tests pass.
- Compliance checks are service-level tests, not only route-level tests.

### 3.5 Migrate `src/app/api/admin/disputes/[id]/route.ts`

Move update/read behavior into service modules.

Acceptance criteria:

- Route handler becomes mostly HTTP adaptation.
- Existing dispute update tests pass.
- Lifecycle transition policy is testable without constructing HTTP requests.

### 3.6 Migrate additional high-value routes

Prioritize:

- `src/app/api/admin/disputes/generate-letter/route.ts`
- `src/app/api/admin/disputes/insights/route.ts`
- `src/app/api/admin/clients/[id]/route.ts`
- `src/app/api/admin/clients/[id]/audit-report/route.ts`

Acceptance criteria:

- Each migrated route uses shared helpers.
- Error behavior is documented.

## Validation

```bash
npm run lint
npm run typecheck
npm test -- --run src/__tests__/api/admin
npm test -- --run
npm run build
```

## Rollback strategy

Migrate one route at a time. Keep old inline logic in place until service-level tests exist for that route.

---

# Phase 4 — Add a frontend admin data-access layer

## Objective

Reduce repeated client-side CRUD state machines across admin pages.

## Problem summary

Admin pages such as `src/app/admin/agreements/page.tsx`, `src/app/admin/messages/page.tsx`, `src/app/admin/dispute-templates/page.tsx`, and content pages repeat local loading/error/fetch/modal/delete/form state.

## Proposed structure

```text
src/lib/api-client/
  apiFetch.ts
  adminResources.ts
  errors.ts

src/hooks/admin/
  useAdminResource.ts
  useAdminMutation.ts

src/components/admin/resource/
  AdminResourcePage.tsx
  AdminResourceTable.tsx
  ResourceFormModal.tsx
  DeleteConfirmDialog.tsx
```

## Tasks

### 4.1 Create `apiFetch`

Add a small typed wrapper around `fetch`.

Acceptance criteria:

- Handles JSON parsing.
- Throws typed API errors.
- Handles non-JSON error responses safely.
- Supports request cancellation where useful.

### 4.2 Introduce `useAdminResource`

Create a hook for list/loading/error/refetch patterns.

Acceptance criteria:

- At least two admin pages can use it without special-case hacks.
- Loading and error behavior is consistent.

### 4.3 Introduce mutation helpers

Create helpers for create/update/delete flows.

Acceptance criteria:

- Common success/error behavior is centralized.
- Delete confirmation behavior remains explicit in UI.

### 4.4 Migrate two lower-risk admin pages first

Suggested first candidates:

- `src/app/admin/disclaimers/page.tsx`
- `src/app/admin/testimonials/page.tsx`

Acceptance criteria:

- Page behavior is preserved.
- Page line count drops materially.
- Reusable primitives are not overfit to one page.

### 4.5 Migrate larger admin pages

After primitives stabilize, migrate:

- `src/app/admin/agreements/page.tsx`
- `src/app/admin/dispute-templates/page.tsx`
- `src/app/admin/email-templates/page.tsx`
- `src/app/admin/messages/page.tsx`

Acceptance criteria:

- No page-local duplicate CRUD boilerplate unless justified.
- Messages page still handles its conversation-specific behavior separately.

## Validation

```bash
npm run lint
npm run typecheck
npm test -- --run src/__tests__/components/admin
npm test -- --run
npm run build
```

## Rollback strategy

Migrate one page at a time. Do not introduce a generic mega-component that obscures resource-specific behavior.

---

# Phase 5 — Refactor credit parser architecture

## Objective

Reduce duplicated parsing and normalization logic across vendor-specific credit report parsers.

## Problem summary

Parser files repeat source detection, score extraction, identity extraction, account extraction, inquiry extraction, negative-item derivation, summary calculation, and normalization. `identityiq-parser.ts` is the largest and most condition-heavy parser.

## Proposed structure

```text
src/lib/parsers/
  registry.ts
  types.ts
  shared/
    normalizeBureau.ts
    parseMoney.ts
    parseDate.ts
    normalizeAccountStatus.ts
    extractInquiriesFromText.ts
    calculateSummary.ts
    buildNegativeItems.ts
    parserDiagnostics.ts
  vendors/
    identityiq.ts
    experian.ts
    equifax.ts
    transunion.ts
    myscoreiq.ts
    smartcredit.ts
    privacyguard.ts
    annualcreditreport.ts
```

## Tasks

### 5.1 Define parser interface

Create:

```ts
export interface CreditReportParser {
  source: CreditReportSource;
  detect(input: RawCreditReport): boolean;
  parse(input: RawCreditReport): ParsedCreditReport;
}
```

Acceptance criteria:

- Existing parser outputs can be represented by this interface.
- No behavior is changed yet.

### 5.2 Extract normalization utilities

Start with the least risky common utilities:

- bureau normalization
- date parsing
- money parsing
- account status normalization

Acceptance criteria:

- Utilities are pure.
- Utilities have unit tests.
- At least two parsers use each extracted utility before old duplication is removed.

### 5.3 Add parser fixture tests

Create fixture-based tests for each parser.

Acceptance criteria:

- Tests assert normalized output.
- Tests avoid relying on internal regex implementation.
- IdentityIQ fixtures cover known edge cases from existing docs.

### 5.4 Incrementally migrate vendor parsers

Suggested order:

1. Smaller parser with lower complexity
2. Another similar parser to prove shared utility value
3. `identityiq-parser.ts` last

Acceptance criteria:

- Each migrated parser has equal or better fixture coverage.
- No broad parser rewrite happens without fixtures.

### 5.5 Introduce parser registry

Create a registry that selects the parser by detection confidence.

Acceptance criteria:

- Existing parser entry points still work.
- Parser selection is observable in diagnostics.
- Unknown source behavior remains safe.

## Validation

```bash
npm run lint
npm run typecheck
npm test -- --run src/lib/parsers
npm test -- --run
npm run build
```

## Rollback strategy

Keep vendor parser public outputs unchanged. Migrate utilities first, parser selection last.

---

# Phase 6 — Split FastAPI admin content router

## Objective

Break `api/routers/admin_content.py` into smaller resource routers and shared CRUD helpers.

## Problem summary

`api/routers/admin_content.py` is roughly 716 lines and combines models and CRUD endpoints for pages, testimonials, FAQs, and disclaimers. Pagination total currently loads all rows instead of using SQL count.

## Proposed structure

```text
api/routers/admin_pages.py
api/routers/admin_testimonials.py
api/routers/admin_faqs.py
api/routers/admin_disclaimers.py
api/crud/
  pagination.py
  responses.py
  get_or_404.py
```

## Tasks

### 6.1 Extract pagination helper

Create SQL-backed pagination helper.

Acceptance criteria:

- Uses SQL count instead of loading all records.
- Preserves current response fields.
- Has focused tests if Python test harness exists.

### 6.2 Extract `get_or_404`

Centralize common lookup behavior.

Acceptance criteria:

- Not-found responses are consistent.
- Existing endpoints preserve status codes.

### 6.3 Split page endpoints

Move page CRUD into `api/routers/admin_pages.py`.

Acceptance criteria:

- Imports remain registered in `api/index.py` or router setup.
- Behavior is preserved.

### 6.4 Split testimonial, FAQ, and disclaimer endpoints

Move each resource into its own router.

Acceptance criteria:

- `admin_content.py` is removed or becomes a compatibility aggregator only.
- No duplicate response mapping remains where helper can be used.

## Validation

```bash
npm run lint:python
# If Python tests exist, run them here.
npm run typecheck
npm test -- --run
npm run build
```

## Rollback strategy

Split one resource at a time and keep route prefixes unchanged.

---

# Phase 7 — Split database schema by domain

## Objective

Reduce merge conflict risk and improve domain discoverability by splitting `db/schema.ts`.

## Problem summary

`db/schema.ts` is roughly 1,841 lines and contains multiple unrelated domains in one file.

## Proposed structure

```text
db/schema/
  index.ts
  auth.ts
  clients.ts
  leads.ts
  disputes.ts
  credit-reports.ts
  documents.ts
  billing.ts
  content.ts
  automation.ts
  service-engagements.ts
```

## Tasks

### 7.1 Identify table dependency groups

Map all table references and relations.

Acceptance criteria:

- Import cycles are known before splitting.
- Tables with cross-domain relations are documented.

### 7.2 Create domain schema files with re-export index

Move one domain at a time.

Acceptance criteria:

- Existing imports from `db/schema` continue to work.
- Drizzle generation still works.
- No migration is generated solely from moving code.

### 7.3 Update direct imports opportunistically

New code should import from domain files or the schema index according to the chosen convention.

Acceptance criteria:

- Import convention is documented.
- No inconsistent partial migration creates confusion.

## Validation

```bash
npm run typecheck
npm run db:generate
npm test -- --run
npm run build
```

Review generated migration output carefully. A pure split should not produce destructive schema changes.

## Rollback strategy

Move one domain per commit. If Drizzle emits unintended migration changes, revert that slice and adjust exports.

---

# Phase 8 — Split report generation into calculation/model/rendering layers

## Objective

Make credit analysis and audit report generation easier to test and safer to modify.

## Problem summary

Large report modules combine calculations, data shaping, compliance copy, and rendering.

Target files:

- `src/lib/credit-analysis-report.ts`
- `src/lib/audit-report.ts`
- `src/lib/credit-analysis.ts`

## Proposed structure

```text
src/lib/reports/
  credit-analysis/
    calculateCreditAnalysis.ts
    buildCreditAnalysisModel.ts
    renderCreditAnalysisReport.ts
    sections.ts
    types.ts
  audit/
    calculateAuditFindings.ts
    buildAuditReportModel.ts
    renderAuditReport.ts
    sections.ts
    types.ts
```

## Tasks

### 8.1 Define intermediate report models

Create typed models representing report content before rendering.

Acceptance criteria:

- Models contain no HTML/string layout concerns unless intentionally part of content.
- Calculations can be tested independently.

### 8.2 Extract calculations

Move scoring, categorization, and finding calculations into pure functions.

Acceptance criteria:

- Pure functions have unit tests.
- Existing rendered report output is preserved.

### 8.3 Extract renderers

Move HTML/text/PDF-like formatting into renderer modules.

Acceptance criteria:

- Renderers receive report models.
- Renderers do not perform business calculations.

### 8.4 Add targeted regression tests

Avoid giant snapshots where possible. Prefer assertions on important sections and values.

Acceptance criteria:

- Tests catch missing sections.
- Tests catch calculation drift.
- Tests are not overly sensitive to harmless whitespace changes.

## Validation

```bash
npm run lint
npm run typecheck
npm test -- --run src/lib
npm run build
```

## Rollback strategy

Extract calculation first while keeping old renderer. Then extract rendering once model tests are stable.

---

# Phase 9 — Test suite maintainability cleanup

## Objective

Reduce brittleness and improve failure locality in large tests.

## Problem summary

Several tests exceed 500 lines and some are coupled to implementation details such as CSS selectors or heavy manual mocks.

Target files include:

- `src/lib/parsers/__tests__/metro2-mapping.test.ts`
- `src/components/admin/__tests__/EvidenceUploadModal.test.tsx`
- `src/__tests__/components/admin/DisputeWizard.test.tsx`
- `src/hooks/__tests__/useWizardDraft.test.ts`
- `src/components/admin/__tests__/WorkQueue.test.tsx`
- `src/__tests__/integration/DisputeWizardFlow.test.tsx`
- `src/__tests__/api/admin/clients.test.ts`
- `src/components/admin/__tests__/AdminGuard.test.tsx`
- `src/lib/__tests__/dispute-wizard-utils.test.ts`

## Tasks

### 9.1 Split large test files by behavior

Example:

```text
EvidenceUploadModal.validation.test.tsx
EvidenceUploadModal.upload.test.tsx
EvidenceUploadModal.errors.test.tsx
EvidenceUploadModal.accessibility.test.tsx
```

Acceptance criteria:

- No behavior is removed.
- Test names become more specific.
- Failure output points to a behavior area.

### 9.2 Replace CSS selector assertions with accessible queries

Acceptance criteria:

- Prefer role, label text, accessible name, and visible text queries.
- CSS selector tests remain only when styling behavior itself is under test.

### 9.3 Move shared mocks to test utilities

Suggested structure:

```text
src/test-utils/
  mockFetch.ts
  mockLocalStorage.ts
  renderWithProviders.tsx
  adminFixtures.ts
  disputeFixtures.ts
```

Acceptance criteria:

- Repeated fake timers/localStorage/fetch setup is centralized.
- Tests clean up after themselves.

### 9.4 Revisit skipped wizard tests

The skipped `src/__tests__/components/admin/DisputeWizard.test.tsx` should either be re-enabled, split, or replaced by targeted tests around extracted services/hooks.

Acceptance criteria:

- No high-risk wizard behavior remains covered only by skipped tests.
- If tests remain skipped, a documented reason and replacement coverage exists.

## Validation

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

---

# Phase 10 — Final consistency pass

## Objective

Ensure all extracted boundaries are documented, discoverable, and enforced by tests.

## Tasks

### 10.1 Document architecture boundaries

Add or update docs explaining:

- deterministic policy services
- LLM letter renderer boundaries
- admin route handler pattern
- admin resource hook pattern
- parser framework

Recommended locations:

```text
docs/agents/domain.md
docs/adr/
docs/plans/thermo-nuclear-code-quality-implementation-plan.md
```

### 10.2 Add lint or review checklist items

Update `AGENTS.md` or project docs with maintainability checks:

- no new route-local auth helper when shared helper exists
- no new giant admin CRUD page without resource hook consideration
- no policy decisions in prompt builders
- no parser normalization duplication without justification
- no new skipped tests without replacement coverage

### 10.3 Run full validation

```bash
npm run lint
npm run lint:python
npm run typecheck
npm test -- --run
npm run build
```

If schema was touched:

```bash
npm run db:generate
```

If end-to-end behavior changed:

```bash
npm run test:e2e
```

---

# Suggested implementation order by risk/value

1. Phase 0 — Safety harness and characterization tests
2. Phase 1 — Extract dispute wizard letter generation
3. Phase 2 — Split AI letter generation
4. Phase 3 — Shared admin API route infrastructure
5. Phase 4 — Frontend admin data-access layer
6. Phase 5 — Credit parser architecture
7. Phase 6 — FastAPI admin content split
8. Phase 7 — Database schema split
9. Phase 8 — Report generation split
10. Phase 9 — Test maintainability cleanup
11. Phase 10 — Final consistency pass

---

# Recommended first vertical slice

If only one slice is implemented first, choose this:

## Slice: Extract wizard letter-generation payload builder

Files to create:

```text
src/components/admin/dispute-wizard/services/buildLetterGenerationPayload.ts
src/components/admin/dispute-wizard/types/letter-generation.ts
src/components/admin/dispute-wizard/services/__tests__/buildLetterGenerationPayload.test.ts
```

Files to modify:

```text
src/components/admin/dispute-wizard/WizardContext.tsx
```

Why this first:

- It attacks the highest-risk god-context.
- It is behavior-preserving.
- It creates a seam for the later AI-letter-generation split.
- It can be tested as a pure function.
- It does not require route, schema, or UI redesign.

Acceptance criteria:

- `generateLetters` delegates payload construction to a pure function.
- Existing wizard behavior is preserved.
- New unit tests cover selected negative items, personal info items, inquiries, bureau targeting, reason codes, and AI summary integration.
- Full validation remains green.

---

# Done criteria for the overall initiative

The initiative is complete when:

- `WizardContext.tsx` is primarily a composition provider, not a workflow owner.
- `ai-letter-generator.ts` is a compatibility wrapper or small entrypoint, not a 1,700-line procedural module.
- Credit parser normalization utilities are shared across parsers.
- High-risk admin API routes use shared auth, parsing, error, and service boundaries.
- At least the largest repeated admin CRUD pages use shared data-access primitives.
- `api/routers/admin_content.py` is split or reduced to an aggregator.
- `db/schema.ts` is split by domain or has a documented reason not to split.
- Report generators use calculation/model/rendering layers.
- Large tests are split or justified, and no high-risk behavior is protected only by skipped tests.
- Full validation passes.
