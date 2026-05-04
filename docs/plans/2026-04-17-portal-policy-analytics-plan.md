# Portal Collaboration, Deterministic Dispute Policy, and Operator Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the client portal into a real collaboration layer, move dispute-policy decisions out of AI and into deterministic code, and add operator analytics that show the health and throughput of the credit-repair operation.

**Architecture:** Reuse the existing portal, dispute, messaging, task, and analytics foundations already in the repo instead of creating parallel systems. Add missing portal APIs and views, centralize dispute policy decisions in a dedicated deterministic service that feeds the existing AI renderer, and expose a new operator analytics API plus dashboard surfaces built from current database tables.

**Tech Stack:** Next.js App Router, TypeScript, Better Auth, Drizzle ORM, PostgreSQL, Vitest, existing portal/admin UI components, existing email automation service.

## Assumptions

- Portal collaboration should extend existing tables and routes, not replace the current portal page in [`src/app/portal/page.tsx`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/app/portal/page.tsx:1).
- AI should continue rendering dispute letters, but it must stop inferring policy, eligibility, or reason codes from free text.
- Operator analytics should be built from the current `credit_reports`, `disputes`, `credit_score_history`, `tasks`, and email automation tables before adding new telemetry tables.

## Success Criteria

1. Clients can use the portal for messages, visible tasks, document checklist progress, notification preferences, and a mobile-friendly progress view.
2. Admin dispute routes compute reason codes, evidence requirements, and claim eligibility deterministically before calling the letter renderer.
3. Admin operators can view import success rate, disputes per round, response timelines, deletions by bureau/item type, and client progress snapshots from dedicated API endpoints and dashboard UI.

---

### Task 1: Baseline Portal and Analytics Contract Tests

**Files:**
- Create: `src/__tests__/api/portal/messages.test.ts`
- Create: `src/__tests__/api/portal/notifications.test.ts`
- Create: `src/__tests__/api/admin/operator-analytics.test.ts`
- Modify: `src/__tests__/setup.tsx`

**Step 1: Write failing tests for new portal collaboration endpoints**

Cover:
- authenticated client can list their own threads/messages
- authenticated client cannot access another client’s thread
- client can read and update notification preferences
- admin can fetch operator analytics summary

**Step 2: Run tests to verify they fail**

Run: `npm run test -- src/__tests__/api/portal/messages.test.ts src/__tests__/api/portal/notifications.test.ts src/__tests__/api/admin/operator-analytics.test.ts`

Expected: failures for missing routes or missing handlers.

**Step 3: Add minimal test helpers**

Extend the existing test setup only as needed for:
- mocked authenticated portal user
- mocked authenticated admin user
- shared DB response factories for disputes, tasks, reports, and message threads

**Step 4: Re-run the targeted tests**

Expected: still failing, but now on missing implementation rather than broken harness.

**Step 5: Commit**

`git commit -m "test: add portal and operator analytics contract coverage"`

---

### Task 2: Portal Messaging API for Clients

**Files:**
- Create: `src/app/api/portal/messages/route.ts`
- Modify: `src/app/api/admin/messages/route.ts`
- Modify: `db/schema.ts`
- Test: `src/__tests__/api/portal/messages.test.ts`

**Step 1: Write failing tests for portal message read/write**

Cover:
- client lists only their own threads
- client reads thread messages and unread counts reset correctly
- client sends a message into an existing thread
- client can create a new thread only for their own client record

**Step 2: Run the specific failing tests**

Run: `npm run test -- src/__tests__/api/portal/messages.test.ts`

Expected: FAIL on missing `src/app/api/portal/messages/route.ts`.

**Step 3: Implement the minimal portal route**

Reuse the existing `message_threads` and `messages` tables from [`db/schema.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/db/schema.ts:1313). Mirror the ownership checks used by other portal routes like [`src/app/api/portal/tasks/route.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/app/api/portal/tasks/route.ts:1).

Requirements:
- GET returns client-owned threads or thread messages
- POST sends a client message and increments `unread_by_admin`
- no cross-client access

**Step 4: Adjust the admin route only if needed**

Keep admin behavior stable. Only update shared thread-status behavior if the portal route needs symmetry.

**Step 5: Run tests**

Run: `npm run test -- src/__tests__/api/portal/messages.test.ts`

Expected: PASS.

**Step 6: Commit**

`git commit -m "feat: add client portal messaging api"`

---

### Task 3: Portal Notification Preferences API

**Files:**
- Create: `src/app/api/portal/notifications/route.ts`
- Modify: `src/lib/email-service.ts`
- Test: `src/__tests__/api/portal/notifications.test.ts`

**Step 1: Write failing tests**

Cover:
- GET returns defaults when no preferences row exists
- POST or PUT creates/updates preferences for the authenticated client
- one client cannot change another client’s preferences

**Step 2: Run the test**

Run: `npm run test -- src/__tests__/api/portal/notifications.test.ts`

Expected: FAIL on missing route.

**Step 3: Implement the route**

Use the existing `client_notification_preferences` table from [`db/schema.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/db/schema.ts:1533).

Support:
- `email_enabled`
- `dispute_updates`
- `progress_reports`
- `marketing_emails`
- `preferred_frequency`

**Step 4: Verify email-service compatibility**

Make sure [`src/lib/email-service.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/lib/email-service.ts:208) still works when preferences are absent and correctly respects saved preferences.

**Step 5: Run tests**

Run: `npm run test -- src/__tests__/api/portal/notifications.test.ts`

Expected: PASS.

**Step 6: Commit**

`git commit -m "feat: add portal notification preferences api"`

---

### Task 4: Portal Collaboration UI Upgrade

**Files:**
- Modify: `src/app/portal/page.tsx`
- Create: `src/components/portal/PortalMessagesPanel.tsx`
- Create: `src/components/portal/PortalNotificationsPanel.tsx`
- Create: `src/components/portal/PortalDocumentChecklist.tsx`
- Create: `src/components/portal/PortalProgressSnapshot.tsx`
- Test: `src/__tests__/components/portal/PortalPage.test.tsx`

**Step 1: Write failing component tests**

Cover:
- portal renders message center when threads exist
- portal renders document checklist state
- portal renders notification settings form
- mobile layout still exposes next task, progress, and disputes

**Step 2: Run the component test**

Run: `npm run test -- src/__tests__/components/portal/PortalPage.test.tsx`

Expected: FAIL on missing components or UI states.

**Step 3: Refactor the portal page into collaboration sections**

Use the current portal page as the base, not a rewrite. Keep existing data sources for disputes, score history, letters, and tasks from [`src/app/portal/page.tsx`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/app/portal/page.tsx:1).

Add:
- message thread list and message composer
- document checklist derived from open visible tasks and uploaded document types
- notification settings panel backed by new API
- progress snapshot card optimized for mobile

**Step 4: Keep the UI mobile-first**

Verification target:
- no section requires horizontal scroll on narrow viewport
- next action and progress summary stay above the fold on mobile

**Step 5: Run tests**

Run: `npm run test -- src/__tests__/components/portal/PortalPage.test.tsx`

Expected: PASS.

**Step 6: Commit**

`git commit -m "feat: expand portal collaboration experience"`

---

### Task 5: Deterministic Dispute Policy Engine

**Files:**
- Create: `src/lib/dispute-policy-engine.ts`
- Create: `src/lib/__tests__/dispute-policy-engine.test.ts`
- Modify: `src/lib/dispute-compliance-policy.ts`
- Modify: `src/lib/dispute-evidence.ts`

**Step 1: Write failing unit tests**

Cover:
- deterministic reason-code selection from item analysis
- high-risk ownership claims rejected without evidence and confirmation
- evidence requirements resolved from reason codes without AI involvement
- claim eligibility returns structured output for admin routes

**Step 2: Run the policy-engine tests**

Run: `npm run test -- src/lib/__tests__/dispute-policy-engine.test.ts`

Expected: FAIL because the policy engine does not exist.

**Step 3: Implement the policy engine**

Responsibilities:
- accept dispute item inputs and analysis results
- choose allowed reason codes
- calculate required/recommended evidence
- block high-risk claims
- return a stable `policyDecision` object for downstream routes

Do not duplicate logic already present in:
- [`src/lib/dispute-compliance-policy.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/lib/dispute-compliance-policy.ts:1)
- [`src/lib/dispute-evidence.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/lib/dispute-evidence.ts:1)
- deterministic item analysis inside [`src/lib/ai-letter-generator.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/lib/ai-letter-generator.ts:877)

Wrap and normalize that logic instead of re-implementing it in multiple routes.

**Step 4: Run tests**

Run: `npm run test -- src/lib/__tests__/dispute-policy-engine.test.ts`

Expected: PASS.

**Step 5: Commit**

`git commit -m "feat: add deterministic dispute policy engine"`

---

### Task 6: Route Integration So AI Only Renders

**Files:**
- Modify: `src/app/api/admin/disputes/analyze-items/route.ts`
- Modify: `src/app/api/admin/disputes/generate-letter/route.ts`
- Modify: `src/app/api/admin/disputes/route.ts`
- Modify: `src/app/api/admin/disputes/[id]/quick-redispute/route.ts`
- Modify: `src/lib/ai-letter-generator.ts`
- Test: `src/__tests__/api/admin/disputes-policy-flow.test.ts`

**Step 1: Write failing integration tests**

Cover:
- generate-letter route rejects unsupported/high-risk claims before rendering
- create-dispute route persists deterministic reason codes instead of free-text heuristics
- quick re-dispute uses deterministic escalation policy
- AI renderer receives precomputed reason codes and evidence context only

**Step 2: Run the tests**

Run: `npm run test -- src/__tests__/api/admin/disputes-policy-flow.test.ts`

Expected: FAIL on current free-text fallback behavior.

**Step 3: Remove policy inference from request handlers**

Specifically remove or replace:
- the free-text `normalizedReasonCodes` heuristic in [`src/app/api/admin/disputes/route.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/app/api/admin/disputes/route.ts:103)
- any route behavior that lets AI or user free text decide claim eligibility

**Step 4: Narrow AI generator responsibility**

Update [`src/lib/ai-letter-generator.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/lib/ai-letter-generator.ts:300) so it is clearly a rendering layer. Inputs should already be policy-approved.

Keep:
- methodology-aware prompts
- plain-text rendering

Do not let it:
- add unapproved reason codes
- silently escalate to ownership/fraud claims

**Step 5: Run tests**

Run: `npm run test -- src/__tests__/api/admin/disputes-policy-flow.test.ts`

Expected: PASS.

**Step 6: Commit**

`git commit -m "refactor: route dispute policy through deterministic engine"`

---

### Task 7: Operator Analytics Service

**Files:**
- Create: `src/lib/operator-analytics.ts`
- Create: `src/lib/__tests__/operator-analytics.test.ts`
- Modify: `src/app/api/admin/automation/route.ts`
- Modify: `src/app/api/admin/results/route.ts`
- Modify: `src/app/api/admin/dashboard/trends/route.ts`

**Step 1: Write failing unit tests for analytics aggregation**

Cover:
- import success rate from `credit_reports.parse_status`
- dispute counts by round from `disputes.round`
- average and percentile response timelines from `sent_at` to `response_received_at`
- deletions by bureau and item type
- progress snapshot per client from score history, open tasks, and dispute outcomes

**Step 2: Run the analytics tests**

Run: `npm run test -- src/lib/__tests__/operator-analytics.test.ts`

Expected: FAIL because the aggregator does not exist.

**Step 3: Implement a shared analytics service**

Create a single service that composes data already split across:
- [`src/app/api/admin/automation/route.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/app/api/admin/automation/route.ts:1)
- [`src/app/api/admin/dashboard/trends/route.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/app/api/admin/dashboard/trends/route.ts:1)
- [`src/app/api/admin/results/route.ts`](/home/nochaserz/Documents/Coding%20Projects/top-tier-financial-solutions/src/app/api/admin/results/route.ts:1)

This avoids a third analytics implementation.

**Step 4: Re-run tests**

Run: `npm run test -- src/lib/__tests__/operator-analytics.test.ts`

Expected: PASS.

**Step 5: Commit**

`git commit -m "feat: add shared operator analytics service"`

---

### Task 8: Admin Operator Analytics API

**Files:**
- Create: `src/app/api/admin/operator-analytics/route.ts`
- Test: `src/__tests__/api/admin/operator-analytics.test.ts`

**Step 1: Write failing API tests**

Cover:
- admin receives summary payload with all required sections
- non-admin gets `401`
- response includes:
  - import success rate
  - disputes per round
  - response timelines
  - deletions by bureau/item type
  - client progress snapshots

**Step 2: Run the API test**

Run: `npm run test -- src/__tests__/api/admin/operator-analytics.test.ts`

Expected: FAIL on missing route.

**Step 3: Implement the route**

Use the shared service from Task 7. Keep payload compact and dashboard-ready.

Recommended response shape:
- `imports`
- `disputes`
- `responses`
- `deletions`
- `client_snapshots`

**Step 4: Run tests**

Run: `npm run test -- src/__tests__/api/admin/operator-analytics.test.ts`

Expected: PASS.

**Step 5: Commit**

`git commit -m "feat: add operator analytics api"`

---

### Task 9: Admin Dashboard Surface for Operator Analytics

**Files:**
- Modify: `src/app/admin/page.tsx`
- Create: `src/components/admin/OperatorAnalyticsPanel.tsx`
- Create: `src/components/admin/ClientProgressSnapshots.tsx`
- Test: `src/__tests__/components/admin/OperatorAnalyticsPanel.test.tsx`

**Step 1: Write failing component tests**

Cover:
- panel renders import success rate
- panel renders dispute counts by round
- panel renders response timeline summaries
- panel renders deletions grouped by bureau/item type
- panel renders top client progress snapshots

**Step 2: Run the component tests**

Run: `npm run test -- src/__tests__/components/admin/OperatorAnalyticsPanel.test.tsx`

Expected: FAIL on missing components.

**Step 3: Implement the dashboard panel**

Mount it on the existing admin dashboard, not a new analytics page, unless layout pressure makes that clearly necessary.

Prioritize:
- operational status at a glance
- no hidden drill-down required for the main health metrics
- visual consistency with existing admin cards/charts

**Step 4: Run tests**

Run: `npm run test -- src/__tests__/components/admin/OperatorAnalyticsPanel.test.tsx`

Expected: PASS.

**Step 5: Commit**

`git commit -m "feat: surface operator analytics on admin dashboard"`

---

### Task 10: End-to-End Verification and Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/SETUP_GUIDE.md`
- Create: `docs/portal-collaboration-and-analytics.md`

**Step 1: Write a short implementation note**

Document:
- new portal collaboration capabilities
- deterministic dispute-policy flow
- new operator analytics endpoint and dashboard panel

**Step 2: Run targeted validation**

Run:
- `npm run test -- src/__tests__/api/portal/messages.test.ts src/__tests__/api/portal/notifications.test.ts src/__tests__/api/admin/operator-analytics.test.ts src/__tests__/components/portal/PortalPage.test.tsx src/__tests__/components/admin/OperatorAnalyticsPanel.test.tsx src/lib/__tests__/dispute-policy-engine.test.ts src/lib/__tests__/operator-analytics.test.ts`
- `npm run typecheck`
- `npm run lint`

Expected:
- all targeted tests PASS
- typecheck PASS
- lint PASS

**Step 3: Manual verification**

Verify in browser:
- client can send and read messages in portal
- client can update notification preferences
- portal progress and next actions render correctly on mobile width
- admin sees analytics panel with real data
- admin dispute flow cannot create unsupported ownership claims without required evidence/confirmation

**Step 4: Commit**

`git commit -m "docs: document portal collaboration and operator analytics"`

---

## Recommended Execution Order

1. Tasks 1-4 for portal collaboration.
2. Tasks 5-6 for deterministic dispute policy.
3. Tasks 7-9 for operator analytics.
4. Task 10 for final verification and docs.

## Risks to Watch

- The portal currently mixes several datasets in one large page component. Keep refactors incremental to avoid UI regressions.
- Message ownership rules must be strict. Do not trust `thread_id` without resolving it back to the authenticated client.
- The dispute-policy refactor must preserve existing deterministic Metro 2 analysis instead of replacing it with a new abstraction layer.
- Analytics routes should share aggregation logic. If each route computes its own numbers, drift is guaranteed.

## Definition of Done

- Clients have a true collaboration layer in the portal with messages, tasks, document checklist progress, notification settings, and mobile-friendly progress views.
- Admin dispute routes compute policy decisions deterministically and use AI only for final letter phrasing.
- Admin dashboard exposes operational analytics for imports, disputes, responses, deletions, and client progress.
- Tests, lint, and typecheck all pass.
