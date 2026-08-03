# Letter Library Generation Pilot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove the `dispute_letter_library` selection, prompt-enrichment, fallback, rotation, and effectiveness contracts against synthetic scenarios and the authorized development database without sending letters by default.

**Architecture:** Keep the pilot deterministic and separate from request handlers. A pure report module evaluates scenario selections and feedback transitions; a read-only runner loads real library candidates through the existing repository seam and emits JSON. Actual LLM generation and usage writes require explicit development-only flags.

**Tech Stack:** TypeScript, Vitest, Drizzle ORM, `tsx`, the existing letter-library selector/repository/effectiveness modules.

## Safety gates

- Default mode is read-only. It may query the configured development database but must not update disputes, library usage, outcomes, or send LLM requests.
- Synthetic fixture data contains no real client identity, account, address, or report information.
- Execution mode requires `--execute`, `PILOT_ALLOW_LLM=true`, and `NODE_ENV=development`; it remains opt-in because it can incur provider cost and increment library usage.
- The physical deprecated table is out of scope.

## Task 1: Define the pilot contract

**Files:**

- Create: `src/lib/letter-library-pilot.ts`
- Create: `src/__tests__/lib/letter-library-pilot.test.ts`

1. Write failing tests for the representative scenario catalog, selected-row contract, citation cap, fallback allowance, LRU rotation, and effectiveness transition checks.
2. Run the focused test and confirm it fails because the pilot module is missing.
3. Implement pure scenario/report helpers with no database or provider imports.
4. Re-run the focused test and confirm it passes.

## Task 2: Add the safe database runner

**Files:**

- Create: `scripts/run-letter-library-pilot.ts`
- Modify: `package.json`

1. Load the environment before importing the database client.
2. Run each synthetic request through `selectLibraryForGeneration`.
3. Emit JSON containing scenario name, selected library id, methodology, rationale, citation count/cap, and fallback status; never print prompt text or secrets.
4. Exit non-zero when a required scenario violates the contract.
5. Run `npm run db:pilot-letter-library` against the authorized development database and confirm it performs no writes.

## Task 3: Gate optional generation

**Files:**

- Modify: `scripts/run-letter-library-pilot.ts`
- Test: `src/__tests__/lib/letter-library-pilot.test.ts`

1. Add an explicit execution guard requiring `--execute`, `PILOT_ALLOW_LLM=true`, and `NODE_ENV=development`.
2. Keep the default path entirely free of `generateUniqueDisputeLetter` imports and provider calls.
3. In execution mode, generate only synthetic letters, report output length/lint status, and clearly label any usage writes.
4. Do not run execution mode until the user explicitly enables it.

## Task 4: Document the pilot handoff

**Files:**

- Modify: `docs/plans/2026-08-02-workspace-portal-letter-studio-completion.md`
- Modify: `docs/plans/2026-07-31-letter-library-wiring.md`

1. Record the pilot command, safety gates, and expected outputs.
2. Record any coverage gaps as intentional fallback cases rather than failures.
3. Keep API renaming, custom roles, statutory disclosure, and deprecated-table removal deferred.

## Verification

```bash
./node_modules/.bin/vitest run src/__tests__/lib/letter-library-pilot.test.ts --pool=threads --maxWorkers=1
npm run db:pilot-letter-library
npm run lint
npm run typecheck
```

The pilot must not run `--execute` as part of ordinary validation.

## Completion record — 2026-08-03

- [x] Added the pure scenario/report contract and focused Vitest coverage for selection, prompt context, citation capping, fallback, LRU rotation, effectiveness thresholds, and execution gates.
- [x] Added `npm run db:pilot-letter-library` with read-only default behavior and a development-only `--execute` gate.
- [x] Ran the pilot against the authorized development database in read-only mode. Four scenarios selected library rows successfully; two intentional fallback scenarios produced no selection; all three synthetic contract checks passed.
- [x] Confirmed the run reported `usageWrites: false` and emitted no prompt text, client data, account data, or provider output.
- [x] Re-ran the complete `npm run test` gate. It passed with 128 files and 906 tests passing (one file and 27 tests skipped). The main JSDOM batch took 343 seconds on this workspace, so wrappers must allow more than the earlier 240-second diagnostic cutoff.
- [ ] LLM execution remains intentionally deferred until an explicit development-only opt-in is requested. Ordinary validation must continue to use read-only mode.
