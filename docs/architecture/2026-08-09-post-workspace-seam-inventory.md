# Post-Workspace Seam Inventory

This inventory records the caller-facing seams that must remain stable while
the Phase 5 architecture refresh is implemented. It is intentionally small:
it identifies stable interfaces and invariants, not the internal shape of the
modules behind them.

## Workspace API namespace

- The canonical first-party route root is `src/app/api/workspace`.
- `src/app/api/admin` is retired as a physical route tree and must not be
  reintroduced. Compatibility for legacy `/api/admin/*` URLs lives only in
  `src/proxy.ts` and `src/lib/api-workspace-namespace.ts` until the announced
  sunset.
- The letter-generation route remains
  `src/app/api/workspace/disputes/generate-letter/route.ts` and exposes its
  request handler through `POST`.

## Dispute-letter generation

- `src/lib/ai-letter-generator.ts` remains the current composition module
  until Task 2 replaces its internal implementation behind deliberate seams.
- `buildManualLetterPrompt` is a stable prompt-construction entry point.
- Deterministic policy, evidence, eligibility, and lint decisions remain
  outside any LLM/provider adapter. An LLM result is untrusted draft text and
  cannot establish facts or bypass existing persistence gates.

## Credit-report parsing and analysis

- `src/lib/parsers/identityiq-parser.ts` is the IdentityIQ source adapter;
  `parseIdentityIQReport` is its stable parser entry point.
- `src/lib/credit-analysis-report.ts` owns the current report-rendering entry
  point, `generateCreditAnalysisReportHTML`.
- Parser source provenance and explicit missing/unknown values must survive
  normalization and report assembly. Later Phase 5 work may move
  implementations but must preserve these semantics.

## Change procedure

When a planned refactor needs to change a listed interface, update this file
and `src/__tests__/architecture/post-workspace-module-contracts.test.ts` in
the same change. Then run the focused contract test and the affected feature
tests before integration.
