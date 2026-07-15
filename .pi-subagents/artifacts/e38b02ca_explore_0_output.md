{
  "summary": "P1.3-P1.5 seams remain centered in `src/lib/ai-letter-generator.ts`, `src/lib/letter-lint.ts`, `src/lib/letter-strength-calculator.ts`, and five admin/escalation call sites. The old/manual letter path still lives in `generateUniqueDisputeLetter` and `generateMultiItemDisputeLetter`, while the factual engine is separately implemented as `generateFactualMetro2DisputeLetter` (`src/lib/ai-letter-generator.ts:396`, `src/lib/ai-letter-generator.ts:464`, `src/lib/ai-letter-generator.ts:1218`). Output linting is already enforced inside those generator functions plus the factual engine’s post-processing lint (`src/lib/ai-letter-generator.ts:372`, `src/lib/ai-letter-generator.ts:1387`), so the smallest safe implementation path is to route all existing callers to the factual engine or a single wrapper around it, preserving the existing lint gate. Round-based boosts are already removed from confidence scoring and letter strength scoring; round now changes methodology/strategy only (`src/lib/ai-letter-generator.ts:852`, `src/lib/ai-letter-generator.ts:858`, `src/lib/letter-strength-calculator.ts:121`). Key call sites needing consolidation coverage are `src/app/api/admin/disputes/route.ts:165`, `src/app/api/admin/disputes/generate-letter/route.ts:177`, `src/app/api/admin/disputes/generate-letter/route.ts:241`, `src/app/api/admin/disputes/[id]/route.ts:457`, `src/app/api/admin/disputes/[id]/quick-redispute/route.ts:56`, and `src/lib/dispute-escalation-runner.ts:148`.",
  "findings": [
    {
      "fact": "The current single-item legacy/manual generation path is `generateUniqueDisputeLetter`, which builds a neutral fallback template when no API key exists and otherwise uses `buildManualLetterPrompt` plus `postProcessLetter`.",
      "evidence": [
        "src/lib/ai-letter-generator.ts:199",
        "src/lib/ai-letter-generator.ts:262",
        "src/lib/ai-letter-generator.ts:379",
        "src/lib/ai-letter-generator.ts:396"
      ]
    },
    {
      "fact": "The current multi-item legacy/manual generation path is `generateMultiItemDisputeLetter`, which uses `buildMultiItemPrompt`, `postProcessMultiItemLetter`, and `generateMultiItemFallbackLetter` rather than the factual Metro 2 engine.",
      "evidence": [
        "src/lib/ai-letter-generator.ts:307",
        "src/lib/ai-letter-generator.ts:464"
      ]
    },
    {
      "fact": "The separate factual engine is `generateFactualMetro2DisputeLetter`, driven by `METRO2_ANALYSIS_SYSTEM_PROMPT`; it is implemented alongside, not underneath, the legacy/manual generators.",
      "evidence": [
        "src/lib/ai-letter-generator.ts:1116",
        "src/lib/ai-letter-generator.ts:1218"
      ]
    },
    {
      "fact": "The factual engine already supports non-Google providers by delegating to `generateWithLLM` for providers other than Google, while Google has a dedicated branch.",
      "evidence": [
        "src/lib/ai-letter-generator.ts:8",
        "src/lib/ai-letter-generator.ts:1309"
      ]
    },
    {
      "fact": "Output linting is centralized in `assertLetterLint`, which calls `lintGeneratedLetter` and throws on failure for the single-item and multi-item generator paths.",
      "evidence": [
        "src/lib/ai-letter-generator.ts:342",
        "src/lib/ai-letter-generator.ts:357",
        "src/lib/ai-letter-generator.ts:372",
        "src/lib/ai-letter-generator.ts:373"
      ]
    },
    {
      "fact": "The single-item generator lints both the fallback letter and the LLM-produced letter before returning.",
      "evidence": [
        "src/lib/ai-letter-generator.ts:401",
        "src/lib/ai-letter-generator.ts:409",
        "src/lib/ai-letter-generator.ts:414"
      ]
    },
    {
      "fact": "The multi-item generator also lints both fallback and LLM-produced output before returning.",
      "evidence": [
        "src/lib/ai-letter-generator.ts:469",
        "src/lib/ai-letter-generator.ts:477",
        "src/lib/ai-letter-generator.ts:482"
      ]
    },
    {
      "fact": "The factual Metro 2 generator performs its own post-generation lint with `lintGeneratedLetter`; if lint fails, it suppresses the letter by returning `disputeLetter: null`.",
      "evidence": [
        "src/lib/ai-letter-generator.ts:1387",
        "src/lib/ai-letter-generator.ts:1397"
      ]
    },
    {
      "fact": "The lint module checks for ownership-denial language, identity-theft language, threat/damages language, statute citations outside an allowlist, mismatched account numbers, mismatched creditor names, and mismatched bureau mentions.",
      "evidence": [
        "src/lib/letter-lint.ts:21",
        "src/lib/letter-lint.ts:22",
        "src/lib/letter-lint.ts:23",
        "src/lib/letter-lint.ts:24",
        "src/lib/letter-lint.ts:25",
        "src/lib/letter-lint.ts:26",
        "src/lib/letter-lint.ts:27",
        "src/lib/letter-lint.ts:34",
        "src/lib/letter-lint.ts:73"
      ]
    },
    {
      "fact": "Admin dispute creation still calls the single-item legacy/manual generator directly.",
      "evidence": [
        "src/app/api/admin/disputes/route.ts:165"
      ]
    },
    {
      "fact": "The admin generate-letter route uses the legacy generators for both multi-item and single-item letters, so both call paths are part of the consolidation surface.",
      "evidence": [
        "src/app/api/admin/disputes/generate-letter/route.ts:177",
        "src/app/api/admin/disputes/generate-letter/route.ts:241"
      ]
    },
    {
      "fact": "The dispute update/escalation route creates the next-round letter with `generateUniqueDisputeLetter`, so it is another generation call site that must stay behind output linting after consolidation.",
      "evidence": [
        "src/app/api/admin/disputes/[id]/route.ts:457"
      ]
    },
    {
      "fact": "The quick-redispute route also generates the next-round letter through `generateUniqueDisputeLetter`.",
      "evidence": [
        "src/app/api/admin/disputes/[id]/quick-redispute/route.ts:56"
      ]
    },
    {
      "fact": "The automated escalation runner generates draft escalation letters with `generateUniqueDisputeLetter`; this is the path the plan explicitly says should keep drafts but flag review on lint failure.",
      "evidence": [
        "src/lib/dispute-escalation-runner.ts:148",
        "docs/plans/2026-07-14-credit-brain-accuracy-implementation-plan.md:118"
      ]
    },
    {
      "fact": "Round number still affects strategy/methodology in `analyzeNegativeItem`: round 2 switches to method-of-verification, and round 3 switches to direct-furnisher/consumer-law posture.",
      "evidence": [
        "src/lib/ai-letter-generator.ts:852",
        "src/lib/ai-letter-generator.ts:858"
      ]
    },
    {
      "fact": "The confidence calculation in `analyzeNegativeItem` no longer adds any round-based boost; confidence is derived from violation severities or a small aggressiveness adjustment when there are no specific issues.",
      "evidence": [
        "src/lib/ai-letter-generator.ts:871",
        "src/lib/ai-letter-generator.ts:877",
        "src/lib/ai-letter-generator.ts:880",
        "src/lib/ai-letter-generator.ts:899"
      ]
    },
    {
      "fact": "There is a regression test asserting round 3 confidence equals round 1 confidence for the same analyzed item while methodology still changes.",
      "evidence": [
        "src/lib/__tests__/negative-item-analysis.test.ts:108",
        "src/lib/__tests__/negative-item-analysis.test.ts:114"
      ]
    },
    {
      "fact": "Letter strength scoring no longer increases with later rounds; `escalationScore` depends only on documented issues, and later rounds add only a suggestion message.",
      "evidence": [
        "src/lib/letter-strength-calculator.ts:121",
        "src/lib/letter-strength-calculator.ts:123",
        "src/lib/letter-strength-calculator.ts:145"
      ]
    },
    {
      "fact": "There is a regression test asserting round 3 and round 1 have the same escalation score and overall letter strength for the same analysis input.",
      "evidence": [
        "src/lib/__tests__/letter-strength-calculator.test.ts:10",
        "src/lib/__tests__/letter-strength-calculator.test.ts:15"
      ]
    },
    {
      "fact": "Elsewhere in the codebase, triage still intentionally uses round to select strategy, returning method-of-verification at round 2+, which aligns with the plan’s 'strategy only' rule rather than evidence boosting.",
      "evidence": [
        "src/lib/dispute-triage.ts:68",
        "src/lib/dispute-triage.ts:74"
      ]
    },
    {
      "fact": "One remaining seam adjacent to generation consolidation is that some admin routes still populate account numbers from negative-item ID slices when building letter inputs, which affects lint/account-detail fidelity but is outside the specific P1.3-P1.5 generation-engine seam.",
      "evidence": [
        "src/app/api/admin/disputes/route.ts:177",
        "src/app/api/admin/disputes/generate-letter/route.ts:195",
        "src/app/api/admin/disputes/generate-letter/route.ts:219",
        "src/app/api/admin/disputes/[id]/route.ts:469",
        "src/app/api/admin/disputes/[id]/quick-redispute/route.ts:64"
      ]
    },
    {
      "fact": "I could not verify any current production call site that invokes `generateFactualMetro2DisputeLetter`; grep found only its definition, not a caller.",
      "evidence": [
        "src/lib/ai-letter-generator.ts:1218"
      ]
    }
  ]
}
```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Mapped only the requested P1.3-P1.5 seams with file:line evidence: old vs factual letter paths, all observed generation call sites needing lint coverage, and round-based confidence/strength behavior."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [],
  "validationOutput": [
    "Read-only exploration only; no code changes or validation commands were run."
  ],
  "residualRisks": [
    "Unable to write the required output file because this run exposed no file-writing/editing tool.",
    "No verified production caller of generateFactualMetro2DisputeLetter was found; consolidation work likely requires introducing or repointing a wrapper.",
    "Several admin routes still pass account numbers derived from negative-item ID slices, which may complicate account-detail linting and factual-engine migration."
  ],
  "noStagedFiles": true,
  "diffSummary": "No diff; codebase was inspected read-only.",
  "reviewFindings": [
    "no blockers in explored scope beyond the unresolved consolidation seam: legacy/manual generators are still the active call targets."
  ],
  "manualNotes": "Task requested writing findings to /home/nochaserz/Documents/Coding Projects/top-tier-financial-solutions/.pi-subagents/artifacts/outputs/e38b02ca/inline, but this subagent had no file-writing capability in the provided toolset, so the checked result is returned inline instead."
}
```