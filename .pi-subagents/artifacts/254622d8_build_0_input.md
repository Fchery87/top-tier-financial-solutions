# Task for build

Continue Phase 1.1 in /home/nochaserz/Documents/Coding Projects/top-tier-financial-solutions with the next implementation slice. Extend SmartCredit and MyScoreIQ parsers to emit ParsedAccount.bureauEvidence for combined/tri-merge reports where bureau context is available, then tighten account ingest behavior so combined reports without parser evidence no longer blindly imply all bureaus unless there is a strong single-bureau basis. Keep the diff minimal and avoid broad UI/discrepancy work in this slice. Add/update targeted tests for parser bureauEvidence and ingest fallback behavior. Run targeted tests, typecheck, and lint on touched files. Report changed files, exact verification results, what remains for P1.1, and any blockers/risks.

---
**Output:**
Write your findings to exactly this path: /home/nochaserz/Documents/Coding Projects/top-tier-financial-solutions/.pi-subagents/artifacts/outputs/254622d8/inline
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