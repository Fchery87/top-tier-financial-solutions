# Domain Documentation

This repo uses a single-context domain documentation layout.

## Expected Layout

- `CONTEXT.md` at the repo root contains the shared project domain language, product concepts, and current constraints.
- `docs/adr/` contains architectural decision records for cross-cutting technical decisions.

## Current State

- `CONTEXT.md` is not present yet.
- `docs/adr/` is not present yet.

## Consumer Rules

- Before architecture, diagnosis, or TDD work, read root `CONTEXT.md` if it exists.
- Before changing architecture or reversing a prior decision, read relevant ADRs in `docs/adr/` if they exist.
- If `CONTEXT.md` or `docs/adr/` is missing, proceed from code evidence and note the documentation gap instead of inventing domain rules.
- If this repo later becomes multi-context, create `CONTEXT-MAP.md` and update this file before relying on per-context docs.
