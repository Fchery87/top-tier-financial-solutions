# Workspace, Portal, and Letter Studio Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close every scheduled gap in the workspace/portal restructure and letter-library wiring plans so authorization, team administration, portal navigation, Letter Studio, compliance escalation, attribution, audit history, and verification all meet the original definition of done.

**Architecture:** Keep the two 2026-07-31 plans as source specifications and finish them through a dependency-ordered closure plan. Authorization is consolidated behind the capability seam; letter creation and editing are consolidated behind a transactional letter-workflow seam; escalation eligibility is decided at runtime rather than in static configuration; and library feedback uses atomic database updates. The wizard creates persisted draft disputes at generation time so Step Review and dispute detail use the same Letter Studio, attribution, lint, and revision interfaces.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Better Auth, Drizzle ORM with Neon Postgres, Vitest, Testing Library, Playwright, Tailwind CSS.

---

## Source plans and completion rule

This plan closes scheduled work from:

- `docs/plans/2026-07-31-workspace-portal-restructure-and-letter-studio.md`
- `docs/plans/2026-07-31-letter-library-wiring.md`

“Complete” means every task in Phases 1–6 of the workspace plan and Phases 1–5 of the library plan is implemented, covered at the appropriate test level, and passes the repository definition of done. Phase 7 is now partially implemented through the Phase 7A follow-up; the remaining items stay deliberately deferred:

- `/api/admin/*` is not renamed.
- Custom database-defined roles are not added.
- The contingent S.4144/H.R.306 disclosure is not added unless it becomes law.
- Command-palette record search is implemented in the Phase 7A follow-up.
- The old `dispute_letter_templates` table remains deprecated and retained; its active bootstrap and writer tooling is retired.
- The Phase 7B letter-library generation pilot is implemented as a read-only development audit; provider-backed execution and usage writes remain opt-in and deferred.
- The 2026-08-03 response-review work queue is complete: recommendations are deterministic, review recording never auto-generates a next-cycle draft, and staff explicitly creates any recommended draft after review.

The generation prompt remains professional and neutral. Tone escalation belongs only to explicit Letter Studio rewrites.

## Execution prerequisites

The current foundation is uncommitted. Do not create a fresh worktree from `HEAD` and assume it contains this baseline; it will omit the workspace, portal, library, lint, and Letter Studio changes this plan completes.

Before Task 1.1:

1. Preserve all existing user changes; do not reset or overwrite the dirty worktree.
2. Run the current focused tests, `npm run typecheck`, and `git diff --check` to establish the handoff baseline.
3. Review the existing generated migrations `0037` and `0038`, then apply them to the intended development database before generating another migration.
4. With user approval, checkpoint the existing foundation in a baseline commit. A dedicated implementation worktree may be created only after that commit exists.
5. Record any pre-existing validation failure separately. Do not weaken an acceptance gate to absorb it.

## Current baseline, audited 2026-08-02

The existing implementation is substantial and must be preserved. It already includes the capability map and server layouts, role-aware sign-in landing, portal shell, letter-library selection and prompt enrichment, library admin CRUD, lint severity tiers, manual and AI letter writes, a revision table, and outcome feedback.

The following table records the gaps found during the pre-implementation audit. All code and test gaps in this table are now closed in the shared worktree; the final environment-backed verification gates are recorded below.

| Source requirement | Audited gap before implementation | Closed by |
|---|---|---|
| Workspace Tasks 1.4–1.5 | Nine route files still call `getAdminSessionUser`; legacy role helpers and stale mocks remain | Phase 1 |
| Workspace Task 2.1 | `AdminGuard`, its access-check route, tests, and one email-template wrapper remain | Phase 1 |
| Workspace Task 2.5 | Team & Roles UI/API and lockout protection are absent | Phase 1 |
| Workspace Task 6.2 | No team activity table or mutation audit seam exists | Phase 1 |
| Workspace Tasks 3.1–3.3 | Portal pages still duplicate client auth; header lacks client “My Portal”; auth redirect E2E is absent | Phase 2 |
| Workspace Tasks 4.1–4.4 | Generated revision 1, history, diff, revert, autosave, compliance rail, and wizard integration are absent | Phases 3–4 |
| Library Task 3.2 | Wizard drops `library_selection`, so its disputes have null attribution | Phase 3 |
| Library Tasks 4.1–4.2 | Usage is fire-and-forget; effectiveness is query-then-write and race-prone | Phase 3 |
| Workspace Tasks 5.1–5.2 | CFPB exhaustion gate and direct-dispute advisory are absent | Phase 5 |
| Verification gates | Authenticated Playwright coverage is set up and expanded; the authorized seeded-database run passes in all configured browsers. The repository validation command now passes with a deterministic Vitest split for two stateful test files | Phase 6 |

The current state is:

- implementation and focused regression coverage are complete;
- lint, typecheck, focused unit tests, production build, and all configured authenticated browser projects pass;
- the user-reported migration completed against the authorized disposable/development Neon target; and
- the repository validation command is now deterministic on the workspace filesystem: Vitest uses four threads for the parallel batch, runs the two stateful cross-file mock suites in isolation, and retains the full 121-file/912-test coverage.

Two implementation defects discovered during this audit are included in scope because they prevent the planned behavior:

1. The first-super-admin bootstrap in `set-role/route.ts` cannot succeed: it asks `getAdminSessionUser('super_admin')` for a requester before a super admin exists, then rejects a null requester.
2. Wizard generation returns `library_selection`, but `useLetterGeneration` ignores it. `useBulkDisputeSubmission` later posts only `letterContent`, causing the dispute creation route to skip selection and save `letterTemplateId = null`.

## Architectural decisions

### 1. Capability authorization is the only role gate

`requireCapability()` and `can()` are the external interface. `getAdminSessionUser()`, `isSuperAdmin()`, `isAdmin()`, client `AdminGuard`, and `/api/admin/check-access` are deleted after their callers migrate. Route-level capability checks remain authoritative; client checks only hide unavailable controls.

### 2. Generated letters become persisted drafts immediately

The current wizard has no dispute ID during review, while every revision belongs to a dispute. Generation therefore creates a `draft` dispute and revision 1 before Step Review. `GeneratedLetter.id` becomes the real dispute ID. “Mark All as Sent” updates those drafts rather than creating a second set of disputes.

This produces one lifecycle:

```text
generate -> draft dispute + revision 1 -> edit/rewrite/revert -> mark sent -> immutable
```

It also makes library attribution, strategy rationale, lint context, and history durable across reloads.

### 3. Letter writes cross one transactional seam

Create a deep `dispute-letter-workflow` module. Callers provide an intent; the module locks the dispute, checks immutability and optimistic version, lints, requires warning acknowledgement, updates `disputes.letterContent`, and appends the next revision in one transaction. Manual save, AI rewrite, generated revision, and revert do not implement these rules independently.

### 4. Compliance is a runtime decision

Static methodology configuration can recommend `cfpb_complaint`, but it cannot know submission dates or response state. A pure eligibility function plus an escalation-decision module gates every manual and automated CFPB path. Direct-dispute guidance remains advisory.

### 5. Audit and effectiveness writes are concurrency-safe

Role and configuration mutations write an activity row in the same transaction. Library effectiveness uses one atomic SQL update based on the outcome transition; concurrent outcomes cannot overwrite one another.

---

## Phase 1: Finish capability migration, Team & Roles, and activity audit

### Task 1.1: Add the administration activity log

**Files:**

- Modify: `db/schema.ts`
- Generate: `drizzle/0039_*.sql` and matching snapshot/journal entries
- Create: `src/lib/admin-activity.ts`
- Test: `src/__tests__/lib/admin-activity.test.ts`

**Schema:**

```typescript
export const adminActivityLog = pgTable('admin_activity_log', {
  id: text('id').primaryKey(),
  actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: text('subject_id'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => [
  index('admin_activity_log_actor_idx').on(table.actorUserId),
  index('admin_activity_log_createdAt_idx').on(table.createdAt),
]);
```

Expose a small interface that accepts either `db` or the current transaction executor internally:

```typescript
export interface AdminActivityInput {
  actorUserId: string | null;
  action: string;
  subjectType: 'user_role' | 'letter_library' | 'settings' | 'automation';
  subjectId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAdminActivity(
  executor: DatabaseExecutor,
  input: AdminActivityInput,
): Promise<void>;
```

**Steps:**

1. Write tests for JSON metadata serialization, null actor support, and executor delegation.
2. Add the schema and generate the migration with `npm run db:generate`; never use `db:push`.
3. Implement the helper without swallowing errors. A protected mutation must roll back if its audit row cannot be written.
4. Run `npx vitest run src/__tests__/lib/admin-activity.test.ts` and `npm run typecheck`.
5. Commit: `feat(audit): add transactional administration activity log`.

### Task 1.2: Centralize role changes and fix bootstrap

**Files:**

- Create: `src/lib/team-role-management.ts`
- Modify: `src/app/api/admin/set-role/route.ts`
- Create: `src/app/api/admin/team/route.ts`
- Test: `src/__tests__/lib/team-role-management.test.ts`
- Test: `src/__tests__/api/admin/team.test.ts`

The role-management interface owns validation, lockout protection, mutation, and audit:

```typescript
export type ChangeRoleResult =
  | { ok: true; userId: string; email: string; previousRole: UserRole; role: UserRole }
  | { ok: false; code: 'not_found' | 'last_super_admin' | 'invalid_role' };

export async function changeUserRole(input: {
  actorUserId: string;
  targetUserId: string;
  role: UserRole;
}): Promise<ChangeRoleResult>;
```

Inside one transaction, lock the target row and current super-admin rows, reject a demotion that would leave zero super admins, update the role, and write `user_role.changed` with old/new roles. This protects against two concurrent demotions.

For `/api/admin/set-role`:

- When no super admin exists, authenticate with `auth.api.getSession()` directly and allow only that signed-in user to promote their own email to `super_admin`.
- Once a super admin exists, require `team:manage` and delegate to `changeUserRole`.
- Keep the endpoint only for bootstrap/backward compatibility; the Team screen uses `/api/admin/team`.

For `/api/admin/team`:

- `GET` requires `team:manage`, lists team-role users, and derives `last_active_at` from the latest `session.updatedAt`.
- `PATCH` requires `team:manage`, accepts `{ user_id, role }`, and delegates to `changeUserRole`.

**Tests:** invalid role; admin gets 403; super admin changes a role; missing user gets 404; last-super-admin demotion gets 409; two attempted final demotions cannot both succeed; bootstrap is self-only and only when zero super admins exist; audit data contains actor, target, old role, and new role.

**Verify:**

```bash
npx vitest run src/__tests__/lib/team-role-management.test.ts src/__tests__/api/admin/team.test.ts
npm run typecheck
```

**Commit:** `feat(admin): add audited team and role management`.

### Task 1.3: Build the Team & Roles administration screen

**Files:**

- Create: `src/app/admin/team/page.tsx`
- Create: `src/components/workspace/team/TeamManager.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/components/workspace/AdminSidebar.tsx`
- Test: `src/components/workspace/team/__tests__/TeamManager.test.tsx`

The server page requires `team:manage` and redirects other admin-tier users to `/admin`. The client module lists member, role, last active, and recent activity. Disable the current user's demotion control when the API reports they are the final super admin, but retain the server-side guard as authoritative.

Render Team & Roles navigation only when `can('team:manage')`. Admin users must not see a dead link.

**Verify:** render tests cover loading, 403, role update, API error, and final-owner copy.

**Commit:** `feat(admin): surface team roles and activity`.

### Task 1.4: Migrate every remaining legacy authorization caller

**Files:**

- Modify: `src/app/api/admin/automation/dispute-escalations/run/route.ts` -> `settings:write`
- Modify: `src/app/api/admin/billing/route.ts`
- Modify: `src/app/api/admin/credit-report-pulls/route.ts` -> `disputes:read`
- Modify: `src/app/api/admin/dispute-cycles/route.ts` -> `disputes:write`
- Modify: `src/app/api/admin/evidence-packets/route.ts` -> `disputes:write`
- Modify: `src/app/api/admin/service-engagements/[id]/compliance-gate/route.ts` -> `agreements:read`
- Modify: `src/app/api/admin/service-engagements/route.ts` -> GET `agreements:read`; POST/PATCH `agreements:write`
- Modify: `src/app/api/admin/services-rendered-events/route.ts` -> `billing:client`
- Modify: corresponding API tests under `src/__tests__/api/admin/`

Billing requires command-level classification:

- Reading invoices and client billing profiles: `billing:client`.
- Reading or changing fee configuration: `billing:system`.
- Creating a client billing profile or invoice: `billing:client`.

Remove local `validateAdmin` wrappers. Update stale tests to mock `requireCapability`, and add a staff-allowed/admin-only-denied assertion for each capability family.

**Completion search:**

```bash
git grep -n -E 'getAdminSessionUser|isSuperAdmin|isAdmin|roleHasPermission|AdminPermission' -- src
```

Expected after Task 1.5: no application matches.

**Commit:** `refactor(auth): finish capability migration for protected routes`.

### Task 1.5: Delete the client authorization guard and legacy role helpers

**Files:**

- Modify: `src/app/admin/email-templates/page.tsx`
- Delete: `src/components/workspace/AdminGuard.tsx`
- Delete: `src/components/workspace/__tests__/AdminGuard.test.tsx`
- Delete: `src/app/api/admin/check-access/route.ts`
- Modify: `src/lib/admin-session.ts`
- Modify: `src/lib/admin-auth.ts`

Remove the email-template page wrappers; `/admin/layout.tsx` already performs server authorization before rendering. Delete `getAdminSessionUser`, `isSuperAdmin`, and `isAdmin` after Task 1.4 and the role endpoint have no callers.

Run the completion search from Task 1.4 plus:

```bash
git grep -n 'AdminGuard' -- src
```

Only historical plan text may remain. Run `npm run typecheck` and all admin API tests.

**Commit:** `refactor(auth): retire legacy client and role guards`.

### Task 1.6: Audit real configuration mutations

**Files:**

- Modify: `src/app/api/admin/letter-library/route.ts`
- Modify: `src/app/api/admin/letter-library/[id]/route.ts`
- Modify: `src/app/api/admin/settings/route.ts`
- Modify: `src/app/api/admin/settings/llm/route.ts`
- Modify: `src/app/api/admin/automation/route.ts`
- Test: `src/__tests__/api/admin/admin-activity.test.ts`

Wrap each library create/update/deactivate and each settings or automation mutation in a transaction with `recordAdminActivity`. Log identifiers and changed field names, never secret values, prompt bodies, API keys, or client PII.

This does not revive audit work for the deprecated decoy table. It audits the real library that now influences outgoing generation.

**Commit:** `feat(audit): record role and configuration changes`.

---

## Phase 2: Finish portal isolation and navigation

### Task 2.1: Make the portal layout the sole page-auth owner

**Files:**

- Modify: `src/app/portal/layout.tsx`
- Modify: `src/app/portal/page.tsx`
- Modify: `src/app/portal/agreement/page.tsx`
- Modify: `src/app/portal/audit-report/page.tsx`
- Test: `src/__tests__/app/portal-layout.test.tsx`

The layout must query the database role after resolving the session. Unauthenticated users go to `/sign-in?next=/portal`; team roles go to `/workspace`; client users render the portal shell.

Because the server layout guarantees authentication, remove `useAuth`, `authLoading`, and `if (!user)` from all three client pages. Fetch page data on mount rather than waiting on client auth hydration. Keep API-level client ownership checks unchanged.

**Completion search:**

```bash
git grep -n -E 'if \(!user\)|authLoading' -- src/app/portal
```

Expected: no matches.

**Commit:** `refactor(portal): make server layout the sole page auth guard`.

### Task 2.2: Add “My Portal” to both header menus

**Files:**

- Modify: `src/components/Header.tsx`
- Test: `src/components/__tests__/Header.test.tsx`

For signed-in non-team users, render “My Portal” -> `/portal` in desktop and mobile user menus. Team users continue to see “Workspace” and do not see “My Portal”. Use `isTeamRole()` rather than repeating role string comparisons.

The existing footer link remains.

**Commit:** `feat(nav): expose the client portal in signed-in navigation`.

### Task 2.3: Lock role-aware landing behavior with tests

**Files:**

- Test: `src/__tests__/api/auth/landing.test.ts`
- Later E2E: `e2e/auth-redirect.spec.ts`

Test safe internal `next` handling, rejection of `//host` open redirects, client fallback to `/portal`, staff fallback to `/workspace`, and rejection of workspace `next` for a client. Do not broaden `next` authorization by path prefix alone.

**Commit:** `test(auth): cover role-aware post-sign-in landing`.

---

## Phase 3: Make letter persistence, attribution, and feedback coherent

### Task 3.1: Harden letter revision and lint-context storage

**Files:**

- Modify: `db/schema.ts`
- Generate: next `drizzle/NNNN_*.sql` and metadata
- Modify: `src/lib/letter-lint-context.ts`
- Test: `src/__tests__/lib/letter-lint-context.test.ts`

Add:

- A unique index on `(dispute_id, revision)`.
- `disputes.letterContextSnapshot` as JSON text containing the allowed creditor names, account tokens, bureaus, identity-theft flag, and reason codes used at generation time.
- `dispute_letter_revisions.generationMetadata` as JSON text for library row ID, selection score, rationale, and runners-up on generated revisions.

The snapshot is necessary for combined, personal-information, and inquiry letters that cannot be reconstructed from one `negativeItemId`. `buildLetterLintContextForDispute` reads the snapshot first and falls back to joined legacy fields.

Do not store unmasked account numbers or unnecessary client PII in either JSON field.

**Commit:** `feat(db): harden letter revision and generation context`.

### Task 3.2: Create the transactional letter-workflow module

**Files:**

- Create: `src/lib/dispute-letter-workflow.ts`
- Replace internals: `src/lib/dispute-letter-revisions.ts`
- Test: `src/__tests__/lib/dispute-letter-workflow.test.ts`

Public interface:

```typescript
export type SaveLetterResult =
  | { kind: 'saved'; content: string; revision: number; updatedAt: Date; findings: LetterLintFinding[] }
  | { kind: 'warnings'; findings: LetterLintFinding[] }
  | { kind: 'blocked'; findings: LetterLintFinding[] }
  | { kind: 'immutable' }
  | { kind: 'conflict'; currentContent: string; currentRevision: number };

export async function saveDisputeLetter(input: {
  disputeId: string;
  content: string;
  source: LetterRevisionSource;
  actorUserId: string;
  acknowledgeWarnings: boolean;
  expectedRevision?: number;
  toneLabel?: LetterTone | null;
  promptUsed?: string | null;
  generationMetadata?: GenerationMetadata | null;
}): Promise<SaveLetterResult>;
```

Implementation order inside one transaction:

1. Lock the dispute row with `FOR UPDATE`.
2. Reject sent disputes.
3. Compare `expectedRevision` when supplied.
4. Build lint context and lint the entire proposed letter.
5. Return block or warning results without writing.
6. Read the latest revision number under the lock.
7. Update `disputes.letterContent` and `updatedAt`.
8. Insert the next revision with acknowledgement attribution and metadata.

Tests cover blocks, warning replay, sent immutability, stale revision conflict, concurrent revision numbering, source metadata, and rollback when revision insertion fails.

**Commit:** `feat(disputes): centralize transactional letter writes`.

### Task 3.3: Add the Letter Studio state and revert routes

**Files:**

- Create: `src/app/api/admin/disputes/[id]/letter/route.ts`
- Create: `src/app/api/admin/disputes/[id]/letter/lint/route.ts`
- Create: `src/app/api/admin/disputes/[id]/letter/revisions/[revisionId]/revert/route.ts`
- Modify: `src/app/api/admin/disputes/[id]/route.ts`
- Modify: `src/app/api/admin/disputes/[id]/letter/rewrite/route.ts`
- Test: `src/__tests__/api/admin/dispute-letter-state.test.ts`

`GET /letter` returns the current content, current revision, immutable reason, current lint result, revision summaries, attributed library row, and persisted selection rationale. It requires `disputes:read`.

`POST /letter/lint` performs a debounced preview lint for the UI. It requires `letters:write`; save remains authoritative.

Revert loads the selected revision and calls `saveDisputeLetter(source='revert')`; it never updates a revision row in place.

The existing dispute PUT and rewrite route call `saveDisputeLetter` rather than duplicating lint/update/revision logic. Rewrite requests send selection offsets plus expected selected text and revision; the server rejects stale or mismatched selections instead of replacing the first duplicate substring.

**Commit:** `feat(disputes): expose letter state history lint and revert`.

### Task 3.4: Persist generated wizard drafts and revision 1

**Files:**

- Create: `src/lib/dispute-draft-generator.ts`
- Create: `src/app/api/admin/disputes/drafts/generate/route.ts`
- Modify: `src/components/workspace/dispute-wizard/hooks/useLetterGeneration.ts`
- Modify: `src/components/workspace/dispute-wizard/types.ts`
- Modify: `src/components/workspace/dispute-wizard/types/letter-generation.ts`
- Modify: `src/components/workspace/dispute-wizard/hooks/useBulkDisputeSubmission.ts`
- Test: `src/__tests__/lib/dispute-draft-generator.test.ts`
- Test: `src/__tests__/api/admin/dispute-draft-generation.test.ts`

The draft generator does not hold a transaction open during an LLM call. It:

1. Loads and validates the client/items.
2. Selects the library row.
3. Generates and lints the letter.
4. Builds a masked lint-context snapshot.
5. In one short transaction, inserts the draft dispute with `letterTemplateId`, then inserts revision 1 with source `generated` and selection metadata.
6. Awaits best-effort library usage recording before returning, so the next request observes LRU rotation.

Return `{ dispute_id, revision, letter_content, library_selection, ... }`. `GeneratedLetter.id` becomes `dispute_id`; retain a separate stable React key if needed.

`handleBulkMarkAsSent` sends PUT requests to those dispute IDs with tracking/submission data. It checks every response, reports partial failures, and is idempotent on retry. It must not POST duplicate disputes.

For combined/personal/inquiry generation, persist `negativeItemId` only when it is a real tradeline FK and rely on the context snapshot for linting.

**Critical tests:** wizard-created draft has non-null library attribution when selected; revision 1 exists; selection rationale survives reload; marking sent updates rather than inserts; a failed send leaves the draft editable; a supplied draft ID can be regenerated without producing an unrelated duplicate.

**Commit:** `feat(disputes): persist generated letters as attributed drafts`.

### Task 3.5: Record generated revisions on non-wizard creation paths

**Files:**

- Modify: `src/app/api/admin/disputes/route.ts`
- Modify: `src/app/api/admin/disputes/[id]/quick-redispute/route.ts`
- Modify: `src/app/api/admin/disputes/[id]/route.ts`
- Modify: `src/lib/dispute-escalation-runner.ts`
- Test: existing dispute-generation and escalation suites

Move shared persistence into the draft generator or a lower `persistGeneratedDispute` helper. Every path that stores a generated letter must also store:

- `letterTemplateId`;
- the lint-context snapshot;
- revision 1 with source `generated`;
- selection rationale metadata.

Do not let each route hand-roll these four writes.

**Commit:** `refactor(disputes): unify generated-letter persistence across entry points`.

### Task 3.6: Make library usage and effectiveness concurrency-safe

**Files:**

- Modify: `src/lib/ai-letter-generator.ts`
- Modify: `src/lib/letter-library-repo.ts`
- Modify: `src/lib/letter-library-effectiveness.ts`
- Modify: outcome handling in `src/app/api/admin/disputes/[id]/route.ts`
- Test: `src/__tests__/lib/letter-library-effectiveness.test.ts`
- Test: `src/__tests__/lib/letter-library-repo.test.ts`

Make usage tracking an awaited best-effort operation after successful generation. The helper catches/logs its own error, so letter generation still succeeds, but a completed response guarantees the next selection can see `lastUsedAt`.

Replace effectiveness read/calculate/write with one SQL update:

```sql
success_count = greatest(0, coalesce(success_count, 0) + :delta)
effectiveness_rating = case
  when coalesce(times_used, 0) >= 10
  then round(greatest(0, coalesce(success_count, 0) + :delta) * 100.0 / times_used)
  else null
end
```

Compute `delta` from the previous and next outcome. Cover `null -> deleted`, `deleted -> verified`, `deleted -> null`, no-op transitions, null attribution, and two concurrent successes. Await the update from the outcome workflow; do not use `void`.

**Commit:** `fix(library): make usage and effectiveness updates deterministic`.

### Task 3.7: Harden letter-library admin contracts

**Files:**

- Modify: `src/app/api/admin/letter-library/route.ts`
- Modify: `src/app/api/admin/letter-library/[id]/route.ts`
- Modify: `src/app/admin/letter-library/page.tsx`
- Test: `src/__tests__/api/admin/letter-library.test.ts`

Use a tagged parser so malformed arrays return 400 instead of silently becoming null. Reactivation must send arrays, not comma-separated draft strings that fail JSON parsing and erase matching metadata. Cover read capability, write capability, create, patch, deactivate, reactivate, malformed arrays, and preservation of historical FK rows.

**Commit:** `fix(library): preserve matching metadata across admin CRUD`.

---

## Phase 4: Complete Letter Studio UI in both workflows

### Task 4.1: Split Letter Studio into focused UI modules

**Files:**

- Modify: `src/components/workspace/disputes/LetterStudio.tsx`
- Create: `src/components/workspace/disputes/LetterCompliancePanel.tsx`
- Create: `src/components/workspace/disputes/LetterRevisionHistory.tsx`
- Create: `src/components/workspace/disputes/LetterDiffView.tsx`
- Create: `src/lib/letter-diff.ts`
- Test: `src/components/workspace/disputes/__tests__/LetterStudio.test.tsx`
- Test: `src/__tests__/lib/letter-diff.test.ts`

The Studio loads its aggregate state from `GET /letter`. Its layout is:

- Left: editable monospace letter body.
- Right: compliance status, attributed strategy/rationale, AI controls, revision history, diff, and revert.

Required behavior:

- Debounced server lint updates the compliance panel while typing; save re-lints.
- Blocks are red and disable Save.
- Warnings are amber and keep Save enabled; one confirmation replays with acknowledgement.
- Clean state is a quiet check.
- Autosave fires when focus leaves the Studio and the draft is dirty. Moving focus from the text area to a Studio action must not trigger a competing save.
- Rewrites use selection start/end, not only text value.
- History shows source, tone, author, acknowledgement, and date.
- Diff compares current draft with any selected revision.
- Revert creates a new revision.
- Sent disputes show an explanatory immutable banner and no edit/AI controls.

Keep orchestration in `LetterStudio`; keep rendering and diff logic in the smaller modules. Do not expose raw prompt text or PII in the UI.

**Commit:** `feat(workspace): complete Letter Studio history compliance and diff`.

### Task 4.2: Mount the same Studio in Step Review

**Files:**

- Modify: `src/components/workspace/dispute-wizard/StepReview.tsx`
- Modify: `src/components/workspace/disputes/DisputeDetailPanel.tsx`
- Test: `src/components/workspace/dispute-wizard/__tests__/StepReview.test.tsx`

Replace the wizard’s read-only `<pre>` with `LetterStudio` for each persisted draft. Keep Copy and Download actions wired to the latest saved content. On save/rewrite/revert, update `generatedLetters` so submission uses the same content shown in the editor.

The detail panel mounts the same Studio but determines immutability from the server aggregate, not a response-received heuristic passed by the modal.

**Commit:** `feat(workspace): use Letter Studio in wizard review and dispute detail`.

---

## Phase 5: Apply compliance decisions at the correct seams

### Task 5.1: Implement CFPB eligibility as pure policy

**Files:**

- Create: `src/lib/cfpb-eligibility.ts`
- Test: `src/__tests__/lib/cfpb-eligibility.test.ts`

The current CFPB complaint notice requires a prior CRA dispute and an attestation that it was submitted more than 45 days ago or is no longer pending. Use the official CFPB notice as the implementation source: <https://www.consumerfinance.gov/complaint/credit-and-consumer-reporting-complaint-notice-2/>.

```typescript
export interface CfpbEligibility {
  eligible: boolean;
  reason: 'eligible' | 'missing_cra_dispute' | 'not_sent' | 'still_pending';
  eligibleAt: Date | null;
}

export function assessCfpbEligibility(input: {
  submittedToCra: boolean;
  sentAt: Date | null;
  responseReceivedAt: Date | null;
}, now?: Date): CfpbEligibility;
```

Calculate 45 calendar days in UTC-safe date arithmetic. A received response is “no longer pending” and makes the complaint eligible even before day 45. A direct-furnisher letter alone does not satisfy the prior-CRA-dispute requirement.

**Commit:** `fix(compliance): model CFPB complaint eligibility`.

### Task 5.2: Gate every manual and automated CFPB path

**Files:**

- Create: `src/lib/dispute-escalation-decision.ts`
- Modify: `src/lib/dispute-automation.ts`
- Modify: `src/lib/dispute-escalation-runner.ts`
- Modify: `src/app/api/admin/disputes/[id]/route.ts`
- Modify: `src/app/api/admin/disputes/drafts/generate/route.ts`
- Modify: wizard context/payload files for `priorDisputeId`
- Modify: `src/components/workspace/dispute-wizard/StepConfigure.tsx`
- Test: `src/__tests__/lib/dispute-escalation-decision.test.ts`
- Test: `src/__tests__/lib/dispute-escalation-runner.test.ts`

`buildEscalationPlan` remains a pure strategy function. `decideEscalation` wraps it with persisted history and returns either `ready` or `blocked` with reason and `eligibleAt`.

When a round-3 creditor dispute escalates to CFPB, walk `priorDisputeId` to find the most recent CRA dispute in the chain; do not incorrectly assess only the current creditor letter.

For the wizard:

- CFPB generation requires an eligible `priorDisputeId` belonging to the same client/item chain.
- Disable combined CFPB generation when one eligible prior dispute cannot be identified per item.
- Surface the eligibility date and reason before generation.
- Recheck server-side; client state is advisory.

For automation, defer ineligible CFPB candidates rather than marking them failed. Return a deferred count and next eligibility date for observability; later runs will reconsider them.

Do not treat edits to `dispute-config-loader.ts` alone as enforcement.

**Commit:** `fix(compliance): enforce CFPB exhaustion across escalation paths`.

### Task 5.3: Add the Regulation V direct-dispute advisory

**Files:**

- Modify: `src/components/workspace/dispute-wizard/StepConfigure.tsx`
- Test: `src/components/workspace/dispute-wizard/__tests__/StepConfigure.test.tsx`

For `creditor` or `collector`, display an advisory that a furnisher may decline the direct-dispute investigation process if it reasonably believes a credit repair organization prepared or supplied the dispute, while a CRA dispute follows the FCRA reinvestigation route. Keep the choice enabled.

Use the current official text at 12 CFR 1022.43(b)(2): <https://www.ecfr.gov/current/title-12/chapter-X/part-1022/subpart-E/section-1022.43>.

Test that the advisory appears only for direct recipients and never blocks Next/Generate.

**Commit:** `feat(compliance): advise operators about direct-dispute treatment`.

---

## Phase 6: Close verification, E2E, and documentation

### Task 6.1: Create deterministic authenticated Playwright setup

**Files:**

- Create: `e2e/setup/auth.setup.ts`
- Create: `e2e/fixtures/auth.ts`
- Modify: `playwright.config.ts`
- Modify: `e2e/dispute-wizard.spec.ts`
- Create or update: test fixture setup script only if the HTTP setup cannot create required records safely

Use Better Auth’s HTTP sign-up/sign-in endpoints and Playwright storage states. Bootstrap the first test super admin through the fixed self-bootstrap route when the database is empty; when a seeded development database already has a super admin, use the separately configured `E2E_AUTHORITY_EMAIL` and `E2E_AUTHORITY_PASSWORD` through the protected role API, then create/assign staff, admin, and client users. Keep credentials in test-only environment variables and generated temporary storage files; never commit credentials or auth state.

Update stale `/admin/disputes/wizard` paths to `/workspace/disputes/wizard`. Tests must fail clearly when fixture setup fails; do not silently continue when client cards are absent.

**Commit:** `test(e2e): add deterministic role-authenticated fixtures`.

### Task 6.2: Add the required browser journeys

**Files:**

- Create: `e2e/auth-redirect.spec.ts`
- Create: `e2e/portal-shell.spec.ts`
- Create: `e2e/letter-studio.spec.ts`
- Create: `e2e/team-roles.spec.ts`
- Modify: `e2e/dispute-wizard.spec.ts`

Cover:

1. Client/staff role-aware sign-in and safe `next` behavior.
2. Portal tabs on all three pages, no marketing chrome, pending approvals above the grid, and “My Portal” navigation.
3. Manual letter save, selection rewrite, all five tones, warning acknowledgement, hard block, history, diff, revert, autosave, and sent read-only state.
4. Wizard generation -> persisted draft -> non-null library attribution -> revision 1 -> edit -> mark sent without duplicate insertion.
5. Team role change, admin denial, last-super-admin protection, and activity row display.
6. CFPB pre-45-day block, eligible-date copy, response-received allowance, and direct-dispute advisory.

Run Chromium during task iteration; run all configured browsers at the phase gate.

**Commit:** `test(e2e): cover workspace portal and Letter Studio completion`.

### Task 6.3: Run full validation and diagnose the build stall

Run in this order, capturing exit codes and logs:

```bash
git diff --check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

If `next build` stalls again:

1. Confirm no `next dev`, `next build`, or stale server process owns `.next`.
2. Move the existing `.next` directory to a task-specific temporary backup or remove only `.next` after confirming the target.
3. Rerun `npm run build` with a bounded 10-minute timeout and capture the complete log.
4. If it still stalls, isolate whether compilation, type generation, or page-data collection is the last completed stage. Treat the stall as a bug and use `superpowers:systematic-debugging`; do not mark this plan complete with an interrupted build.

The plan is not complete until `npm run validate` exits 0 and Playwright passes.

### Task 6.4: Synchronize agent and source-plan documentation

**Files:**

- Modify: `docs/plans/2026-07-31-workspace-portal-restructure-and-letter-studio.md`
- Modify: `docs/plans/2026-07-31-letter-library-wiring.md`
- Modify: `src/app/workspace/AGENTS.md`
- Modify: `src/app/portal/AGENTS.md`
- Modify: `src/components/AGENTS.md`
- Modify: `src/lib/AGENTS.md`
- Modify: `db/AGENTS.md`

Update stale references to `AdminGuard`, old `src/components/admin` paths, inline portal auth, and the three-role union. Add a completion note to both source plans that points to this plan and records final validation results, migration IDs, and any re-ratified deferrals.

Do not mark a source phase complete based only on code presence. Record the passing command and date.

**Commit:** `docs(plans): close workspace portal and letter library implementation`.

---

## Phase gates

After each phase:

```bash
npm run typecheck
npm run lint
npm run test
git diff --check
```

After schema phases:

```bash
npm run db:generate
# Review generated SQL and snapshot; apply only against the intended database.
npm run db:migrate
```

Final gate:

```bash
npm run validate
npm run test:e2e
```

## Manual role smoke matrix

| Actor | Required result |
|---|---|
| Client | Lands on `/portal`; sees persistent portal tabs and “My Portal”; cannot enter workspace/admin |
| Staff | Lands on `/workspace`; can manage clients/disputes/letters; cannot enter `/admin` |
| Admin | Lands on `/workspace`; can enter `/admin` and edit real library/settings; cannot manage team |
| Super admin | Can manage team; cannot demote the final super admin; sees activity history |

## Final data-integrity checks

1. Generate through the wizard and verify `disputes.letter_template_id` is non-null when a library row was selected.
2. Verify revision 1 is `generated`, subsequent saves increment exactly once, and revert appends rather than mutates.
3. Generate the same shape serially and verify LRU rotation is observable after each response.
4. Apply two concurrent deleted outcomes to disputes using the same library row and verify both successes are retained.
5. Deactivate a library row and verify historical disputes and revisions still resolve it while new generation excludes it.
6. Verify a CFPB draft cannot be generated from only a direct-furnisher letter or a pending CRA dispute younger than 45 days.
7. Verify activity metadata contains no secrets, full account numbers, or client PII.

## Execution order

Execute strictly in this order:

```text
Phase 1 control plane
  -> Phase 2 portal isolation
  -> Phase 3 transactional letter/data lifecycle
  -> Phase 4 Letter Studio UI
  -> Phase 5 compliance decisions
  -> Phase 6 E2E, build, and documentation
```

Phase 3 must finish before Step Review work, because the wizard needs real dispute IDs and revision state. Phase 1 must finish before Team E2E, because the fixture bootstrap and role APIs depend on the completed authorization seam.

## Implementation handoff — 2026-08-02

The scheduled code work is implemented through the shared dirty worktree, including the final shared persistence refactor for the main dispute creation route, the critical supplied-draft regeneration path, the missing escalation-runner and wizard advisory coverage, deterministic browser fixtures, and the AI-mode wizard validation fix that allows selected items to proceed without template-only instructions. Validation currently stands at:

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `git diff --check` — pass.
- CFPB wizard eligibility preview — implemented through the authenticated predecessor-preview route, with client/item matching, eligibility-date/reason copy, and single-item predecessor validation.
- CFPB server enforcement — all item-payload forms, including legacy `negativeItemIds`, now reject multi-item CFPB generation before letter generation; the selected item is checked against the matched CRA predecessor.
- `npm run validate` — pass end-to-end after making Vitest’s thread pool and stateful-file isolation explicit in the `test` script.
- Full Vitest suite — pass: the parallel batch completed 119 files with 882 passing and 27 skipped tests; the two isolated files completed 2 files with 3 passing tests. Total: 121 passed files, 1 skipped file, 885 passed tests, 27 skipped tests (912 total).
- `npm run lint` — pass.
- `npm run typecheck` — pass, including the production build’s TypeScript stage.
- Focused changed-area unit coverage — pass, 3 files and 8 tests covering wizard configuration/review and Letter Studio.
- `npm run test:e2e -- --list` — pass, 94 listed tests across the configured browsers.
- Authenticated Playwright project gates — pass: Chromium 32/32, Firefox 32/32, and WebKit 32/32, using the authorized seeded-development authority path and no auth bypass.
- User-reported `npm run db:migrate` — returned to the shell without an error against the authorized development target.
- Read-only role audit — the target currently contains one `super_admin` and one `user`, confirming that empty-database bootstrap is not the applicable E2E path.
- `npx drizzle-kit check` — pass after aligning Drizzle configuration with Next-style local environment precedence (`.env.local` before `.env`).
- Elevated `npm run build` — pass end-to-end, including compilation, TypeScript, page-data collection, 126 static pages, and route optimization. The restricted sandbox still hits the known Next 16 Turbopack worker-port permission error.

The scheduled implementation, full repository validation, migration confirmation, and authenticated browser gates are complete. Phase 7A follow-up work adds authenticated command-palette record search and a read-only deprecated-table audit without a destructive migration. Phase 7B adds the read-only letter-library generation pilot; its authorized development run passed with four selected scenarios, two intentional fallbacks, three synthetic contract checks, and no usage writes. API namespace renaming, custom roles, contingent statutory disclosure, physical table removal, and provider-backed pilot execution remain intentional deferrals.

## Response-review work queue follow-up — 2026-08-03

The staff-facing response-review work queue is complete. Recording a structured review returns a pure recommendation and rejects obsolete auto-create requests. Actual responses require a response date and evidence URL; `no_response` is accepted only after the persisted deadline and does not invent response evidence. The workspace queue loads the existing awaiting-response list, orders reviews by deadline, opens the shared review panel, and keeps the panel open to display its recommendation. `quick-redispute` is now the separate, revalidated “Create recommended draft” action for eligible verified and no-response reviews; it verifies evidence/deadline state, report approval, duplicate-child prevention, and CFPB eligibility before generation.

Focused verification passed on 2026-08-03: 7 relevant API/component/page suites (42 tests) and the complete TypeScript check. The full repository test and lint commands remain the final workspace-wide release gates.
