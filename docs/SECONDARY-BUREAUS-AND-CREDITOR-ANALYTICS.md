# Secondary Bureau Disputes, Per-Creditor Strategy Analytics, and FCRA Accuracy Fixes

**Date:** June 11, 2026
**Status:** Complete (commit `567f1a2`)

---

## Overview

This release closes two competitive gaps identified in the June 2026 market audit — secondary consumer reporting agency disputes and per-creditor strategy success learning — and fixes four accuracy issues in the dispute, triage, scoring, and re-analysis paths.

> **Update (2026-07-15):** The Phase 3 implementation now also adds deterministic re-aging / duplicate-liability detection, medical-debt rule wiring, CFPB packet routing, and report-aware triage/auto-select recommendation flows.

---

## 1. Secondary Bureau Dispute Support

Disputes can now target four secondary consumer reporting agencies in addition to the big-3 bureaus. All addresses were verified June 2026 against each agency's consumer site and the CFPB consumer reporting company list.

| Key | Agency | Dispute Address |
|-----|--------|-----------------|
| `lexisnexis` | LexisNexis Risk Solutions | Consumer Center, P.O. Box 105108, Atlanta, GA 30348-5108 |
| `innovis` | Innovis | Consumer Assistance, P.O. Box 530088, Atlanta, GA 30353-0088 |
| `chexsystems` | ChexSystems | Attn: Consumer Relations, P.O. Box 583399, Minneapolis, MN 55458 |
| `ews` | Early Warning Services | Attn: Consumer Services, 5801 N. Pima Road, Scottsdale, AZ 85250 |

Note the Innovis and ChexSystems addresses differ from the older Pittsburgh/Woodbury addresses still circulating in templates elsewhere.

### Where they are wired in

- `config/dispute-strategies.yaml` — `bureaus:` section entries with phone, online dispute URL, requirements, and response timeframe.
- `src/lib/dispute-config-loader.ts` — same entries in the built-in default config used when the YAML is unavailable.
- `src/lib/ai-letter-generator.ts` — `BUREAU_ADDRESSES` fallback table used during letter rendering.
- `src/components/admin/dispute-wizard/types.ts` — `SECONDARY_BUREAUS` constant and `isSecondaryBureau()` helper.
- `src/components/admin/dispute-wizard/StepConfigure.tsx` — optional "Secondary Agencies" selector under the bureau selection.
- `db/schema.ts` — `disputes.bureau` accepts the four new keys (text column; comment updated).

### Item-scoping semantics

Negative items are tracked per big-3 bureau (`onTransunion` / `onExperian` / `onEquifax`). Secondary CRAs aggregate from furnishers rather than mirroring big-3 tradelines, so `itemAppearsOnBureau()` treats every selected item as in scope for a secondary-agency letter. The intended use is sending verification/suppression disputes after big-3 deletions so removed data does not resurface through LexisNexis, Innovis, or the banking-history agencies.

### Phase 3 detector and medical-rule additions

- `src/lib/negative-item-detectors.ts` adds deterministic re-aging detection (reported DOFD later than the first late month in persisted payment history) and duplicate-liability grouping across related tradelines.
- `src/lib/dispute-triage.ts` now surfaces Phase 3 quick actions for potential re-aged items and duplicate liability alongside the existing discrepancy and obsolescence actions.
- `src/lib/medical-dispute-rules.ts` provides medical-debt-specific recommendation logic, including under-$500 medical debt, paid medical collections, younger-than-one-year medical debt, and state-law restriction notes.
- Triage methodology selection remains deterministic: historical creditor methodology is advisory-only and falls back to standard factual / debt-validation / MOV heuristics.
- CFPB routing is now exposed in the dispute wizard as a complaint-packet flow rather than a bureau-style letter destination.

---

## 2. Per-Creditor Strategy Success Analytics

The platform now learns which dispute methodology historically works against each creditor, computed from recorded `dispute_outcomes` rows.

### Library: `src/lib/creditor-strategy-insights.ts`

- `buildCreditorStrategyInsights(rows)` aggregates outcomes into per-creditor, per-methodology stats (`deleted`, `updated`, `verified`, `frivolous`, `no_response`, success rate).
- Creditor names are normalized (`normalizeCreditorName`) so variants like "Midland Credit Mgmt." and "MIDLAND CREDIT MGMT" group together.
- `deleted` and `updated` count as success; everything else does not.
- A methodology is recommended only when it has at least `MIN_SAMPLE_SIZE` (3) recorded outcomes **and** at least one success.
- `getRecommendedMethodologyForCreditor(name, summary)` resolves a recommendation through normalization.

**Advisory only:** recommendations never override the deterministic policy engine. Policy approval, evidence requirements, and claim-risk rules still gate every letter.

### Surfaces

- `GET /api/admin/disputes/insights/creditor-strategies` — full per-creditor breakdown plus a `recommendationsByCreditor` lookup map. Super-admin only.
- `POST /api/admin/disputes/triage` — response now includes `historicalRecommendations`, a map of negative-item ID to the historically best methodology for that item's creditor. Loading the history is best-effort; triage succeeds without it.
- `POST /api/admin/disputes/auto-select` — round-1 recommended methodology now prefers historically successful creditor methodology when enough samples exist; static batch heuristics remain fallback.

### Tests

`src/lib/__tests__/creditor-strategy-insights.test.ts` covers name normalization, variant grouping, success-rate math, the minimum-sample threshold, the never-succeeded exclusion, and lookup behavior.

---

## 3. FCRA / Accuracy Fixes

### Obsolescence clock uses DOFD, not report date

The FCRA 7-year reporting clock runs from the Date of First Delinquency. `src/lib/dispute-triage.ts` now exposes `getObsolescenceBaseDate(item)`, preferring `dateOfFirstDelinquency` > `dateOfLastActivity` > `dateReported`, and the "Items Approaching 7-Year Limit" quick action uses it. The triage route passes `dateOfLastActivity` through; the `dateOfFirstDelinquency` field is plumbed and ready if DOFD is later added to `negative_items` parsing (it currently lives on `fcra_compliance_items`).

### Letter strength scoring favors strictly-factual methodologies

`src/lib/letter-strength-calculator.ts` keeps methodology scoring factual-first: `factual` and `metro2_compliance` score 1.0, `method_of_verification` 0.9, and `debt_validation` 0.8.

### Re-analysis no longer wipes other reports' compliance items

`src/lib/credit-analysis.ts` previously deleted `fcra_compliance_items` by `clientId` during re-analysis, destroying compliance items derived from the client's other reports. It now deletes only the rows linked to the report being re-analyzed (resolved through `negative_items.creditReportId`, ordered before the negative items are deleted so the FK does not null out first), plus a sweep of rows orphaned before this scoping existed.

### Current LLM fallback model IDs

Fallback model defaults (used only when admin LLM settings do not specify a model) were updated in `src/lib/ai-letter-generator.ts` and `src/app/api/admin/settings/llm/test/route.ts`: the retired `claude-3-5-sonnet-20241022` is now `claude-sonnet-4-6`, and `gpt-4o` is now `gpt-5`.

---

## Verified Reference Data (June 2026)

- Big-3 dispute mailing addresses (TransUnion Chester PA, Experian Allen TX, Equifax Atlanta GA) verified current against each bureau's own site — no changes required.
- `FCRA_REPORTING_LIMITS` in `src/lib/parsers/metro2-mapping.ts` verified correct (Ch. 7 bankruptcy 10 years, Ch. 13 7 years, civil judgments and unpaid tax liens no longer reported, hard inquiries 2 years).

## Known Follow-Up

The provider HTML parsers (IdentityIQ, SmartCredit, MyScoreIQ, PrivacyGuard — last modified December 2025) could not be validated without fresh sample reports. Run a re-validation pass with current report samples from each service and watch for parse failures on the next real imports.
