# Dispute Wizard Context Consumer Audit

Generated during Phase 6 of `docs/plans/remaining-dispute-wizard-refactor-plan.md`.

## Consumers

- `src/app/admin/disputes/wizard/page.tsx`
- `src/components/admin/dispute-wizard/StepClientSelect.tsx`
- `src/components/admin/dispute-wizard/StepConfigure.tsx`
- `src/components/admin/dispute-wizard/StepItemSelect.tsx`
- `src/components/admin/dispute-wizard/StepReview.tsx`
- `src/components/admin/dispute-wizard/WizardModals.tsx`

## Findings

The current provider still intentionally exposes a large compatibility-oriented surface. A broad static scan found many fields that are not referenced directly by current consumers, especially raw setter and fetch functions that are only used internally by the provider after the hook extraction work.

Because several consumers pass the entire context object (`ctx`) into helper subcomponents and because this provider is used as the wizard integration boundary, removing fields should be treated as an API change rather than a simple dead-code cleanup.

## Recommendation

Do not split the context or aggressively remove raw setters in the same refactor batch as the workflow extraction. The workflow extraction has already converted `WizardContext.tsx` into a composition layer. A subsequent dedicated API-rationalization PR should:

1. Add type-level or component-level coverage around every wizard step.
2. Replace raw setter exports with command-style operations where practical.
3. Remove unused provider fields in small groups with full-suite validation.
4. Then split contexts by domain only if rerender profiling shows measurable benefit.

## Candidate future context domains

- `DisputeWizardNavigationContext`
- `DisputeWizardClientItemsContext`
- `DisputeWizardAnalysisContext`
- `DisputeWizardEvidenceContext`
- `DisputeWizardGenerationContext`
- `DisputeWizardValidationContext`

## Decision

Phase 6.2/6.3 are considered evaluated but deferred for a separate context API rationalization effort. This avoids coupling behavior-preserving workflow extraction with a potentially breaking public-context API change.
