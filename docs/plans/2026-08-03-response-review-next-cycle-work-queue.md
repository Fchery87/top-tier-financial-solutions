# Response Review and Next-Cycle Work Queue Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give staff a deadline-prioritized response-review queue and require an explicit staff decision before the system creates any next-cycle dispute draft.

**Architecture:** Keep response-review policy pure and deterministic. Recording a review persists the response evidence and outcome, then returns a typed recommendation; it never generates a letter or draft. A separate, explicit staff action revalidates that recommendation and all existing report/CFPB gates before creating a follow-up draft. The workspace page owns queue loading and opens the existing detail panel for review.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Drizzle ORM, Vitest, Testing Library, Tailwind CSS.

## Scope decisions

- No schema migration: the existing dispute response, outcome, deadline, and prior-dispute fields are sufficient.
- Actual responses (`deleted`, `updated`, `verified`, `frivolous`) require a response date and response document. `no_response` requires an elapsed response deadline and must not require a fictitious document or receipt date.
- A review mutation must not create a draft, even if an obsolete client sends `createNextRound`.
- Only `verified` and eligible `no_response` reviews can recommend a next-cycle draft. The staff member must press a separate, labeled action to create it.
- The existing `quick-redispute` endpoint is retained as the explicit draft-creation seam; its server logic becomes recommendation-aware and supports both escalation outcomes. Its user-facing label changes to “Create recommended draft.”
- Deleted, updated, and frivolous outcomes return close, refresh-item, and no-further-action recommendations respectively; they never create a draft.

## Task 1: Define pure review recommendations

**Files:**

- Create: `src/lib/response-review-recommendation.ts`
- Create: `src/__tests__/lib/response-review-recommendation.test.ts`

1. Write failing tests for all five structured outcomes:
   - `deleted` -> `close`
   - `updated` -> `refresh_item`
   - `frivolous` -> `no_further_action`
   - `verified` -> `create_next_draft` using `buildEscalationPlan(..., trigger: 'verified')`
   - `no_response` -> `create_next_draft` using `buildEscalationPlan(..., trigger: 'no_response')`
2. Run the focused test and confirm it fails because the module is absent.
3. Implement a discriminated `ResponseReviewRecommendation` union. The creation variant carries the exact escalation plan; all variants carry operator-facing title and detail text.
4. Re-run the focused test and confirm it passes.

## Task 2: Make server behavior recommendation-first

**Files:**

- Modify: `src/app/api/admin/disputes/[id]/route.ts`
- Modify: `src/app/api/admin/disputes/[id]/quick-redispute/route.ts`
- Modify: `src/__tests__/api/admin/response-review.test.ts`
- Create: `src/__tests__/api/admin/quick-redispute.test.ts`

1. Add failing route tests showing that response review:
   - rejects `createNextRound: true`;
   - requires document/date for actual responses;
   - accepts an overdue `no_response` without a document/date;
   - returns the pure recommendation; and
   - does not call the draft-generation seams.
2. Remove response-review draft creation from the dispute `PUT` handler. Replace the local recommendation function with the pure module.
3. Validate `no_response` against `currentDispute.responseDeadline`; reject it until the deadline has elapsed.
4. Update `quick-redispute` so it rechecks the persisted outcome, response-evidence/deadline rule, report approval, duplicate-child prevention, and CFPB eligibility. Derive all escalation fields from the pure recommendation instead of maintaining a second strategy switch.
5. Add route tests for successful verified/no-response draft creation and for each server-side rejection. Re-run focused API tests.

## Task 3: Add the staff review queue and correct the modal

**Files:**

- Create: `src/components/workspace/disputes/ResponseReviewQueue.tsx`
- Create: `src/components/workspace/disputes/__tests__/ResponseReviewQueue.test.tsx`
- Modify: `src/components/workspace/disputes/DisputeDetailPanel.tsx`
- Create: `src/components/workspace/disputes/__tests__/DisputeDetailPanel.test.tsx`
- Modify: `src/app/workspace/disputes/page.tsx`
- Modify: `src/components/workspace/WorkQueue.tsx`

1. Write failing component tests for overdue-first ordering, empty state, and opening the selected dispute for review.
2. Add a small `ResponseReviewQueue` near the top of the disputes page. It loads the existing `awaiting_response=true` list, displays deadline urgency, and opens the same detail panel as the table. Do not add a new broad API.
3. Write failing modal tests for required response evidence, no-response copy, visible recommendation, non-OK API errors, and the separate “Create recommended draft” action.
4. Remove the auto-create checkbox and never send `createNextRound`. Require response document/date for actual responses in the UI; hide those fields for `no_response` and explain the deadline rule.
5. Keep the modal open after a successful review so staff can read the recommendation. Only call `quick-redispute` after a second explicit click; refresh queue and disputes after successful draft creation.
6. Update dashboard work-queue links to `/workspace/disputes` query paths so staff land in the active workspace rather than the legacy admin location.

## Task 4: Document and verify

**Files:**

- Modify: `docs/plans/credit-repair-platform-roadmap.md`
- Modify: `docs/plans/2026-08-02-workspace-portal-letter-studio-completion.md`

1. Record the recommendation-first policy and queue completion. Keep provider-backed pilot execution, API namespace renaming, custom roles, contingent disclosure, and physical table removal deferred.
2. Run:

```bash
./node_modules/.bin/vitest run --pool=threads --maxWorkers=1 \
  src/__tests__/lib/response-review-recommendation.test.ts \
  src/__tests__/api/admin/response-review.test.ts \
  src/__tests__/api/admin/quick-redispute.test.ts \
  src/components/workspace/disputes/__tests__/ResponseReviewQueue.test.tsx \
  src/components/workspace/disputes/__tests__/DisputeDetailPanel.test.tsx
npm run typecheck
npm run lint
npm run test
git diff --check
```

The full test command may take about six minutes on this workspace; do not impose the previous 240-second diagnostic cutoff.
