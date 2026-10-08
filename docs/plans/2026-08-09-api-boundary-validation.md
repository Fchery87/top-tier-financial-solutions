# API Boundary Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Replace unbounded and unsafe request-body parsing on the highest-risk
write endpoints with compatible Zod validation before database, storage, or
provider work begins.

**Architecture:** A server-only validation module owns shared bounded scalar,
JSON, UUID, file, and form-data rules. Route-local schemas retain each
endpoint's field names and established `400`/`403` error contract. Validation
never logs request payloads, never coerces arbitrary values, and runs after
rate limiting/authentication but before a database, R2, or provider call.

**Tech Stack:** Next.js 16 route handlers, TypeScript strict mode, Zod 4,
Vitest, Drizzle/Neon, R2 uploads.

## Invariants

1. Invalid JSON, unknown object shapes, oversized strings/arrays, invalid UUIDs,
   invalid enums, and malformed files receive a non-sensitive `400` response
   before side effects.
2. Existing accepted request payloads and success/error response shapes remain
   compatible unless a previous route accepted an unsafe value beyond its
   documented domain.
3. PII, settings secrets, raw files, storage URLs, and raw request bodies never
   enter logs or audit metadata.
4. All upload handlers validate `FormData` field types and the `File` object
   before reading its buffer or calling R2.
5. Validation is explicit at the boundary; no route widens a parsed result with
   `as` or passes `unknown` to Drizzle.

## Task 1: Shared server-only validation primitives

**Files:**

- Modify: `package.json`, `package-lock.json`.
- Create: `src/lib/request-validation.ts`.
- Create: `src/lib/__tests__/request-validation.test.ts`.

1. Write failing tests for bounded text, UUIDs, email addresses, string enums,
   JSON value depth/array/object limits, malformed JSON, and a real `File`-like
   FormData value.
2. Run the focused suite; it must fail because the module is absent.
3. Add `zod` as a direct dependency. Implement server-only helpers:
   `readJsonBody`, `readFormData`, `boundedText`, `boundedJsonValue`,
   `requiredFile`, and `validationErrorResponse`.
4. `readJsonBody` returns a discriminated result for malformed JSON versus a
   schema failure, so routes can preserve their existing `400` messages without
   catching validation errors as `500`s.
5. Bound recursive JSON at depth 5, arrays at 100 entries, records at 100 keys,
   and strings at 5,000 characters; reject `NaN`, infinity, functions, and
   non-plain objects.
6. Re-run the focused suite and commit
   `feat(validation): add bounded server request schemas`.

## Task 2: Client PII create and update boundaries

**Files:**

- Modify: `src/app/api/admin/clients/route.ts`.
- Modify: `src/app/api/admin/clients/[id]/route.ts`.
- Modify: `src/__tests__/api/admin/clients.test.ts`.
- Modify: `src/__tests__/api/admin/client-update-pii-encryption.test.ts`.

1. Add failing tests proving create/update reject non-object JSON, oversized
   names/notes, malformed email, invalid UUID references, invalid DOB, and
   non-four-digit SSN before `db.insert`, `db.update`, or encryption.
2. Define create/update schemas with the current snake_case fields. Preserve the
   required `first_name`, `last_name`, and `email` create error and the existing
   SSN message where applicable.
3. Allow only documented optional PII (`phone`, address fields, DOB, SSN last
   four), workflow references (`lead_id`, `user_id`), `status`, and `notes`.
   Reject unknown fields instead of silently persisting them.
4. Replace request-body casts and the encrypted-payload assertion with inferred
   schema types and the existing encryption helper's typed result.
5. Run the two API suites and commit
   `feat(validation): bound client PII write requests`.

## Task 3: Role and settings boundaries

**Files:**

- Modify: `src/app/api/admin/set-role/route.ts`.
- Modify: `src/app/api/admin/settings/route.ts`.
- Modify: `src/app/api/admin/settings/llm/route.ts`.
- Modify: `src/__tests__/api/admin/set-role.test.ts`.
- Create or modify: `src/__tests__/api/admin/settings-validation.test.ts`.

1. Write failing tests for role payload arrays, malformed/oversized email,
   unknown role, settings keys/categories/descriptions beyond their limits,
   deep/oversized JSON settings values, invalid LLM provider, endpoint URL,
   temperature, and token count. Assert no transaction/update call occurs.
2. Use an explicit role enum matching `changeUserRole` and preserve its
   last-super-admin and bootstrap behavior.
3. Validate settings keys as identifier-like strings, bounded category and
   description text, a bounded JSON-compatible value, and the existing
   `string`/`number`/`boolean`/`json` setting type union.
4. Validate partial LLM updates with bounded model/API key strings, HTTPS endpoint
   URLs when supplied, temperature `0..2`, and positive bounded integer tokens.
   Do not return or log supplied API keys.
5. Run the changed route suites and commit
   `feat(validation): harden role and settings writes`.

## Task 4: Controlled document-registration and upload boundaries

**Files:**

- Modify: `src/app/api/portal/documents/route.ts`.
- Modify: `src/app/api/portal/documents/upload/route.ts`.
- Modify: `src/app/api/admin/disputes/evidence/upload/route.ts`.
- Modify: `src/app/api/admin/clients/documents/route.ts`.
- Modify: `src/__tests__/api/portal/onboarding.test.ts` or create
  `src/__tests__/api/portal/documents-validation.test.ts`.
- Modify: `src/__tests__/api/portal/document-upload-rate-limit.test.ts`.
- Modify: `src/__tests__/api/admin/dispute-evidence-upload.test.ts`.

1. Write failing tests for non-string FormData fields, missing/non-file `file`,
   oversized names/notes, invalid document type, invalid MIME type, too many
   submitted files, invalid registration file size, and portal storage keys
   outside the authenticated user's controlled prefix. Assert R2 is not called.
2. Parse FormData through the shared helper. Validate text fields before reading
   `arrayBuffer`; use a File guard rather than `as File` or `as string`.
3. Keep current MIME, size, document-type, ownership, and rate-limit policies;
   add a 20-file maximum to multi-evidence upload to bound batch work.
4. Preserve the controlled-key policy for portal document registration and use
   the validated storage key as the only persisted location.
5. Run the focused portal/admin upload suites and commit
   `feat(validation): bound controlled document writes`.

## Task 5: Public writes and documentation

**Files:**

- Modify: `src/app/api/public/contact-forms/route.ts`.
- Modify: `src/app/api/newsletter/subscribe/route.ts`.
- Modify: `src/__tests__/api/public/contact-forms.test.ts`.
- Modify: `src/__tests__/api/public/newsletter-subscribe.test.ts`.
- Modify: `env.example` only if a validation setting is added (none expected).
- Modify: `docs/plans/2026-08-09-remaining-work-completion-program.md` after
  its documentation branch is integrated.

1. Write failing tests that distinguish malformed JSON from schema-invalid
   public form submissions and assert rate limiting still occurs before parsing.
2. Replace manual record/text readers with the shared schemas while preserving
   every established field-specific `400` message and response shape.
3. Confirm no contact or subscriber fields are passed to `logServerEvent`.
4. Run `git diff --check`, `npm run typecheck`, `npm run lint`, `npm run test`,
   and `npm run build`; conduct a defect-focused review.
5. Commit `docs(validation): document bounded API write contracts`.

## Rollback

Revert route commits in reverse order. The validation helpers have no schema or
data migration, and no invalid request should reach a persistent side effect.
