# Letter Library Wiring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **Companion plan:** `docs/plans/2026-07-31-workspace-portal-restructure-and-letter-studio.md`. That plan moves routes and adds per-dispute letter editing; this one connects the dormant letter library to letter generation. They are independent — but read "Cross-plan interactions" below before running them concurrently.

**Goal:** Connect `dispute_letter_library` — a fully designed, fully seeded, entirely unread table — to the AI letter generator, so methodology selection, prompt enrichment, and effectiveness feedback drive letter quality.

**Architecture:** The library is not a store of letter text to paste. Its `promptContext`, `methodology`, `legalCitations`, `itemTypes`, and `reasonCodes` columns make it **AI scaffolding**: pick the best-fitting row for a given item/round/recipient, fold its guidance into the generation prompt, record which row produced which dispute, then feed dispute outcomes back as an effectiveness score that improves future selection.

**Tech Stack:** TypeScript, Drizzle ORM (Postgres), the existing multi-provider LLM layer in `src/lib/ai-letter-generator.ts`, Vitest.

---

## Context: verified findings

Established by direct code inspection on 2026-07-31 (source files only):

1. **The library table is complete and indexed for selection.** `disputeLetterLibrary` (`db/schema.ts:910-935`) carries `methodology`, `targetRecipient`, `round`, `itemTypes`, `bureau`, `reasonCodes`, `content`, `promptContext`, `legalCitations`, plus `timesUsed` / `successCount` / `effectivenessRating` / `lastUsedAt`. It has three indexes — on `methodology`, `targetRecipient`, and `round` — which only make sense for a selection query nobody wrote.
2. **Nothing in `src/` reads or writes it.** The only references anywhere are two seed scripts: `scripts/seed-consolidated-templates-v2.ts:888` and `scripts/seed-consolidated-dispute-templates.ts:1271`.
3. **The other template table is a decoy.** `scripts/seed-templates-to-correct-table.ts:166` seeds 20 rows into `disputeLetterTemplates` whose entire body is the placeholder `[Template: {name}] … Check dispute_letter_library for full content.` The real content went to the library.
4. **The generator has an obvious seam.** `buildManualLetterPrompt` (`src/lib/ai-letter-generator.ts:270-315`) hardcodes strategy as a three-branch ternary on `round` alone:
   - round ≥ 3 → "direct furnisher escalation… FCRA Section 623(a)(8)"
   - round = 2 → "method-of-verification follow-up… Section 611(a)(6)(B)(iii)"
   - else → "initial factual dispute"

   That ternary is exactly what `methodology` + `promptContext` + `legalCitations` were designed to replace with data.
5. **The attribution column already exists.** `disputes.letterTemplateId` (`db/schema.ts:786`) is written by nothing and read by nothing. It is the natural foreign key from a dispute back to the library row that generated it — required for any effectiveness loop.

**Unverified — Task 1.1 resolves before anything else is built:** whether the seed scripts have been run against the live database, which of the two library seeders is canonical, and whether their contents overlap or conflict.

### Ground truth — 2026-08-02 audit

`npx tsx scripts/audit-letter-library.ts` was run against the configured database. The active library contains 20 rows and the decoy `dispute_letter_templates` table contains 65 rows. All 20 library rows have non-empty `promptContext` and legal-citation data. No duplicate `(name, content)` signatures were found, so no canonical-seeder deactivation is required.

All 20 active rows carry the seeded `effectivenessRating = 85` with `timesUsed = 0`; selection must ignore those ratings and the normalization step must clear them. The audit found 16 methodology/recipient/round coverage gaps, including factual round 2/3 escalation combinations and furnisher paths. Those combinations must fall back to the existing round strategy rather than fail generation.

### Implementation status — 2026-08-02

Phases 1–5 are implemented: the audit and normalization scripts ran, selection and defensive query layers are covered by tests, generation paths record library attribution and usage, outcomes update effectiveness with transition guardrails, and the admin library screen supports soft deactivation plus CRUD. The placeholder template routes were retired while the legacy table remains for compatibility.

---

## Phase 1: Establish ground truth

### Task 1.1: Inventory what is actually in the tables

**Files:** Create `scripts/audit-letter-library.ts`

Do not build selection logic against assumed data. Write a read-only script that reports:

- row count in `dispute_letter_library` and in `dispute_letter_templates`
- distinct `methodology`, `targetRecipient`, `round` values present in the library
- how many library rows have a non-null, non-empty `promptContext` (if most are null, the enrichment premise is weaker and Phase 3 shrinks)
- how many library rows carry `legalCitations`
- how many `dispute_letter_templates` rows still contain the literal string `Check dispute_letter_library` (i.e. are placeholder stubs)
- coverage gaps: any (methodology × targetRecipient × round) combination the generator can request that has **zero** matching library rows

Run it. Paste the output into this plan under a "Ground truth" heading before continuing.

**Decision gate:** if the two seeders wrote overlapping or contradictory rows, resolve which is canonical and deactivate the other via `isActive` **before** Phase 2. Selection quality is bounded by data quality.

**Commit:** `git commit -m "chore(library): read-only audit of dispute letter library contents"`

---

## Phase 2: Selection

### Task 2.1: Pure selection function

**Files:**
- Create: `src/lib/letter-library-selector.ts`
- Test: `src/__tests__/lib/letter-library-selector.test.ts`

Keep it pure and synchronous — take candidate rows in, return a ranked choice. The database query lives in the caller so the ranking is trivially testable.

```typescript
export interface LibraryCandidate {
  id: string;
  methodology: string;
  targetRecipient: string;
  round: number | null;
  itemTypes: string[] | null;      // parsed from JSON
  bureau: string | null;           // null = universal
  reasonCodes: string[] | null;    // parsed from JSON
  promptContext: string | null;
  legalCitations: string[] | null;
  effectivenessRating: number | null;
  timesUsed: number;
}

export interface SelectionRequest {
  round: number;
  targetRecipient: string;
  bureau: string;
  itemType: string;
  reasonCodes: string[];
  methodology?: string;            // when the operator forces one
}

export interface Selection {
  chosen: LibraryCandidate | null;
  score: number;
  rationale: string[];             // why this row won — surfaced in the UI
  runnersUp: Array<{ id: string; score: number }>;
}

export function selectLibraryRow(
  candidates: LibraryCandidate[],
  request: SelectionRequest,
): Selection;
```

**Ranking rules, in priority order** (write one test per rule, each asserting the rule *decides* a tie the previous rules leave open):

1. **Hard filter** — drop rows whose `targetRecipient` mismatches, or whose non-null `bureau` mismatches.
2. **Explicit methodology** — if `request.methodology` is set, drop everything else.
3. **Reason-code overlap** — score by count of intersecting `reasonCodes`. This is the strongest signal: it is what makes the letter item-specific, which per the companion plan's research is what keeps a dispute out of the bureaus' automated dismissal lane.
4. **Item-type match** — `itemTypes` containing `request.itemType`.
5. **Round proximity** — prefer exact `round`, then nearest; a null `round` is universal and scores neutral.
6. **Effectiveness** — `effectivenessRating` breaks remaining ties, but only when `timesUsed >= 10`. Below that the rate is noise.
7. **Least-recently-used** — final tiebreak, so identical-quality rows rotate. This is a deliberate anti-pattern-matching measure: always picking the same row for the same item shape reproduces the template-detection problem the library exists to solve.

**Explicit test: returns `chosen: null` when nothing survives the hard filter.** Generation must fall back cleanly to today's behavior, never fail.

**Commit:** `git commit -m "feat(library): pure selection and ranking for letter library rows"`

---

### Task 2.2: Query layer

**Files:**
- Create: `src/lib/letter-library-repo.ts`
- Test: `src/__tests__/lib/letter-library-repo.test.ts`

`fetchCandidates(request)` — query `disputeLetterLibrary` where `isActive`, filtered on `targetRecipient` and (`bureau` is null OR matches), using the three existing indexes. Parse the JSON text columns (`itemTypes`, `reasonCodes`, `legalCitations`) defensively; the seeders wrote them as `text`, and a malformed row must be skipped, not thrown on.

**Commit:** `git commit -m "feat(library): candidate query layer"`

---

## Phase 3: Injection into generation

### Task 3.1: Replace the hardcoded strategy ternary

**Files:**
- Modify: `src/lib/ai-letter-generator.ts:270-315` (`buildManualLetterPrompt`)
- Test: `src/__tests__/lib/letter-prompt-library.test.ts`

Extend `GenerateLetterParams` with an optional `librarySelection?: Selection`. When present, replace the `strategyInstruction` ternary with the library row's guidance; when absent, keep the existing ternary verbatim as the fallback path.

```
ROUND STRATEGY
${selection?.chosen?.promptContext ?? strategyInstruction}

${selection?.chosen?.legalCitations?.length
  ? `RELEVANT AUTHORITY\nGround the request in: ${selection.chosen.legalCitations.join(', ')}.\nCite at most two, in plain language. Do not stack citations.`
  : ''}
```

**"At most two, do not stack" is load-bearing.** The companion plan's research is consistent on this: letters dense with statutory citations read as professionally prepared and get classified as third-party under FCRA §611(a)(3). The library carries citations so the letter can be *grounded*, not so it can be *decorated*.

**Tests:** a selection with `promptContext` replaces the ternary; a null selection preserves today's prompt byte-for-byte (snapshot it first); citations render capped at two; empty `legalCitations` emits no AUTHORITY block at all.

**Commit:** `git commit -m "feat(library): drive generation strategy from library rows"`

---

### Task 3.2: Wire the call path and record attribution

**Files:**
- Modify: `src/app/api/admin/disputes/generate-letter/route.ts`
- Modify: `src/lib/ai-letter-generator.ts` (`generateUniqueDisputeLetter`)

Select before generating; persist `disputes.letterTemplateId` with the chosen row's id (the column exists at `db/schema.ts:786` and is currently dead). Without this write there is no effectiveness loop in Phase 4 — it is the whole linkage.

Return the selection `rationale` in the API response so the Letter Studio can show *why* a given strategy was chosen. Operators trust a recommendation they can see the reasoning for; an unexplained one reads as arbitrary.

**Commit:** `git commit -m "feat(library): select at generation time and record attribution"`

---

## Phase 4: The effectiveness loop

### Task 4.1: Increment usage on generation

**Files:** Modify `src/lib/letter-library-repo.ts`

On successful generation, `timesUsed += 1` and set `lastUsedAt`. Fire-and-forget — a stats write must never fail letter generation. Wrap in try/catch and log.

**Commit:** `git commit -m "feat(library): track library row usage"`

### Task 4.2: Fold outcomes back into effectiveness

**Files:**
- Create: `src/lib/letter-library-effectiveness.ts`
- Modify: the dispute outcome write path in `src/app/api/admin/disputes/[id]/route.ts`
- Test: `src/__tests__/lib/letter-library-effectiveness.test.ts`

When a dispute's `outcome` is set, resolve its `letterTemplateId` and update the library row: `successCount += 1` when the outcome is `deleted`, then recompute `effectivenessRating = round(successCount / timesUsed * 100)`.

**Guard rails to test explicitly:**
- An outcome transitioning `deleted → verified` (a correction) must **decrement** `successCount`, not double-count. Compute from the transition, never from the new value alone.
- A dispute with a null `letterTemplateId` — every dispute created before this plan — must be skipped silently.
- `effectivenessRating` stays null until `timesUsed >= 10`, matching the selector's threshold in Task 2.1 rule 6. A 1-for-1 row must not outrank a 40-for-60 row.

**Commit:** `git commit -m "feat(library): outcome-driven effectiveness scoring"`

---

## Phase 5: Admin surface

### Task 5.1: Library management screen

**Files:**
- Create: `src/app/admin/letter-library/page.tsx`
- Create: `src/app/api/admin/letter-library/route.ts` + `[id]/route.ts`

Gated `templates:write` from the companion plan's capability model — this is the screen that finally gives that capability something real to guard.

List rows with methodology, recipient, round, times used, and effectiveness. Full CRUD, including `isActive` deactivation rather than deletion (never destroy a row a past dispute points at — the attribution FK must stay resolvable for the audit trail).

### Task 5.2: Retire the decoy table

**Files:** `src/app/admin/dispute-templates/`, `src/app/api/admin/dispute-templates/`, `AdminSidebar.tsx`, `AdminTopBar.tsx:18`, `OperationsTab.tsx:97`

Once the library screen is live, `dispute_letter_templates` has no reason to exist — it holds placeholder stubs that no code reads. Remove the routes and the three nav links, and drop `templates:read` if nothing else claims it.

Leave the **table** in place; deleting it is a migration with no upside. Mark it deprecated in `db/schema.ts` with a comment pointing at this plan.

**Commit:** `git commit -m "refactor(library): retire the placeholder template table"`

---

## Cross-plan interactions

Read before running this concurrently with the restructure plan.

1. **File collision on `ai-letter-generator.ts`.** The companion plan's Task 4.0 edits the three `allowThreatLanguage` sites (`:363`, `:378`, `:1440`); this plan's Task 3.1 edits `buildManualLetterPrompt` (`:270-315`). Different regions, but land Task 4.0 first — it changes `LetterLintContext`'s shape, which Task 3.1's tests construct.

2. **`templates:write` is defined there, used here.** The companion plan cuts its Task 6.1 because the capability guards nothing real. Task 5.1 above is what makes it meaningful. If this plan is abandoned, reconsider whether the capability earns its place.

3. **The generation prompt hardcodes professional tone.** `buildManualLetterPrompt:284-286` contains `Do not threaten legal action, damages, or punishment` and `Keep the tone professional, specific, and factual`. The companion plan's five-step tone ladder applies at **rewrite** time only, so generated letters will always start professional and shift on demand. That is a coherent design — generate neutral, escalate deliberately — but it is worth stating so nobody later "fixes" the generation prompt to accept a tone parameter and quietly makes every first-round letter demanding.

4. **Route paths.** This plan writes `src/app/admin/letter-library/`, which is correct under the companion plan's split (configuration stays at `/admin`). If the restructure has not landed yet, the path still works — `/admin` exists either way.

---

## Verification gates

```bash
npm run typecheck && npm run lint && npm run test
```

**Manual verification — the point of the whole plan:**

1. Generate a letter for a collection item, round 1, to a bureau. Confirm `disputes.letterTemplateId` is now populated.
2. Generate for the same item shape three times. Confirm the LRU tiebreak rotates rows rather than returning the same id — this is the anti-pattern-matching property.
3. Set one dispute's outcome to `deleted`; confirm `successCount` increments and `effectivenessRating` stays null below 10 uses.
4. Deactivate the chosen row; regenerate; confirm a different row is selected and generation does not fail.
5. Delete every library row (in a scratch database); confirm generation falls back to the hardcoded ternary and still produces a letter.

## Completion handoff

Scheduled implementation is consolidated in `docs/plans/2026-08-02-workspace-portal-letter-studio-completion.md`. The real `dispute_letter_library` is selected, attributed, persisted with generated revisions, awaited for usage tracking, updated atomically for effectiveness, and protected by strict CRUD array parsing. The remaining verification gates are authenticated browser execution and migration application against the intended development database.

### Validation update — 2026-08-02

- Library, attribution, draft persistence, revision, compliance, and Letter Studio focused coverage passes; CFPB closure coverage passes across 5 files and 16 tests, including the missing CRA-item-attribution regression.
- `npm run typecheck`, `npm run lint`, and `git diff --check` pass.
- Current elevated `npm run validate` passes end-to-end; its lint, typecheck, full Vitest, and production-build stages all exit 0.
- Current full Vitest suite passes: 121 files passed, 1 skipped; 885 tests passed, 27 skipped (912 total).
- The generated migrations are `0037`, `0038`, `0039`, and `0040`; applying them to the intended database remains an environment-dependent check.
- The local `npm run db:migrate` attempt exited 1 while applying against the configured Neon driver; no external retry was authorized without verifying that target database.
- The current escalated production build passes end-to-end; only the restricted-sandbox Turbopack invocation is unsuitable for local verification. The authenticated browser gate remains open because the deterministic E2E password and an authorized, seeded development-database run are not available.
