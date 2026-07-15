{
  "summary": "Goal: implement Phase 1.1 from docs/plans/2026-07-14-credit-brain-accuracy-implementation-plan.md by making tri-merge ingest and downstream triage/discrepancy logic bureau-evidence-based rather than defaulting combined reports to all bureaus. Ordered plan: (1) extend parser output types and tri-merge parsers so each account carries per-bureau values/presence from source evidence, using IdentityIQ’s existing derogatory-account pattern as the model (`src/lib/parsers/pdf-parser.ts:154`, `src/lib/parsers/identityiq-parser.ts:652`, `src/lib/parsers/smartcredit-parser.ts:65`, `src/lib/parsers/myscoreiq-parser.ts:65`); (2) refactor credit-report ingest to populate `credit_accounts` and `negative_items` per-bureau fields only from evidence and stop the current combined=>all bureaus fallback (`src/lib/credit-analysis.ts:149-183`, `src/lib/credit-analysis.ts:298-344`); (3) rewrite discrepancy detection to compare one pull’s per-bureau columns instead of grouping all client accounts by legacy `bureau` across time (`src/lib/credit-analysis.ts:401`, `src/lib/credit-analysis.ts:712-834`); (4) remove undefined=>present fallbacks in triage/UI helpers so dispute batching only targets bureaus proven present (`src/lib/dispute-triage.ts:173-189`, `src/components/admin/dispute-wizard/types.ts:206-216`, `src/components/admin/client-detail/types.ts:175-185`); (5) add parser, ingest, discrepancy, and triage regressions before validate. Top risk: existing UI/helpers still treat `bureau === 'combined'` or undefined flags as universal presence, so ingest fixes alone could leave disputes mis-batched unless triage/UI helpers are updated in the same change set.",
  "findings": [
    {
      "severity": "high",
      "title": "Step 1 — Introduce explicit per-bureau account evidence in parser contracts",
      "details": "Add a shared account-level tri-merge structure to parser output so combined-report parsers can emit bureau-specific presence and values for every tradeline, not only negative/derogatory accounts. The current shared types expose per-bureau detail only for `DerogatoryAccount` and extended report metadata (`src/lib/parsers/pdf-parser.ts:154-199`, `src/lib/parsers/pdf-parser.ts:237-244`), while `ParsedAccount` remains single-bureau (`src/lib/parsers/pdf-parser.ts:46-61`). IdentityIQ already extracts bureau-column data for all accounts into `accountData` before flattening to one row per bureau (`src/lib/parsers/identityiq-parser.ts:652-744`), so use that pattern as the source model for a new shared structure such as parsed per-bureau account evidence. Keep the legacy flat `accounts` output until ingest is refactored, but make the richer structure available in `ExtendedParsedCreditData`.",
      "files": [
        "src/lib/parsers/pdf-parser.ts",
        "src/lib/parsers/identityiq-parser.ts",
        "src/lib/parsers/smartcredit-parser.ts",
        "src/lib/parsers/myscoreiq-parser.ts"
      ],
      "risk": "If the new parser contract is ad hoc or parser-specific, ingest will keep guessing presence and balances. Type churn also risks breaking current parser callers that expect only `ParsedCreditData`.",
      "verification": [
        "Add/expand parser unit tests in `src/lib/parsers/__tests__/identityiq-parser.test.ts` to assert per-bureau account evidence is emitted for a tri-merge fixture.",
        "Run `npm run test -- src/lib/parsers/__tests__/identityiq-parser.test.ts`.",
        "Run `npm run typecheck` to confirm the shared parser type changes compile."
      ]
    },
    {
      "severity": "high",
      "title": "Step 2 — Generalize tri-merge extraction for SmartCredit and MyScoreIQ",
      "details": "Implement bureau-aware account extraction in the combined-report parsers that currently flatten accounts without preserving bureau evidence. SmartCredit returns plain `ParsedCreditData` and extracts accounts via local DOM/text heuristics (`src/lib/parsers/smartcredit-parser.ts:65-82`, `src/lib/parsers/smartcredit-parser.ts:168-202`), while MyScoreIQ does the same (`src/lib/parsers/myscoreiq-parser.ts:65-82`, `src/lib/parsers/myscoreiq-parser.ts:192-247`). Both already have bureau-context helpers (`src/lib/parsers/smartcredit-parser.ts:363-371`, `src/lib/parsers/myscoreiq-parser.ts:474-476`) that can be reused to capture which bureau section a field came from. For combined rows/sections, record `false` or absent evidence when a bureau column is blank/`-`, and capture per-bureau values for status/date/balance/account number where visible.",
      "files": [
        "src/lib/parsers/smartcredit-parser.ts",
        "src/lib/parsers/myscoreiq-parser.ts",
        "src/lib/parsers/pdf-parser.ts"
      ],
      "risk": "These parsers rely on heuristic HTML matching; adding bureau-column logic can accidentally duplicate tradelines or infer bureau membership from container text that is too broad.",
      "verification": [
        "Add parser fixture assertions for at least one SmartCredit and one MyScoreIQ combined-report sample proving an account is present on only a subset of bureaus.",
        "Run targeted parser tests for the added fixtures.",
        "Run `npm run typecheck` after parser changes."
      ]
    },
    {
      "severity": "high",
      "title": "Step 3 — Refactor credit-account ingest to consume parser evidence instead of marking combined reports on all bureaus",
      "details": "Replace the current account ingest fallback that treats combined/unknown as universal bureau presence. Today `analyzeCreditReport` sets all three presence flags true when `account.bureau` is combined/unknown or missing (`src/lib/credit-analysis.ts:149-183`), then copies the same `dateReported` and `balance` into all three bureau-specific columns (`src/lib/credit-analysis.ts:198-202`). Update ingest to read the new per-bureau account evidence and populate `onTransunion/onExperian/onEquifax`, dates, balances, and any future account-level bureau status fields only when the source explicitly supports them. Preserve current single-bureau behavior for true single-bureau reports from `credit_reports.bureau` (`db/schema.ts:476-490`).",
      "files": [
        "src/lib/credit-analysis.ts",
        "src/lib/parsers/pdf-parser.ts"
      ],
      "risk": "If ingest still falls back silently, discrepancy detection will remain polluted. If it becomes too strict without parser coverage, legitimate tradelines may appear on zero bureaus and disappear from downstream workflows.",
      "verification": [
        "Add a focused ingest regression in `src/lib/__tests__/credit-account-ingest.test.ts` or a new `credit-analysis` test proving combined-report accounts with `-`/blank bureau cells persist false presence flags and only bureau-specific values for present bureaus.",
        "Run the targeted test file.",
        "Run `npm run typecheck`."
      ]
    },
    {
      "severity": "high",
      "title": "Step 4 — Refactor negative-item ingest to use evidence-based presence only",
      "details": "Update the negative-item path to stop conservative all-true defaults. Current logic uses `derogatoryMatch` when available, but otherwise marks all bureaus true for combined/unknown reports (`src/lib/credit-analysis.ts:298-344`). Preserve the good IdentityIQ derogatory-account evidence path (`src/lib/parsers/identityiq-parser.ts:1170-1226`) and switch the fallback so combined-report negative items derive presence only from parsed per-bureau evidence or linked account evidence. If no bureau evidence exists for a combined report, the plan should force a deterministic decision: either skip cross-bureau targeting for that item or persist all flags false plus note/telemetry for review. Do not silently treat unknown as present.",
      "files": [
        "src/lib/credit-analysis.ts",
        "src/lib/parsers/identityiq-parser.ts",
        "src/lib/parsers/smartcredit-parser.ts",
        "src/lib/parsers/myscoreiq-parser.ts"
      ],
      "risk": "Negative items are the inputs to dispute generation; a bad fallback here can either over-target bureaus or drop valid items from selection if parser evidence is incomplete.",
      "verification": [
        "Add a regression proving a combined-report negative item with only Experian evidence persists `onExperian=true` and the other bureau flags false.",
        "Add a regression proving blank/`-` bureau values do not become `true`.",
        "Run the relevant test file(s) and `npm run typecheck`."
      ]
    },
    {
      "severity": "high",
      "title": "Step 5 — Rewrite discrepancy detection to compare per-bureau columns inside one report pull",
      "details": "Change `detectBureauDiscrepancies` to operate on the triggering `creditReportId` and compare each stored account’s per-bureau columns within that pull. Right now `analyzeCreditReport` calls it with only `clientId` (`src/lib/credit-analysis.ts:401`) and the function loads all client accounts across all time (`src/lib/credit-analysis.ts:712-718`), groups by normalized creditor, then compares rows by legacy `bureau` (`src/lib/credit-analysis.ts:729-834`). That design cannot work once tri-merge data lives in one row with per-bureau columns, and it creates cross-time false positives. Refactor the function signature to accept `reportId` (and likely `clientId`), scope account/profile queries to the report, clear only discrepancies attributable to that pull if supported, and compare `transunionBalance/experianBalance/equifaxBalance` plus analogous status/payment fields within a single record or normalized tradeline group from the same pull.",
      "files": [
        "src/lib/credit-analysis.ts",
        "db/schema.ts"
      ],
      "risk": "The current discrepancy table has no `creditReportId`, so deleting/rebuilding discrepancies per pull may be awkward. Without adding pull scoping to the table, reprocessing one report could erase discrepancies from another report for the same client.",
      "verification": [
        "Add a regression test showing two different report pulls for the same client with different balances do not create bureau discrepancies for temporal changes.",
        "Add a same-pull test showing one combined tradeline with TU/EXP/EQ value mismatch does create the expected discrepancy rows.",
        "Run `npm run test -- src/lib/__tests__/credit-report-pull-comparison.test.ts` plus the new discrepancy test file."
      ]
    },
    {
      "severity": "medium",
      "title": "Step 6 — Decide whether `bureau_discrepancies` needs report-level provenance before implementation",
      "details": "Before coding Step 5, make an explicit schema decision. `bureau_discrepancies` currently stores only `clientId` plus field/value metadata (`db/schema.ts:632-649`) and the admin discrepancies route queries by client/open state (`src/app/api/admin/disputes/discrepancies/route.ts:64-68`). If discrepancies are now scoped to one pull, adding `creditReportId` to `bureau_discrepancies` is the cleanest design so re-analysis can replace discrepancies for only that pull and the UI can later filter by report. If the team chooses not to migrate, the builder must at minimum document how stale rows are safely replaced without wiping unrelated pull results.",
      "files": [
        "db/schema.ts",
        "src/lib/credit-analysis.ts",
        "src/app/api/admin/disputes/discrepancies/route.ts"
      ],
      "risk": "This is the main decision point. Skipping report provenance could preserve current API shape, but it makes pull-scoped rebuilds and debugging harder and risks data loss on re-analysis.",
      "verification": [
        "If schema changes: add migration, run `npm run db:migrate`, and validate the discrepancies API still returns open rows.",
        "If schema does not change: add tests proving re-analysis of one report does not delete discrepancy rows from another report for the same client."
      ]
    },
    {
      "severity": "high",
      "title": "Step 7 — Remove undefined=>present fallback in triage and bureau-appearance helpers",
      "details": "Once ingest flags are evidence-based, drop the legacy behavior that assumes undefined or combined means the item appears on a bureau. Triage currently does this in `getItemBureaus` (`src/lib/dispute-triage.ts:173-189`), dispute wizard selection does the same in `itemAppearsOnBureau` (`src/components/admin/dispute-wizard/types.ts:206-216`), and client detail rendering repeats it in `appearsOnBureau` (`src/components/admin/client-detail/types.ts:175-185`). Update all three in the same change so UI counts, quick actions, and combined-letter batching stay aligned with ingest truth. Preserve the secondary-CRA special case in the wizard helper (`src/components/admin/dispute-wizard/types.ts:208-210`).",
      "files": [
        "src/lib/dispute-triage.ts",
        "src/components/admin/dispute-wizard/types.ts",
        "src/components/admin/client-detail/types.ts",
        "src/components/admin/dispute-wizard/StepItemSelect.tsx",
        "src/components/admin/dispute-wizard/services/buildLetterGenerationPayload.ts"
      ],
      "risk": "If only triage changes and UI helpers do not, selected-item counts and generated bureau letters can diverge. If only UI changes and ingest still leaves undefineds, items may vanish unexpectedly.",
      "verification": [
        "Add unit tests for `triageItems`/`getItemBureaus` proving an item with all flags false is assigned to no bureaus and an item with only one true flag is assigned only there.",
        "Update `src/components/admin/dispute-wizard/services/__tests__/buildLetterGenerationPayload.test.ts` to prove combined letters are generated only for bureaus with true presence flags.",
        "Run targeted tests and `npm run typecheck`."
      ]
    },
    {
      "severity": "medium",
      "title": "Step 8 — Audit legacy `bureau === 'combined'` assumptions in selection and reporting flows",
      "details": "Search-driven review shows several components still branch on `combined` or direct `item.bureau` matching, especially in the dispute wizard (`src/components/admin/dispute-wizard/StepItemSelect.tsx:138`, `src/components/admin/dispute-wizard/StepItemSelect.tsx:355`) and report displays (`src/components/admin/client-detail/ReportsTab.tsx:159-177`). After helper updates, audit these call sites so no direct `item.bureau === bureau` shortcut bypasses evidence flags for combined reports. Keep `credit_reports.bureau='combined'` as report metadata, but stop using it as proof that every tradeline is present on all three.",
      "files": [
        "src/components/admin/dispute-wizard/StepItemSelect.tsx",
        "src/components/admin/client-detail/ReportsTab.tsx",
        "src/components/admin/client-detail/OverviewTab.tsx"
      ],
      "risk": "Stray direct checks against `item.bureau` can reintroduce over-targeting even after ingest and helper fixes.",
      "verification": [
        "Manual UI smoke check in the dispute wizard: a selected combined-report item only appears under the bureaus with true presence flags.",
        "Run component-associated tests if present; otherwise rely on payload builder/unit coverage plus `npm run typecheck`."
      ]
    },
    {
      "severity": "medium",
      "title": "Step 9 — Add end-to-end regression coverage for one-pull discrepancy behavior and bureau-aware triage",
      "details": "Backstop the phase with focused regressions rather than broad assumptions. Existing tests include parser and ingest-adjacent coverage (`src/lib/parsers/__tests__/identityiq-parser.test.ts`, `src/lib/__tests__/credit-account-ingest.test.ts`, `src/lib/__tests__/credit-report-pull-comparison.test.ts`), but there is no dedicated discrepancy or triage test file yet. Add a new `src/lib/__tests__/dispute-triage.test.ts` or similar and a new discrepancy-focused test file for `credit-analysis.ts` so the undefined=>present fallback cannot return in a later refactor.",
      "files": [
        "src/lib/__tests__/dispute-triage.test.ts",
        "src/lib/__tests__/credit-analysis-discrepancies.test.ts",
        "src/lib/parsers/__tests__/identityiq-parser.test.ts",
        "src/components/admin/dispute-wizard/services/__tests__/buildLetterGenerationPayload.test.ts"
      ],
      "risk": "Without dedicated regressions, future parser or UI cleanup could silently restore all-bureaus defaults because combined-report behavior spans parser, ingest, lib, and UI layers.",
      "verification": [
        "Run the new targeted test files.",
        "Run `npm run test` if the targeted suite passes.",
        "Run `npm run validate` as the final gate once implementation is complete."
      ]
    },
    {
      "severity": "medium",
      "title": "Open question / decision point",
      "details": "The builder should not silently choose how to persist tri-merge accounts long term. IdentityIQ currently emits one `ParsedAccount` per bureau (`src/lib/parsers/identityiq-parser.ts:797-809`), while Phase 1.1’s direction implies one logical account with per-bureau values. The cleanest path is: keep parser flattening if needed for backward compatibility, but drive ingest/discrepancy logic from a new per-bureau evidence structure and optionally normalize to one stored row per logical tradeline. If the team prefers to keep three `credit_accounts` rows per tri-merge tradeline, discrepancy detection and batching become harder and duplicate-risk remains. This needs an explicit implementation choice before coding Step 3.",
      "files": [
        "src/lib/parsers/identityiq-parser.ts",
        "src/lib/credit-analysis.ts",
        "db/schema.ts"
      ],
      "risk": "Choosing the wrong storage shape can force a second refactor in Phase 1.2 when discrepancy detection must be single-pull and account-level.",
      "verification": [
        "Decision recorded in implementation notes/PR description before coding.",
        "Tests reflect the chosen storage model explicitly."
      ]
    }
  ]
}