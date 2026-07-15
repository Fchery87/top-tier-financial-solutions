# Task for build

Complete the remaining Phase 2 work with minimal diffs and full verification. Prioritize: (1) finish payment-history grid wiring only where it is actually consumed, (2) enforce parser-review gating across downstream dispute/letter flows that can still run on unapproved reports, (3) harden structured LLM output in src/lib/ai-letter-generator.ts to avoid blind JSON.parse/cleanup fallback and centralize any remaining model defaults in src/lib/settings-service.ts, and (4) harden findDerogatoryMatch confidence calculation in src/lib/credit-analysis.ts. Keep changes small and preserve existing behavior where possible. After editing, run targeted tests for affected flows, then npm run typecheck, then lint on touched files, and summarize exact files changed plus remaining risks.

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