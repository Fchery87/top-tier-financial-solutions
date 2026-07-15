# Domain Documentation

This repo uses a single-context domain documentation layout.

## Expected Layout

- `CONTEXT.md` at the repo root contains the shared project domain language, product concepts, and current constraints.
- `docs/adr/` contains architectural decision records for cross-cutting technical decisions.

## Current State

- `CONTEXT.md` is present at the repo root.
- `docs/adr/` is present and should be consulted for cross-cutting dispute-policy decisions.

## Current Letter-Generation Notes

- `src/lib/ai-letter-generator.ts` is the primary dispute-letter generation module.
- `src/lib/letter-lint.ts` provides deterministic post-generation linting for generated letters and should be treated as the output-side twin of the input policy gates.
- `src/lib/negative-item-detectors.ts` provides deterministic re-aging and duplicate-liability detection for Phase 3 triage support.
- `src/lib/medical-dispute-rules.ts` provides medical-debt-specific recommendation logic and state restriction notes.
- Factual verification and Metro 2 issue framing are the default posture; escalation rounds change strategy, not evidentiary confidence.
- CFPB escalation should be modeled as a complaint-packet / regulator flow, not as a bureau-addressed dispute letter.

## Consumer Rules

- Before architecture, diagnosis, or TDD work, read root `CONTEXT.md` if it exists.
- Before changing architecture or reversing a prior decision, read relevant ADRs in `docs/adr/` if they exist.
- If `CONTEXT.md` or `docs/adr/` is missing, proceed from code evidence and note the documentation gap instead of inventing domain rules.
- If this repo later becomes multi-context, create `CONTEXT-MAP.md` and update this file before relying on per-context docs.
