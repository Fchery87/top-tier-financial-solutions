# Task for build

Begin Phase 1.1 implementation in /home/nochaserz/Documents/Coding Projects/top-tier-financial-solutions with a minimal first slice after planning/recon. Implement the first code changes that set up evidence-based per-bureau account data for tri-merge reports, focusing on the safest/highest-leverage seam: (1) extend shared parser types in src/lib/parsers/pdf-parser.ts to carry per-bureau account evidence for tradelines, (2) wire IdentityIQ parser to emit that richer per-bureau account evidence from its existing tri-merge extraction, and (3) refactor the credit-account ingest path in src/lib/credit-analysis.ts to use parser-provided per-bureau evidence when available instead of defaulting combined reports to all bureaus. Do not broaden to SmartCredit/MyScoreIQ yet unless necessary for type compatibility. Add/update targeted tests for the new IdentityIQ evidence and ingest behavior. Run targeted tests, typecheck, and lint on touched files. Report exact files changed, what remains for P1.1, and any risks/blockers.

---
**Output:**
Write your findings to exactly this path: /home/nochaserz/Documents/Coding Projects/top-tier-financial-solutions/.pi-subagents/artifacts/outputs/28488c73/inline
This path is authoritative for this run.
Ignore any other output filename or output path mentioned elsewhere, including output destinations in the base agent prompt, system prompt, or task instructions.

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