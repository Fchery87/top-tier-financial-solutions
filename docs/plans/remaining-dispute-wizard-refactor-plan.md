# Remaining WizardContext Refactor Implementation Plan

## Goal

Complete the remaining maintainability refactor for:

```text
src/components/admin/dispute-wizard/WizardContext.tsx
```

The objective is to continue shrinking the provider from a god-context into a thin composition layer while preserving all current behavior.

Current state at plan creation:

```text
WizardContext.tsx: ~633 lines
```

Already extracted:

1. Letter-generation payload builder
2. Letter-generation fetch/progress lifecycle
3. Evidence workflow
4. AI analysis orchestration
5. Auto-selection orchestration
6. Dispute item loading/selection
7. Methodology/reason-code loading
8. Discrepancy/triage intelligence loading
9. Client search/loading
10. Bulk dispute submission
11. Wizard configuration/dispute options
12. Item dispute instruction state/helpers
13. Letter export actions
14. Validation/progress helpers
15. Draft recovery/autosave workflow

---

## Phase 1 — Finish remaining local workflow extractions

### Slice 1.1 — Extract operation error modal state

#### New file

```text
src/components/admin/dispute-wizard/hooks/useWizardOperationError.ts
```

#### Move from `WizardContext.tsx`

Current local state/function:

```ts
const [operationError, setOperationError] = React.useState<string | null>(null);
const [showErrorModal, setShowErrorModal] = React.useState(false);

const showOperationError = React.useCallback((message: string) => {
  setOperationError(message);
  setShowErrorModal(true);
}, []);
```

#### Hook should return

```ts
{
  operationError,
  setOperationError,
  showErrorModal,
  setShowErrorModal,
  showOperationError,
}
```

#### Risk

Low.

#### Validation

Run:

```bash
npm run typecheck
npm run lint
npm test -- --run src/__tests__/components/admin/DisputeWizard.rerender.test.tsx src/components/admin/dispute-wizard/services/__tests__/buildLetterGenerationPayload.test.ts
```

---

### Slice 1.2 — Extract initial load orchestration

#### New file

```text
src/components/admin/dispute-wizard/hooks/useWizardInitialLoad.ts
```

#### Move from `WizardContext.tsx`

Current local effect:

```ts
React.useEffect(() => {
  fetchClients();
  fetchReasonCodes();
  fetchMethodologies();
}, [fetchClients, fetchReasonCodes, fetchMethodologies]);
```

#### Hook shape

```ts
interface UseWizardInitialLoadOptions {
  fetchClients: () => void | Promise<void>;
  fetchReasonCodes: () => void | Promise<void>;
  fetchMethodologies: () => void | Promise<void>;
}

export function useWizardInitialLoad(options: UseWizardInitialLoadOptions) {
  React.useEffect(() => {
    options.fetchClients();
    options.fetchReasonCodes();
    options.fetchMethodologies();
  }, [options.fetchClients, options.fetchReasonCodes, options.fetchMethodologies]);
}
```

#### Risk

Low.

#### Validation

Same as Slice 1.1.

---

### Slice 1.3 — Extract selected-client dependent loading

#### New file

```text
src/components/admin/dispute-wizard/hooks/useSelectedClientDataLoad.ts
```

#### Move from `WizardContext.tsx`

Current local effect:

```ts
React.useEffect(() => {
  if (selectedClient) {
    fetchNegativeItems(selectedClient.id);
    fetchDiscrepancies(selectedClient.id);
    fetchTriage(selectedClient.id);
    fetchEvidence(selectedClient.id);
  }
}, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps
```

#### Hook shape

```ts
interface UseSelectedClientDataLoadOptions {
  selectedClientId?: string;
  fetchNegativeItems: (clientId: string) => Promise<void>;
  fetchDiscrepancies: (clientId: string) => Promise<void>;
  fetchTriage: (clientId: string) => Promise<void>;
  fetchEvidence: (clientId: string) => Promise<void>;
}

export function useSelectedClientDataLoad({
  selectedClientId,
  fetchNegativeItems,
  fetchDiscrepancies,
  fetchTriage,
  fetchEvidence,
}: UseSelectedClientDataLoadOptions) {
  React.useEffect(() => {
    if (!selectedClientId) return;

    fetchNegativeItems(selectedClientId);
    fetchDiscrepancies(selectedClientId);
    fetchTriage(selectedClientId);
    fetchEvidence(selectedClientId);
  }, [
    selectedClientId,
    fetchNegativeItems,
    fetchDiscrepancies,
    fetchTriage,
    fetchEvidence,
  ]);
}
```

#### Important

This may reveal why the original effect disabled exhaustive deps. If adding full deps causes duplicate loads or rerender loops, stabilize dependencies at source or use getter/callback injection carefully.

#### Risk

Medium-low.

#### Validation

Run targeted rerender test specifically:

```bash
npm test -- --run src/__tests__/components/admin/DisputeWizard.rerender.test.tsx
```

Then normal slice validation.

---

## Phase 2 — Move remaining side-effect ownership into existing hooks

### Slice 2.1 — Move analysis preference loading into `useAIAnalysis`

#### Existing file to update

```text
src/components/admin/dispute-wizard/hooks/useAIAnalysis.ts
```

#### Move from `WizardContext.tsx`

Current local effect:

```ts
React.useEffect(() => {
  const savedPreferences = localStorage.getItem('dispute-analysis-preferences');
  if (savedPreferences) {
    try {
      const prefs = JSON.parse(savedPreferences);
      if (prefs.aggressiveness) setAnalysisAggressiveness(prefs.aggressiveness);
    } catch (error) {
      console.error('Failed to load analysis preferences:', error);
    }
  }
}, [setAnalysisAggressiveness]);
```

#### Implementation note

Place this effect inside `useAIAnalysis`, next to the preference state and `saveAnalysisPreferences`.

#### Risk

Low.

#### Validation

Run:

```bash
npm run typecheck
npm run lint
npm test -- --run src/__tests__/components/admin/DisputeWizard.rerender.test.tsx
```

---

### Slice 2.2 — Move methodology recommendation side effects

#### Current local code

```ts
const getRecommendedMethodologyForItems = React.useCallback(() => {
  if (selectedItems.length === 0) return null;
  const hasCollection = negativeItems
    .filter(i => selectedItems.includes(i.id))
    .some(i => i.item_type === 'collection');

  if (hasCollection && disputeRound === 1) return 'debt_validation';
  if (disputeRound >= 2) return 'method_of_verification';
  return 'factual';
}, [selectedItems, negativeItems, disputeRound]);

React.useEffect(() => {
  const recommended = getRecommendedMethodologyForItems();
  setRecommendedMethodology(recommended);
}, [getRecommendedMethodologyForItems, setRecommendedMethodology]);

React.useEffect(() => {
  if (selectedMethodology) fetchReasonCodes(selectedMethodology);
}, [selectedMethodology, fetchReasonCodes]);
```

#### Preferred option

Extend existing hook:

```text
src/components/admin/dispute-wizard/hooks/useDisputeMethodologies.ts
```

Add optional inputs:

```ts
interface UseDisputeMethodologiesOptions {
  selectedItems?: string[];
  negativeItems?: NegativeItem[];
  disputeRound?: number;
}
```

Inside hook:

- compute recommended methodology
- set `recommendedMethodology`
- fetch reason codes when selected methodology changes

#### Alternative option

Create a small coordination hook:

```text
src/components/admin/dispute-wizard/hooks/useMethodologyRecommendation.ts
```

This is less invasive but leaves methodology ownership split across hooks.

#### Recommendation

Prefer extending `useDisputeMethodologies` if the hook remains readable.

#### Risk

Medium.

#### Validation

Run:

```bash
npm run typecheck
npm run lint
npm test -- --run src/__tests__/components/admin/DisputeWizard.rerender.test.tsx
npm test -- --run --testTimeout=15000
```

---

## Phase 3 — Extract remaining generation/evidence-gate orchestration

### Slice 3.1 — Extract `generateLetters` wrapper

#### New file

```text
src/components/admin/dispute-wizard/hooks/useGenerateDisputeLetters.ts
```

#### Move from `WizardContext.tsx`

Current remaining large local function:

```ts
const generateLetters = async (
  analysisData?: { analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null
) => {
  ...
};
```

#### Responsibilities to move

The new hook should own the wrapper that:

1. exits if no selected client
2. computes used reason codes:
   - AI mode:
     ```ts
     analysisData?.summary?.allReasonCodes || aiAnalysisSummary?.allReasonCodes || []
     ```
   - manual/template mode:
     ```ts
     selectedReasonCodes
     ```
3. validates evidence requirements:
   ```ts
   validateEvidenceRequirements(usedReasonCodes, selectedEvidenceIds, selectedItems)
   ```
4. opens evidence-blocking modal if invalid and override not confirmed
5. calls:
   ```ts
   buildLetterGenerationPayload(...)
   ```
6. exits if no selected dispute items
7. calls:
   ```ts
   generateLettersFromPlan(...)
   ```
8. advances to review step:
   ```ts
   setCurrentStep(reviewStepId)
   ```

#### Inputs

This hook will need many dependencies. To keep the function stable, either:

##### Option A — Pass explicit values

```ts
useGenerateDisputeLetters({
  selectedClient,
  negativeItems,
  selectedItems,
  personalInfoItems,
  selectedPersonalItems,
  inquiryItems,
  selectedInquiryItems,
  generationMethod,
  selectedReasonCodes,
  aiAnalysisResults,
  aiAnalysisSummary,
  selectedMethodology,
  selectedBureaus,
  targetRecipient,
  selectedDisputeType,
  disputeRound,
  customReason,
  combineItemsPerBureau,
  selectedEvidenceIds,
  requestManualReview,
  evidenceOverrideConfirmed,
  itemDisputeInstructions,
  getInstructionText,
  hasItemInstruction,
  generateLettersFromPlan,
  setEvidenceBlockingStatus,
  setShowEvidenceBlockingModal,
  setCurrentStep,
  reviewStepId,
});
```

##### Option B — Pass getter callbacks

This reduces callback churn but is more verbose.

#### Recommendation

Use explicit values first. Behavior preservation is more important than avoiding dependency arrays.

#### Risk

Medium-high because this is core generation flow.

#### Validation

Run:

```bash
npm run typecheck
npm run lint
npm test -- --run src/components/admin/dispute-wizard/services/__tests__/buildLetterGenerationPayload.test.ts
npm test -- --run src/__tests__/components/admin/DisputeWizard.rerender.test.tsx
npm test -- --run src/__tests__/api/admin/dispute-letter-generation.test.ts src/__tests__/api/admin/dispute-creation-policy-trace.test.ts
npm test -- --run --testTimeout=15000
npm run build
```

---

### Slice 3.2 — Fold evidence-blocking state into generation hook

#### Current local state

```ts
const [evidenceBlockingStatus, setEvidenceBlockingStatus] =
  React.useState<EvidenceValidationResult | null>(null);

const [showEvidenceBlockingModal, setShowEvidenceBlockingModal] =
  React.useState(false);
```

#### Preferred implementation

After `useGenerateDisputeLetters` exists, move this state into that hook and return:

```ts
{
  evidenceBlockingStatus,
  setEvidenceBlockingStatus,
  showEvidenceBlockingModal,
  setShowEvidenceBlockingModal,
  generateLetters,
}
```

#### Risk

Medium.

#### Validation

Same as Slice 3.1.

---

## Phase 4 — Navigation and keyboard behavior cleanup

### Slice 4.1 — Extract keyboard navigation

#### New file

```text
src/components/admin/dispute-wizard/hooks/useWizardKeyboardNavigation.ts
```

#### Move from `WizardContext.tsx`

Current local effect:

```ts
React.useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) return;

    if (
      e.key === 'Enter' &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.shiftKey
    ) {
      e.preventDefault();
      if (currentStep < maxSteps) {
        const stepErrors = validationErrors[currentStep];
        if (!stepErrors || stepErrors.length === 0) {
          setCurrentStep(currentStep + 1);
        }
      }
    }

    if (e.key === 'Escape' && currentStep > 1) {
      e.preventDefault();
      setCurrentStep(currentStep - 1);
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => {
    window.removeEventListener('keydown', handleKeyPress);
  };
}, [currentStep, maxSteps, validationErrors]);
```

#### Hook shape

```ts
interface UseWizardKeyboardNavigationOptions {
  currentStep: number;
  maxSteps: number;
  validationErrors: Record<number, string[]>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
}

export function useWizardKeyboardNavigation(options: UseWizardKeyboardNavigationOptions) {
  React.useEffect(...);
}
```

#### Risk

Low.

#### Validation

Run rerender test and full validation.

---

### Slice 4.2 — Extract wizard navigation state

#### New file

```text
src/components/admin/dispute-wizard/hooks/useWizardNavigation.ts
```

#### Move from `WizardContext.tsx`

Current local state/constants/helper:

```ts
const [currentStep, setCurrentStep] = React.useState(1);
const maxSteps = WIZARD_STEPS.length;
const reviewStepId = 4;

const handleStepClick = (stepId: number) => {
  if (stepId < currentStep) setCurrentStep(stepId);
};
```

#### Hook returns

```ts
{
  currentStep,
  setCurrentStep,
  maxSteps,
  reviewStepId,
  handleStepClick,
}
```

#### Important

Do this after generation extraction if possible, because generation currently calls:

```ts
setCurrentStep(reviewStepId)
```

#### Risk

Low-medium.

#### Validation

Run:

```bash
npm run typecheck
npm run lint
npm test -- --run src/__tests__/components/admin/DisputeWizard.rerender.test.tsx src/components/admin/__tests__/DisputeWizardProgressBar.test.tsx
npm test -- --run --testTimeout=15000
npm run build
```

---

## Phase 5 — Cleanup dead/legacy state

### Slice 5.1 — Remove or formalize letter strength placeholder

#### Current local state

```ts
const [_letterStrengthScore, _setLetterStrengthScore] =
  React.useState<LetterStrengthScore | null>(null);
```

#### Options

##### Option A — Remove

If unused everywhere, delete:

- `LetterStrengthScore` import
- `_letterStrengthScore` state

##### Option B — Formalize

If planned soon, move into a hook or TODO with clear owner.

#### Recommendation

Remove if typecheck confirms no usage.

#### Risk

Low.

#### Validation

Run typecheck/lint/targeted tests.

---

## Phase 6 — Provider API rationalization

This is the larger architectural phase after all local workflows have been extracted.

### Slice 6.1 — Audit context consumers

#### Goal

Find what parts of `WizardContextValue` are actually consumed.

#### Commands

```bash
grep -R "useWizardContext" -n src/components src/app src/__tests__
```

Or use TS-aware search.

#### Output

Create a mapping:

```text
Consumer file -> fields used
```

#### Purpose

Identify unused exports and raw setters that can be removed from context.

---

### Slice 6.2 — Remove unused context fields

#### Goal

If any fields remain in `WizardContextValue` but are never consumed, remove them.

#### Risk

Medium because tests may not cover all UI paths.

#### Validation

Full suite and build required.

---

### Slice 6.3 — Split context by domain

#### Potential contexts

```text
DisputeWizardNavigationContext
DisputeWizardClientItemsContext
DisputeWizardAnalysisContext
DisputeWizardEvidenceContext
DisputeWizardGenerationContext
DisputeWizardValidationContext
```

#### Goal

Reduce rerender blast radius and avoid one giant context value object.

#### Risk

High.

#### Recommendation

Do this only after all extraction slices are stable and committed.

---

## Validation Standard For Every Slice

For each slice:

```bash
npm run typecheck
npm run lint
npm test -- --run src/__tests__/components/admin/DisputeWizard.rerender.test.tsx src/components/admin/dispute-wizard/services/__tests__/buildLetterGenerationPayload.test.ts
```

For medium/high-risk slices additionally:

```bash
npm test -- --run --testTimeout=15000
npm run build
```

For all final phase completion:

```bash
npm run typecheck
npm run lint
npm test -- --run --testTimeout=15000
npm run build
```

Expected current full-suite baseline:

```text
60 passed, 1 skipped
683 passed, 27 skipped
```

---

## Recommended Execution Order

1. `useWizardOperationError`
2. `useWizardInitialLoad`
3. `useSelectedClientDataLoad`
4. move analysis preference loading into `useAIAnalysis`
5. methodology recommendation cleanup
6. `useGenerateDisputeLetters`
7. move evidence-blocking state into generation hook
8. `useWizardKeyboardNavigation`
9. `useWizardNavigation`
10. remove/formalize letter strength placeholder
11. audit context consumers
12. remove unused context fields
13. consider context splitting

---

## Definition of Done

This remaining refactor is complete when:

- `WizardContext.tsx` is mostly a composition/provider layer
- local procedural workflow logic is moved into focused hooks/services
- no behavior regressions
- no lint/type errors
- full Vitest suite passes
- production build passes
- remaining context fields are intentionally exposed and used
- any future architectural splitting is documented as a separate phase if not implemented immediately
