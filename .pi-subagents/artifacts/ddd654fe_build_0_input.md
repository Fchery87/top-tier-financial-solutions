# Task for build

Complete all remaining Phase 2 work in this repo, building on existing in-progress P2.3 parser/date hardening. Scope is docs/plans/2026-07-14-credit-brain-accuracy-implementation-plan.md P2.1-P2.5 and P2 doc-sync. Constraints: use parserReviewStatus as the canonical needs_review gate; keep parseStatus as pending|processing|completed|failed. Implement remaining work with minimal diffs and verify thoroughly. Specifically finish: (1) fixture corpus + routing/golden coverage for identityiq, smartcredit, privacyguard, myscoreiq, annualcreditreport, transunion, experian, equifax, generic HTML, and PDF detection; (2) parse-quality gate with needs_review/approved workflow, admin queue surfacing, and blocking of downstream analysis/letters/compare flows until approved; (3) persist payment-history grids through parser -> DB -> analysis/LLM payload where feasible, using one canonical storage shape; (4) provider-native structured LLM output in factual letter generation and centralize model defaults in settings-service; (5) fuzzy matching hardening in credit-analysis to prefer account-number-last4 then name+amount and record match confidence on row if schema seam is needed; (6) run tests, typecheck, lint, build/db generate as relevant; (7) complete doc sync for P2 and update plan status/change log only if Phase 2 is truly complete. Be careful with pre-existing worktree noise; touch only files required for P2. Return concrete evidence and residual risks.

## Acceptance Contract
Acceptance level: checked
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope

Required evidence: changed-files, tests-added, commands-run, residual-risks, no-staged-files

Finish with a fenced JSON block tagged `acceptance-report` in this shape:
Use empty arrays when no items apply; array fields contain strings unless object entries are shown.
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "specific proof"
    }
  ],
  "changedFiles": [
    "src/file.ts"
  ],
  "testsAddedOrUpdated": [
    "test/file.test.ts"
  ],
  "commandsRun": [
    {
      "command": "command",
      "result": "passed",
      "summary": "short result"
    }
  ],
  "validationOutput": [
    "validation output or concise summary"
  ],
  "residualRisks": [
    "none"
  ],
  "noStagedFiles": true,
  "diffSummary": "short description of the diff",
  "reviewFindings": [
    "blocker: file.ts:12 - issue found, or no blockers"
  ],
  "manualNotes": "anything else the parent should know"
}
```