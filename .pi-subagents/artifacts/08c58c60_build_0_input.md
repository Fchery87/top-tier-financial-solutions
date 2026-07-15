# Task for build

Implement Phase 3 end-to-end with minimal safe diffs. Priorities: (1) add deterministic re-aging and duplicate-liability detectors, consuming persisted paymentHistoryGrid and originalCreditor links; wire into triage/analysis/letter inputs with tests. (2) add medical-debt rule pack and state-law handling with a conservative default and tests. (3) wire outcome-driven methodology selection into triage/auto-select with MIN_SAMPLE_SIZE fallback and tests. (4) finish secondary-bureau / CFPB / frivolous-dispute hygiene: secondary bureau targeting where appropriate, CFPB portal packet for round 4, repeat-dispute new-information gate, mail tracking fields/surface, and audit-report score projection conservatism. Update docs only if code is verified. Run targeted tests, typecheck, lint, and build. Summarize files changed, verification, and remaining risks.

## Acceptance Contract
Acceptance level: attested
Completion is not accepted from prose alone. End with a structured acceptance report.

Criteria:
- criterion-1: Return concrete findings with file paths and severity when applicable

Required evidence: review-findings, residual-risks

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