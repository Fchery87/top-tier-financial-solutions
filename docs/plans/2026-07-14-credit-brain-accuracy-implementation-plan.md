# Credit Brain Accuracy Implementation Plan

**Created:** 2026-07-14
**Source:** Code-only review of the credit analysis, dispute, and report-parsing systems (no prior docs consulted; every finding is anchored to a file:line in the codebase as of commit `b21da10`).
**Status:** `[x] P0` `[ ] P1` `[ ] P2` `[ ] P3` — update this line as phases complete.

---

## How to use this plan

- Work phases strictly in order: **P0 → P1 → P2 → P3**. P0 items are active-harm correctness bugs; everything later builds on their fixes.
- Every task has acceptance criteria and a verification step. A task is not done until verification passes (`npm run validate` plus the task-specific checks).
- **Phase completion protocol (mandatory):** when the last task of a phase is checked off:
  1. Mark the phase complete in the **Status** line above and in the phase heading (`✅ COMPLETE — YYYY-MM-DD`).
  2. Update every doc listed in that phase's **Doc-sync checklist** so the project documentation reflects the new behavior. Stale docs are treated as a phase-blocking defect, not a follow-up.
  3. Re-read `AGENTS.md` (root) and `src/lib/AGENTS.md` — if the phase changed module responsibilities, exports, or search hints, update them.
  4. Record a short entry in the **Change Log** at the bottom of this file.

---

## P0 — Correctness bugs (active harm) `✅ COMPLETE — 2026-07-14`

These bugs produce wrong FCRA clocks, unfounded dispute grounds, and defective letters today.

### P0.1 — Fix the FCRA obsolescence clock (DOFD) end-to-end
**Problem:** `src/lib/credit-analysis.ts:652` uses `item.dateReported` as the Date of First Delinquency proxy. `dateReported` refreshes monthly, so `fcraExpirationDate` is pushed ~7 years past the current report date — genuinely obsolete items are never flagged, and `fcraComplianceItems` notes are computed on a meaningless base. `convertToMetro2Format` (`src/lib/ai-letter-generator.ts:1710`) hands the same report date to the LLM *labeled as DOFD*, inviting fabricated re-aging/obsolescence findings. Meanwhile `src/lib/dispute-triage.ts:58` (`getObsolescenceBaseDate`) already does it correctly (DOFD → last activity → reported).

**Tasks:**
- [x] Extract `getObsolescenceBaseDate` into a shared module (e.g., `src/lib/fcra-clock.ts`) and make `credit-analysis.ts` (`saveFcraComplianceItem`), `dispute-triage.ts`, and `ai-letter-generator.ts` (`analyzeNegativeItem`, `convertToMetro2Format`) all use it.
- [x] Add a `dofdConfidence: 'dofd' | 'last_activity' | 'date_reported'` field to `fcraComplianceItems` rows so downstream consumers know which proxy produced the clock; suppress "FCRA VIOLATION" wording when confidence is `date_reported`.
- [x] In `convertToMetro2Format`, stop populating `dateOfFirstDelinquency` from `dateReported`; pass it only when a true DOFD (or last-activity proxy, labeled as such) exists.
- [x] Parser work: extract DOFD and the bureau-printed removal date ("on record until" / "will be removed by") where the source exposes them (Experian direct, IdentityIQ, tri-merge products). Persist as `dateOfFirstDelinquency` and `bureauStatedRemovalDate` on `negativeItems`. Bureau-stated removal date is ground truth — prefer it over any computation.

**Acceptance:** a negative item with last activity > 7 years ago is flagged obsolete; an item with only a recent `dateReported` is *not* flagged and carries low clock confidence; LLM input never labels a report date as DOFD.
**Verification:** unit tests in `src/lib/__tests__/fcra-clock.test.ts` covering all three proxy tiers + a regression test that `saveFcraComplianceItem` no longer uses `dateReported` directly.

### P0.2 — Remove the two false Metro 2 balance rules
**Problem:** `src/lib/ai-letter-generator.ts:982` flags every charge-off with a balance as a violation ("charge-offs should show $0 balance") and `:912` does the same for `closed` accounts. Both are factually wrong: a creditor retaining a charged-off debt properly reports the unpaid balance, and closed accounts routinely carry balances owed. Only **sold/transferred** accounts must report zero balance, and **paid** status with balance > 0 is genuinely inconsistent. These rules mass-produce unfounded disputes (FCRA §611(a)(3) frivolous-dispute exposure) and inflate `letter-strength-calculator.ts` scores.

**Tasks:**
- [x] Restrict the balance rules to: status ∈ {sold, transferred, paid} with balance > 0. Delete the generic charge-off/closed balance violations.
- [x] Audit the remaining checks in `analyzeNegativeItem` against the same standard ("would a furnisher's compliance officer agree this is impossible data?"). Keep: past-due-on-current, charge-off-status-with-current-payment-rating, balance-over-limit (revolving only), collection-missing-original-creditor.
- [x] Add unit tests asserting a retained charge-off with a balance produces **zero** violations.

**Acceptance:** no violation is emitted for accurate, common reporting patterns; violation list for a synthetic "clean" derogatory account is empty.
**Verification:** new test file `src/lib/__tests__/negative-item-analysis.test.ts` with fixtures for each rule (true positive + false-positive guard per rule).

### P0.3 — Stop fabricating account numbers in auto-escalation letters
**Problem:** `src/lib/dispute-escalation-runner.ts:109,134` passes `negativeItem.id.slice(-8)` (internal UUID tail) as `accountNumber`; letters render it as `Account Number: ****xxxx`. Bureaus receive an account number that does not exist.

**Tasks:**
- [x] Join the linked `creditAccounts` row (`negativeItems.creditAccountId`) and use its real masked account number; omit the field entirely when unavailable.
- [x] Grep for other `.slice(-8)` / `.slice(-4)` uses on IDs feeding letter params and fix identically (check `convertToMetro2Format`'s `accountNumberMasked` at `ai-letter-generator.ts:1706`).

**Acceptance:** generated letters contain either the true masked account number or no account-number line — never an ID fragment.
**Verification:** unit test on the escalation letter params builder; manual dry-run (`runDisputeEscalationAutomation({ dryRun: true })` path extended to expose the built params).

### P0.4 — Escalation reason codes render as raw snake_case in letters
**Problem:** `buildEscalationPlan` (`src/lib/dispute-automation.ts:51,72,83,94,104`) emits `previously_disputed`, `request_verification_method`, `no_response`, `repeat_verification`, `fcra_non_compliance` — none exist in `REASON_CODE_DESCRIPTIONS` (`src/lib/ai-letter-generator.ts:127`), so `getReasonDescriptions` (`:189`) falls back to the raw code. Round-2+ letters read: *"REASON FOR DISPUTE: no_response Additionally, request_verification_method."*

**Tasks:**
- [x] Add proper prose descriptions for every code the escalation planner can emit.
- [x] Add a closure test: every reason code producible by `buildEscalationPlan` (and by `DISPUTE_REASON_CODES`) must have an entry in `REASON_CODE_DESCRIPTIONS`.

**Acceptance:** no snake_case token can reach letter text.
**Verification:** the closure test fails if a future code is added without a description.

### P0.5 — Stop destroying parsed remarks on ingest
**Problem:** `src/lib/credit-analysis.ts:225-227` overwrites `remarks` with `"Completeness: N%. Missing: …"` whenever any field is missing (nearly always). Real remarks ("account sold", special comments) are lost, and the analysis engine depends on them (`ai-letter-generator.ts:1043` checks `remarks.includes('sold')`).

**Tasks:**
- [x] Add `completenessScore` (int) and `missingFields` (json) columns to `creditAccounts`; migrate; store the parsed remarks in `remarks` untouched.
- [x] Update any UI reading the completeness string out of `remarks` to read the new columns.

**Acceptance:** a parsed account with missing fields retains its original remarks and exposes completeness separately.
**Verification:** ingest test with a fixture account carrying both remarks and missing fields; `npm run db:migrate` clean on a scratch DB.

### P0 Doc-sync checklist (complete before marking phase done)
- [x] `docs/CREDIT-ANALYSIS-IMPLEMENTATION.md` — DOFD/clock behavior, new columns, revised violation rule list.
- [x] `docs/METRO2-VIOLATION-FIX-SUMMARY.md` — append the removed false rules and the new rule standard.
- [x] `docs/adr/` — add ADR for "FCRA clock source-of-truth hierarchy (bureau-stated date > DOFD > last activity > report date)".
- [x] `src/lib/AGENTS.md` — new `fcra-clock.ts` module, changed `credit-analysis.ts` responsibilities.
- [x] This file — status line, phase heading, Change Log.

---

## P1 — Brain quality & legal posture `[ ] NOT STARTED`

### P1.1 — Per-bureau data model for tri-merge reports
**Problem:** For combined reports, `src/lib/credit-analysis.ts:190-222` marks every account present on all three bureaus and copies identical values into `transunionBalance` / `experianBalance` / `equifaxBalance`. `detectBureauDiscrepancies` (`:693`) groups by the legacy single `bureau` field, so tri-merge uploads (IdentityIQ/SmartCredit/MyScoreIQ — the primary case) can never produce real cross-bureau comparison at account level, and items can be batched to bureaus that don't report them.

**Tasks:**
- [ ] Extend tri-merge parsers to emit per-bureau values per account (the derogatory-account path in `identityiq-parser.ts` already models this — generalize it to all accounts and to `smartcredit-parser.ts` / `myscoreiq-parser.ts`).
- [ ] Ingest: populate per-bureau columns only from evidence; presence flags default to **false** when the source shows a bureau column as `-`/empty (replace the current "conservatively mark all true" behavior at `credit-analysis.ts:190-194, 338-344`).
- [ ] Rewrite `detectBureauDiscrepancies` to compare the per-bureau columns **within a single report pull** instead of grouping legacy `bureau` values across all accounts.
- [ ] Triage (`dispute-triage.ts` `getItemBureaus`): drop the "undefined means present" fallback once presence flags are evidence-based.

### P1.2 — Scope discrepancy detection to one pull
**Problem:** `detectBureauDiscrepancies` queries ALL client accounts across every report ever uploaded (`credit-analysis.ts:695-698`); a January pull vs a June pull becomes a false "cross-bureau discrepancy." Cross-time comparison already lives in `src/lib/credit-report-pull-comparison.ts` — keep temporal deltas there.

**Tasks:**
- [ ] Filter the account/profile queries to the triggering `creditReportId` (or same pull window).
- [ ] Regression test: two pulls of the same account with different balances produce zero `bureauDiscrepancies` rows.

### P1.3 — Consolidate on the factual letter engine; retire the old philosophy
**Problem:** Two generations coexist in `src/lib/ai-letter-generator.ts`. The structured factual engine (`METRO2_ANALYSIS_SYSTEM_PROMPT`, `:1380`) is the correct posture. The older paths undercut it: `:223` asserts Metro 2 non-compliance "constitutes willful non-compliance" (legal overstatement — Metro 2 is an industry format, not a statute); `:233-238` auto-threatens statutory damages in every round ≥ 2 letter; fallback letters demand "COMPLETE DELETION" in caps; `:196-209` demands the bureau bypass e-OSCAR (no legal basis, a known template-mill tell — the §611(a)(6)(B)(iii) MOV request in the same block is legitimate and stays).

**Tasks:**
- [ ] Make `generateFactualMetro2DisputeLetter` the single generation path; port multi-provider support to it (currently Google-only, `:1512`).
- [ ] Delete `AI_PROMPT_TEMPLATE`, `MULTI_ITEM_AI_PROMPT_TEMPLATE`, the e-OSCAR bypass block, and the willful-non-compliance/damages boilerplate. Replace the no-API-key fallback with a neutral field-specific verification-request template (no deletion demands, no threats).
- [ ] Remove hard-coded Metro 2 field **numbers** from prompts and violation strings (e.g., "Field 24 – Original Creditor" is wrong — Original Creditor Name is a K1 segment field; "Field 8 (Balance)" is wrong — Current Balance is Base Segment Field 21). Cite segment + field *name* only.
- [ ] Escalation letters keep MOV (round 2) → furnisher-direct §623(a)(8) (round 3); damages language only when a human explicitly enables it for a documented pattern.

### P1.4 — Deterministic post-generation letter lint (new module)
**Problem:** Prompts forbid ownership-denial language, but nothing verifies LLM output. Highest-value single addition.

**Tasks:**
- [ ] New `src/lib/letter-lint.ts`: scan generated letters for (a) ownership-denial phrases without corresponding confirmed reason codes, (b) statute citations outside an allowlist, (c) account details that don't match the DB row, (d) threat/damages language when not authorized, (e) identity-theft claims without the documented flag.
- [ ] Wire into every generation path (wizard, multi-item, escalation runner) — a failing lint blocks send and surfaces the reasons; escalation runner keeps the draft but flags the review task.
- [ ] Follow the existing deterministic-gate pattern in `dispute-compliance-policy.ts` / `dispute-policy-decision.ts` (input-side) — this is its output-side twin.

### P1.5 — Decouple confidence/strength from round number
**Problem:** `ai-letter-generator.ts:1139` and `letter-strength-calculator.ts:119-129` increase confidence/strength with round. An item verified twice is not more likely inaccurate; escalation changes *strategy*, not evidence.

**Tasks:**
- [ ] Remove round-based confidence boosts; keep round as a strategy input only. Re-balance strength weights toward violations + evidence.

### P1 Doc-sync checklist
- [ ] `docs/CREDIT-ANALYSIS-IMPLEMENTATION.md` — per-bureau model, discrepancy engine scope.
- [ ] `docs/IDENTITYIQ-PARSER-ENHANCEMENTS.md` + `docs/IDENTITYIQ_PARSER_GUIDE.md` — per-bureau account extraction.
- [ ] `docs/adr/0001-ai-renders-deterministic-dispute-policy.md` — extend/supersede with the output-lint decision (new ADR).
- [ ] `docs/agents/domain.md` — letter engine consolidation, new `letter-lint.ts`.
- [ ] Root `AGENTS.md` — Domain-Specific Searches section if module names changed.
- [ ] This file — status, Change Log.

---

## P2 — Reliability of parsing & LLM I/O `[ ] NOT STARTED`

### P2.1 — Parser fixture corpus + golden tests
**Problem:** Ten parser modules, one test file (`src/lib/parsers/__tests__/metro2-mapping.test.ts`). When a monitoring service redesigns its HTML, the specialized parser silently degrades to the generic fallback (`html-parser.ts:72-75`), whose heuristics guess ("first non-numeric cell is the creditor," `:212-222`), and bad rows enter the DB.

**Tasks:**
- [ ] Build a sanitized fixture per source (identityiq, smartcredit, privacyguard, myscoreiq, annualcreditreport, transunion, experian, equifax, generic HTML, PDF) with golden JSON expected outputs; run in CI.
- [ ] Test `detect-source.ts` routing against every fixture (right parser, right bureau).

### P2.2 — Parse-quality gate (`needs_review`)
**Tasks:**
- [ ] Add `needs_review` to `creditReports.parseStatus`. Gate on: low source-detection confidence, implausible account count, unreconciled totals, or >40% of accounts with completeness < 50 (use the P0.5 columns).
- [ ] Admin queue surfacing gated reports; nothing downstream (analysis rows, triage, letters) is generated from a `needs_review` report until approved.

### P2.3 — Detection & date-parsing hardening
**Tasks:**
- [ ] `detect-source.ts:113-115`: drop bare `\bEX\b` / `\bEQ\b` / `\bTU\b` tokens (false positives flip single-bureau reports to "combined"); require full bureau-name matches for the combined verdict.
- [ ] Central date parser with explicit format lists per source; replace naive `new Date(str)` calls (`credit-analysis.ts:54-58` `parseBureauDate`, parser-local `parseDate`s).

### P2.4 — Persist payment-history grids
**Problem:** `metro2-mapping.ts:175` models `paymentHistory` but no grid reaches the DB — blocking re-aging detection (DOFD vs first delinquency in grid) and status-vs-history checks, the two highest-value Metro 2 checks.

**Tasks:**
- [ ] Schema: per-account, per-bureau month→code grid (json column is fine). Extract in tri-merge + bureau parsers where the source renders a 24-month grid.
- [ ] Feed the grid into `analyzeNegativeItem` inputs and the structured LLM payload.

### P2.5 — Structured LLM output + current model defaults
**Tasks:**
- [ ] Replace regex-cleanup `JSON.parse` (`ai-letter-generator.ts:1596-1613`) with provider-native structured output (JSON schema / tool call) for the factual engine.
- [ ] Update hard-coded model fallbacks (`gpt-5`, `claude-sonnet-4-6` at `:28,37`) to current defaults (e.g., `claude-sonnet-5`), sourced from one config location; verify provider parameter names are current.
- [ ] Fuzzy matching hardening: `findDerogatoryMatch` (`credit-analysis.ts:44-50`) bidirectional-substring and first-match account linking (`:289-297`) → prefer account-number-last-4, then name+amount; record match confidence on the row.

### P2 Doc-sync checklist
- [ ] `docs/IDENTITYIQ_PARSER_GUIDE.md` + `docs/IDENTITYIQ-PARSER-ENHANCEMENTS.md` — fixtures, grid extraction, gate behavior.
- [ ] `docs/PARSER-FIX-ORIGINAL-CREDITOR.md` — matching-confidence changes.
- [ ] `docs/SETUP_GUIDE.md` — new migrations, LLM config defaults.
- [ ] Root `AGENTS.md` — test commands / fixture locations under Quick Find.
- [ ] This file — status, Change Log.

---

## P3 — Differentiators `[ ] NOT STARTED`

### P3.1 — Re-aging + duplicate-tradeline detectors (deterministic)
- [ ] Re-aging: DOFD later than first delinquency in the persisted grid (needs P2.4). Provable, common with debt buyers, genuine §605 violation.
- [ ] Duplicate liability: cross-item pass — original creditor and collector (or two debt buyers) both reporting active balances on one debt, using the `originalCreditor` linkage already extracted. Currently only in the LLM checklist (`ai-letter-generator.ts:1434-1436`); the deterministic engine analyzes items one at a time and cannot see it.

### P3.2 — Medical-debt rule pack
- [ ] Use existing medical classification (`ACCOUNT_TYPE_CODES` 15/90, `mapAccountTypeToCategory`) to flag: medical collections < $500, paid medical collections, medical collections younger than 1 year (bureau NCAP+ policies), and state-law reporting bans (NY, CO, others — maintain a state table). **Verify the current litigation status of the CFPB medical-debt rule before citing it in any letter.**
- [ ] Dedicated triage strategy + letter language for medical items.

### P3.3 — Outcome-driven strategy selection
- [ ] Wire `getRecommendedMethodologyForCreditor` (`src/lib/creditor-strategy-insights.ts:154`) into `determineStrategy` (`dispute-triage.ts:68`) and the auto-select route so round-1 methodology reflects per-creditor historical success (respect `MIN_SAMPLE_SIZE`). Static heuristics remain the fallback.

### P3.4 — Secondary bureaus, CFPB flow, frivolous-dispute hygiene, mail tracking
- [ ] Secondary bureaus: addresses already exist (`ai-letter-generator.ts:110-125` — LexisNexis, Innovis, ChexSystems, EWS); add triage/wizard targets and report-request/dispute flows.
- [ ] Round 4: replace the "letter to CFPB" (`dispute-automation.ts:99-106`; no `cfpb` address exists and `postProcessLetter` only addresses bureaus) with a CFPB **portal complaint packet** (narrative + attachment checklist).
- [ ] New-information gate for repeat disputes: same item + bureau requires new evidence/discrepancy/pull-delta before regeneration (§611(a)(3)); escalation runner's existing-child check stays, extend to the wizard path.
- [ ] Certified-mail/print integration with tracking numbers stored on the dispute row so the 30-day SLA clock (`calculateDisputeDeadlines`) starts from evidence, not manual bookkeeping.
- [ ] Audit-report score projection (`src/lib/audit-report.ts:120-136`): replace flat per-item point gains (capped 150) with conservative ranges + explicit no-guarantee framing, or qualitative impact tiers (CROA results-representation risk).
- [ ] Inquiry batches: require client attestation ("I did not apply with X") before an inquiry enters a dispute batch (`dispute-triage.ts:139-147`), mirroring the ownership-claim gate.

### P3 Doc-sync checklist
- [ ] `docs/SECONDARY-BUREAUS-AND-CREDITOR-ANALYTICS.md` — new flows and the triage wiring.
- [ ] `docs/response-clock.md` — mail-tracking-driven SLA start.
- [ ] `docs/plans/credit-repair-platform-roadmap.md` — reconcile roadmap with what shipped.
- [ ] `docs/agents/domain.md` — new detectors, medical rule pack, CFPB packet flow.
- [ ] This file — status, Change Log.

---

## Standing constraints (apply to every phase)

1. **Accuracy-first posture:** the system disputes inaccurate/unverifiable information; it never asserts ownership denial, identity theft, or "never late" without the confirmed reason code + evidence gate (`dispute-compliance-policy.ts`, `dispute-policy-decision.ts`). Nothing in this plan weakens those gates.
2. **Metro 2 legal framing:** Metro 2 is a CDIA industry format, not a statute. Letters cite FCRA §607(b)/§611/§623/§605 as the legal hook and use Metro 2 inconsistencies as *evidence* of inaccuracy — never "Metro 2 violation, therefore delete."
3. **Human-in-the-loop:** auto-generated escalations stay `draft` + review task; the letter lint may block but never auto-send.
4. **Definition of done per task:** code + tests + `npm run validate` green + doc-sync items for the phase.

---

## Change Log

| Date | Phase | Summary | Docs updated |
|------|-------|---------|--------------|
| 2026-07-14 | — | Plan created from code-only review | — |
| 2026-07-14 | P0 | Fixed FCRA clock source hierarchy, removed false balance violations, stopped fabricated account-number leakage, added escalation reason-code coverage, and preserved parser-authored remarks with separate completeness fields | `docs/CREDIT-ANALYSIS-IMPLEMENTATION.md`, `docs/METRO2-VIOLATION-FIX-SUMMARY.md`, `docs/adr/0003-fcra-clock-source-of-truth.md`, `src/lib/AGENTS.md` |
