# Task for build

Close out remaining P0 gaps in /home/nochaserz/Documents/Coding Projects/top-tier-financial-solutions so we can determine if docs/plans/2026-07-14-credit-brain-accuracy-implementation-plan.md Phase 0 is truly complete. Focus on: (1) remove any remaining ID-derived account number fallback in ai-letter-generator Metro2 formatting, (2) verify and implement IdentityIQ DOFD / bureau removal-date extraction if missing, (3) verify schema/migration support for completenessScore/missingFields/dofdConfidence and add missing migration files if needed, (4) confirm/fix balance-over-limit rule scope to revolving-only if the current code is broader than intended. Add or update tests as needed. Run targeted verification commands and report exact evidence, changed files, and any remaining blockers. Keep diff minimal.

---
**Output:**
Write your findings to exactly this path: /home/nochaserz/Documents/Coding Projects/top-tier-financial-solutions/.pi-subagents/artifacts/outputs/e7520e78/inline
This path is authoritative for this run.
Ignore any other output filename or output path mentioned elsewhere, including output destinations in the base agent prompt, system prompt, or task instructions.

## Acceptance Contract
Acceptance level: reviewed
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Implement the requested change without widening scope
- criterion-2: Return evidence sufficient for an independent acceptance review

Required evidence: changed-files, tests-added, commands-run, validation-output, residual-risks, no-staged-files

Review gate: required by reviewer.

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