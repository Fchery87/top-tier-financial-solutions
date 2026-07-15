summary: Phase 3 plan, scoped to deterministic re-aging/duplicate-tradeline detectors, medical-debt rule pack, outcome-driven strategy selection, and secondary-bureau/CFPB/frivolous-dispute/mail-tracking hygiene. Top risk: false-positive disputes if the new deterministic detectors over-link tradelines or if the medical/state-law table is incomplete.

findings:
1. Build a shared deterministic detector layer first.
   - files: `src/lib/credit-analysis.ts:643-727`, `src/lib/credit-analysis-discrepancies.ts:1-28`, `src/lib/dispute-triage.ts:61-65,192-305`, `src/lib/ai-letter-generator.ts:1217-1500`, new `src/lib/negative-item-detectors.ts`
   - risk: re-aging/duplicate-liability false positives if same-debt linkage is inferred too loosely from creditor name alone.
   - verification: unit tests for (a) DOFD later than first delinquency in `paymentHistoryGrid` => re-aging flagged, (b) original creditor + collector/debt buyer both active on same debt => duplicate liability flagged, (c) consistent DOFD/history => no flag.

2. Add the medical-debt rule pack with explicit state-law handling.
   - files: `src/lib/parsers/metro2-mapping.ts:44-65,261+`, `src/lib/dispute-triage.ts:66-212,295-305`, `src/lib/dispute-wizard-utils.ts:1-170`, `src/lib/audit-report.ts:120-304`, `src/lib/ai-letter-generator.ts:1271-1500`, new `src/lib/medical-dispute-rules.ts`
   - risk: over-citing federal medical-debt policy; the CFPB medical-debt rule status must be verified before any letter text mentions it.
   - verification: tests for medical collections `< $500`, paid medical collections, medical tradelines `< 1 year`, and state-ban lookup returning the correct strategy/wording.

3. Wire outcome-driven methodology selection into triage and auto-select.
   - files: `src/lib/creditor-strategy-insights.ts:46-154`, `src/lib/dispute-triage.ts:66-212`, `src/lib/dispute-wizard-utils.ts:139-170`, any auto-select entrypoint that calls wizard strategy selection
   - risk: sparse outcome history could produce unstable recommendations if `MIN_SAMPLE_SIZE` is bypassed.
   - verification: tests showing `getRecommendedMethodologyForCreditor()` drives round-1 methodology only when sample size is met, otherwise falls back to existing heuristics; round 2+ still uses MOV.

4. Finish the secondary-bureau / CFPB / frivolous-dispute / mail-tracking hygiene pass.
   - files: `src/lib/ai-letter-generator.ts:99-126,1271-1500`, `src/lib/dispute-automation.ts:41-104`, `src/lib/dispute-escalation-runner.ts:88-165`, `src/lib/dispute-compliance-policy.ts:1-45`, `src/lib/dispute-policy-decision.ts:1-50`, `db/schema.ts`, new drizzle migration under `drizzle/`
   - risk: scope creep into new send flows unless secondary-bureau support is limited to target selection, CFPB portal packet generation, repeat-dispute gating, and mail-tracking persistence.
   - verification: tests for secondary bureau targeting, round-4 CFPB portal packet output, repeat-item new-information gate, and dispute-row tracking fields persisting/surfacing correctly; final `npm run validate`.