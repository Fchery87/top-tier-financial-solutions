summary:
  directAnswer:
    - "Phase 3 is only partially wired. The repo already has standalone detector/rule modules for re-aging, duplicate liability, and medical debt, plus creditor outcome analytics, but those modules are not integrated into the triage/auto-select/wizard paths that currently drive recommendations."
    - "Minimal edit set appears to be: `src/lib/dispute-triage.ts`, `src/app/api/admin/disputes/triage/route.ts`, `src/components/admin/dispute-wizard/hooks/useDisputeMethodologies.ts`, `src/components/admin/dispute-wizard/hooks/useDisputeAutoSelection.ts`, `src/components/admin/dispute-wizard/WizardContext.tsx`, `src/app/api/admin/disputes/auto-select/route.ts`, and likely `src/lib/ai-letter-generator.ts` plus dispute submission/API files for CFPB/frivolous/mail-tracking hygiene."
    - "I could not write this to `/home/nochaserz/Documents/Coding Projects/top-tier-financial-solutions/.pi-subagents/artifacts/outputs/dc14a3e6/inline` because this run exposed no file-write tool and the role is read-only."

  keyLocations:
    - "Detectors exist but are unused: `src/lib/negative-item-detectors.ts:62`, `src/lib/negative-item-detectors.ts:82`, `src/lib/negative-item-detectors.ts:110`"
    - "Medical rules exist but are unused: `src/lib/medical-dispute-rules.ts:36`, `src/lib/medical-dispute-rules.ts:84`"
    - "Current triage logic is still heuristic-only: `src/lib/dispute-triage.ts:66`, `src/lib/dispute-triage.ts:212`, `src/lib/dispute-triage.ts:281`, `src/lib/dispute-triage.ts:301`, `src/lib/dispute-triage.ts:313`, `src/lib/dispute-triage.ts:328`"
    - "Outcome-history recommendations are computed but not wired into triage summary/wizard recommendation flow: `src/app/api/admin/disputes/triage/route.ts:68`, `src/app/api/admin/disputes/triage/route.ts:78`, `src/app/api/admin/disputes/triage/route.ts:93`"
    - "Wizard methodology recommendation still uses only collection/round heuristics: `src/lib/dispute-wizard-utils.ts:141`, `src/lib/dispute-wizard-utils.ts:149`, `src/lib/dispute-wizard-utils.ts:153`, `src/lib/dispute-wizard-utils.ts:158`, `src/components/admin/dispute-wizard/hooks/useDisputeMethodologies.ts:52`, `src/components/admin/dispute-wizard/hooks/useDisputeMethodologies.ts:59`, `src/components/admin/dispute-wizard/hooks/useDisputeMethodologies.ts:60`, `src/components/admin/dispute-wizard/hooks/useDisputeMethodologies.ts:65`"
    - "Secondary bureau UI exists; CFPB escalation exists in automation; submission tracking exists; target-recipient typings/schema are still inconsistent: `src/components/admin/dispute-wizard/StepConfigure.tsx:170`, `src/lib/dispute-automation.ts:69`, `src/lib/dispute-automation.ts:101`, `src/components/admin/dispute-wizard/types.ts:126`, `db/schema.ts:743`, `db/schema.ts:784`, `db/schema.ts:790`, `db/schema.ts:836`, `db/schema.ts:900`, `db/schema.ts:915`"

findings:
  - fact: "Deterministic re-aging detection is implemented in a shared module via `detectReaging`, which compares first-late month from `paymentHistoryGrid` against reported DOFD."
    evidence:
      - "src/lib/negative-item-detectors.ts:49"
      - "src/lib/negative-item-detectors.ts:62"

  - fact: "Deterministic duplicate-liability detection is also implemented in the same shared module via `detectDuplicateLiability`, grouping items by normalized original creditor / creditor name plus last-4 account number."
    evidence:
      - "src/lib/negative-item-detectors.ts:19"
      - "src/lib/negative-item-detectors.ts:82"
      - "src/lib/negative-item-detectors.ts:110"

  - fact: "No in-repo references were found to `detectReaging` or `detectDuplicateLiability` outside their defining file, so the detector layer exists but is not integrated into the rest of the codebase."
    evidence:
      - "src/lib/negative-item-detectors.ts:62"
      - "src/lib/negative-item-detectors.ts:82"

  - fact: "Current triage strategy selection does not call the detector module; it only switches by `itemType` and dispute round."
    evidence:
      - "src/lib/dispute-triage.ts:66"
      - "src/lib/dispute-triage.ts:212"

  - fact: "Current triage quick actions cover collections, approaching-obsolete items, high-severity items, and bureau discrepancies only; there are no quick actions for re-aging or duplicate liability."
    evidence:
      - "src/lib/dispute-triage.ts:281"
      - "src/lib/dispute-triage.ts:301"
      - "src/lib/dispute-triage.ts:313"
      - "src/lib/dispute-triage.ts:328"

  - fact: "The triage API builds a `triageReady` item shape without `paymentHistoryGrid`, `originalCreditor`, or `accountNumber`, so it does not currently supply the detector inputs needed by `negative-item-detectors.ts`."
    evidence:
      - "src/app/api/admin/disputes/triage/route.ts:64"
      - "src/lib/negative-item-detectors.ts:19"

  - fact: "Medical-debt rules already exist in `src/lib/medical-dispute-rules.ts`, including state restriction notes and reason-code generation."
    evidence:
      - "src/lib/medical-dispute-rules.ts:16"
      - "src/lib/medical-dispute-rules.ts:36"
      - "src/lib/medical-dispute-rules.ts:84"

  - fact: "No in-repo references were found to `getMedicalRuleRecommendation` or `listMedicalReasonCodes` outside their defining file, so the medical rules are present but not wired into triage, auto-select, or wizard flows."
    evidence:
      - "src/lib/medical-dispute-rules.ts:36"
      - "src/lib/medical-dispute-rules.ts:84"

  - fact: "Metro 2 parsing already recognizes medical debt categories, which is a viable upstream hook for medical-rule application."
    evidence:
      - "src/lib/parsers/metro2-mapping.ts:58"
      - "src/lib/parsers/metro2-mapping.ts:69"
      - "src/lib/parsers/metro2-mapping.ts:278"
      - "src/lib/parsers/metro2-mapping.ts:279"

  - fact: "The default wizard/shared methodology recommendation still uses only a simple heuristic: round 1 collection => `debt_validation`, round 2+ => `method_of_verification`, else `factual`."
    evidence:
      - "src/lib/dispute-wizard-utils.ts:141"
      - "src/lib/dispute-wizard-utils.ts:149"
      - "src/lib/dispute-wizard-utils.ts:153"
      - "src/lib/dispute-wizard-utils.ts:158"

  - fact: "The active wizard hook duplicates that same simple heuristic and updates `recommendedMethodology` from it."
    evidence:
      - "src/components/admin/dispute-wizard/hooks/useDisputeMethodologies.ts:52"
      - "src/components/admin/dispute-wizard/hooks/useDisputeMethodologies.ts:59"
      - "src/components/admin/dispute-wizard/hooks/useDisputeMethodologies.ts:60"
      - "src/components/admin/dispute-wizard/hooks/useDisputeMethodologies.ts:65"

  - fact: "Per-creditor outcome analytics are implemented and gate recommendations by `MIN_SAMPLE_SIZE = 3`."
    evidence:
      - "src/lib/creditor-strategy-insights.ts:41"
      - "src/lib/creditor-strategy-insights.ts:62"
      - "src/lib/creditor-strategy-insights.ts:130"
      - "src/lib/creditor-strategy-insights.ts:154"

  - fact: "The triage API computes `historicalRecommendations` per item using those creditor insights, but the returned triage summary itself is not modified by them."
    evidence:
      - "src/app/api/admin/disputes/triage/route.ts:68"
      - "src/app/api/admin/disputes/triage/route.ts:78"
      - "src/app/api/admin/disputes/triage/route.ts:80"
      - "src/app/api/admin/disputes/triage/route.ts:93"

  - fact: "The wizard triage fetcher currently reads only `quickActions` from the triage API response, so the API's `historicalRecommendations` payload is not consumed in the wizard."
    evidence:
      - "src/components/admin/dispute-wizard/hooks/useDisputeIntelligence.ts:45"
      - "src/components/admin/dispute-wizard/hooks/useDisputeIntelligence.ts:55"

  - fact: "Wizard auto-select uses the AI batch-analysis endpoint, not the triage endpoint, and it directly applies `summary.recommendedMethodology` from auto-select."
    evidence:
      - "src/components/admin/dispute-wizard/hooks/useDisputeAutoSelection.ts:48"
      - "src/components/admin/dispute-wizard/hooks/useDisputeAutoSelection.ts:80"
      - "src/components/admin/dispute-wizard/hooks/useDisputeAutoSelection.ts:81"
      - "src/components/admin/dispute-wizard/hooks/useDisputeAutoSelection.ts:82"

  - fact: "The auto-select API currently derives `recommendedMethodology` from `getBestMethodologyForBatch(...)`, not from creditor outcome history, medical rules, or deterministic re-aging/duplicate-liability detectors."
    evidence:
      - "src/app/api/admin/disputes/auto-select/route.ts:124"
      - "src/app/api/admin/disputes/auto-select/route.ts:135"

  - fact: "The wizard exposes secondary agency targeting in the UI, including LexisNexis, Innovis, ChexSystems, and EWS."
    evidence:
      - "src/components/admin/dispute-wizard/StepConfigure.tsx:170"
      - "src/components/admin/dispute-wizard/StepConfigure.tsx:172"
      - "src/components/admin/dispute-wizard/types.ts:197"
      - "src/components/admin/dispute-wizard/types.ts:203"

  - fact: "Wizard item-to-bureau scoping explicitly treats secondary bureaus as 'every selected item is in scope,' which means secondary-bureau targeting is implemented at the selection layer."
    evidence:
      - "src/components/admin/dispute-wizard/types.ts:206"
      - "src/components/admin/dispute-wizard/types.ts:213"

  - fact: "CFPB is already part of the escalation automation plan for later rounds."
    evidence:
      - "src/lib/dispute-automation.ts:69"
      - "src/lib/dispute-automation.ts:101"
      - "src/lib/dispute-automation.ts:105"

  - fact: "The wizard's local `TargetRecipient` type does not include `cfpb`, even though automation and letter-generation code support CFPB recipients."
    evidence:
      - "src/components/admin/dispute-wizard/types.ts:126"
      - "src/lib/dispute-automation.ts:69"
      - "src/lib/ai-letter-generator.ts:87"

  - fact: "Schema comments/types are inconsistent around target recipients: some dispute tables/comments omit `cfpb`, while `escalationPath` includes it."
    evidence:
      - "db/schema.ts:743"
      - "db/schema.ts:784"
      - "db/schema.ts:900"
      - "db/schema.ts:915"

  - fact: "Mail-tracking persistence is already present in the disputes schema and create/update APIs."
    evidence:
      - "db/schema.ts:790"
      - "src/app/api/admin/disputes/route.ts:239"
      - "src/app/api/admin/disputes/[id]/route.ts:283"
      - "src/app/api/admin/disputes/[id]/route.ts:284"

  - fact: "Bulk wizard submission passes a single `trackingNumber` plus `targetRecipient` when creating dispute rows."
    evidence:
      - "src/components/admin/dispute-wizard/hooks/useBulkDisputeSubmission.ts:65"
      - "src/components/admin/dispute-wizard/hooks/useBulkDisputeSubmission.ts:71"

  - fact: "Submission hygiene is enforced on dispute updates: marking a dispute as sent/submitted requires `submissionMethod`, `submissionRecipient`, and a submission date."
    evidence:
      - "src/app/api/admin/disputes/[id]/route.ts:202"
      - "src/app/api/admin/disputes/[id]/route.ts:205"

  - fact: "Frivolous outcomes are already part of structured response vocabulary and creditor outcome analytics."
    evidence:
      - "db/schema.ts:836"
      - "src/app/api/admin/disputes/[id]/route.ts:23"
      - "src/lib/creditor-strategy-insights.ts:13"
      - "src/lib/creditor-strategy-insights.ts:102"

  - fact: "I did not verify any explicit repeat-dispute/new-information gating logic in the explored files; the available evidence shows frivolous outcome tracking but not a Phase-3 gate tied to prior frivolous or repeat disputes."
    evidence:
      - "src/app/api/admin/disputes/[id]/route.ts:23"
      - "src/lib/creditor-strategy-insights.ts:13"

  - fact: "The AI letter generator's analysis checklist explicitly asks about re-aging and duplicate tradelines, but the deterministic detector module is not visibly connected to that flow from the explored references."
    evidence:
      - "src/lib/ai-letter-generator.ts:1217"
      - "src/lib/negative-item-detectors.ts:62"
      - "src/lib/negative-item-detectors.ts:82"

minimalEditFiles:
  - "src/lib/dispute-triage.ts"
  - "src/app/api/admin/disputes/triage/route.ts"
  - "src/components/admin/dispute-wizard/hooks/useDisputeMethodologies.ts"
  - "src/components/admin/dispute-wizard/hooks/useDisputeAutoSelection.ts"
  - "src/components/admin/dispute-wizard/WizardContext.tsx"
  - "src/app/api/admin/disputes/auto-select/route.ts"
  - "src/components/admin/dispute-wizard/types.ts"
  - "src/lib/ai-letter-generator.ts"
  - "src/app/api/admin/disputes/[id]/route.ts"
  - "db/schema.ts"

gaps:
  unresolved:
    - "I did not inspect every downstream letter-rendering path, so I cannot prove where CFPB packet generation would need to branch beyond the explored automation/API/type layers."
    - "I did not verify whether repeat-dispute gating exists under a different filename outside the searched dispute flows."
    - "I could not produce changed-files/tests/commands evidence because this task was exploratory and no write/execute tools were available."