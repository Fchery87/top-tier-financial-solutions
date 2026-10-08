# Envelope Encryption and Key Rotation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to
> implement this plan task-by-task.

**Goal:** Replace malleable, single-key AES-CBC PII storage with versioned
AES-256-GCM encryption, and provide a tested, resumable rotation command that
never exposes plaintext or key material.

**Architecture:** An environment-backed key provider exposes an active key and
read-only historical keys. New values use `v3:<key-id>:<iv>:<tag>:<ciphertext>`;
legacy two-segment CBC and existing unkeyed `v2` GCM values remain readable only
while their legacy key is configured. Database helpers fail closed with a
display-safe sentinel for ciphertext-shaped values that cannot be decrypted.
A database-backed rotation run advances by primary-key cursor and records only
counts, table/checkpoint identifiers, and error class names.

**Tech Stack:** Node `crypto`, TypeScript strict mode, Drizzle/Neon Postgres,
Drizzle migrations, Vitest, `tsx` scripts, structured server logging.

## Security invariants

1. Key material, plaintext, ciphertext, provider API keys, and request payloads
   never enter logs, audit metadata, command output, or migration state.
2. New writes use authenticated AES-256-GCM with a 12-byte random nonce and a
   16-byte authentication tag; decryptions authenticate before returning data.
3. A malformed or undecryptable ciphertext-shaped value returns
   `[decryption-failed]`, never the stored value.
4. Plaintext legacy database values remain readable so that rotation can upgrade
   them. They are never mistaken for valid ciphertext.
5. Rotation is opt-in (`--execute`), idempotent, cursor-resumable, and leaves a
   row unchanged when its value cannot be safely decrypted.
6. `clients.date_of_birth` is a text column before encrypted DOB values are
   written. No route may pass ciphertext to a PostgreSQL timestamp column.

## Deployment secret contract

Preferred deployment configuration:

```dotenv
ENCRYPTION_ACTIVE_KEY_ID="2026_08"
ENCRYPTION_KEYRING='{"2026_08":"64-hex-character-key","2026_01":"64-hex-character-key"}'
# Keep only while any v1/v2 data remains:
ENCRYPTION_KEY="64-hex-character-legacy-key"
```

`ENCRYPTION_KEY` is a backwards-compatible single-key fallback, assigned key ID
`legacy` for new `v3` writes only when no keyring is configured. Production must
not start with an invalid/missing configured key. Test mode uses a deterministic
in-memory key only; no test secret is read from or written to disk.

## Task 1: Versioned key provider and authenticated ciphertext

**Files:**

- Modify: `src/lib/encryption.ts`.
- Create: `src/lib/__tests__/encryption.test.ts`.
- Modify: `env.example`.

1. Write failing tests for: active-key `v3` round-trip; distinct ciphertext for
   the same plaintext; decrypting a legacy CBC fixture; decrypting an unkeyed
   `v2` GCM fixture; rejecting altered tag/data/key ID; invalid keyring JSON;
   invalid key ID; and `ENCRYPTION_KEY` compatibility.
2. Run `npx vitest run src/lib/__tests__/encryption.test.ts`; verify the missing
   module behavior is red before implementation.
3. Replace single-key access with an explicit provider result:

   ```ts
   type EncryptionKeyring = {
     activeKeyId: string;
     keys: ReadonlyMap<string, Buffer>;
     legacyKey: Buffer | undefined;
   };
   ```

   Parse `ENCRYPTION_KEYRING` as a bounded JSON object whose key IDs match
   `/^[A-Za-z0-9_-]{1,64}$/`. Validate every key as exactly 64 hex characters.
   Select `ENCRYPTION_ACTIVE_KEY_ID`; fall back to a `legacy` keyring only when
   the old `ENCRYPTION_KEY` is configured. Do not log configuration values.
4. Make `encrypt()` write only `v3` with `aes-256-gcm`, a 12-byte nonce, and
   `cipher.getAuthTag()`. Make `decrypt()` dispatch by format: keyed `v3`,
   historical unkeyed `v2`, then strict two-segment CBC. Reject malformed
   lengths/hex and unknown key IDs before constructing a decipher.
5. Keep `generateEncryptionKey()` and object helpers compatible, but eliminate
   unsafe casts by using explicit encrypted-object mapped types where required.
6. Update `env.example` with the keyring contract and rotation-retention rule.
7. Re-run the focused encryption suite and commit:

   ```bash
   git add src/lib/encryption.ts src/lib/__tests__/encryption.test.ts env.example
   git commit -m "fix(security): add versioned authenticated encryption"
   ```

## Task 2: Fail-closed database encryption boundaries and DOB storage

**Files:**

- Modify: `src/lib/db-encryption.ts`.
- Modify: `src/lib/__tests__/db-encryption.test.ts`.
- Modify: `src/app/api/admin/clients/route.ts`.
- Modify: `src/app/api/admin/clients/[id]/route.ts`.
- Modify: `src/__tests__/api/admin/clients.test.ts`.
- Modify: `src/__tests__/api/admin/client-update-pii-encryption.test.ts`.
- Modify: `db/schema.ts`.
- Create: next numbered Drizzle SQL migration and journal entry.

1. Write failing tests that prove a shaped-but-undecryptable `v3`, `v2`, or CBC
   value becomes `[decryption-failed]`; actual plaintext remains unchanged;
   all client PII fields including DOB use the encrypted output; and no client
   create/update path attempts a `Date` conversion for encrypted DOB.
2. Run the focused library/client suites; observe the legacy fail-open and DOB
   mismatch failures.
3. Add a narrow `decryptForStorage()`/`safeDecryptValue()` seam in
   `db-encryption.ts`. It recognizes only strict ciphertext shapes, returns the
   sentinel on decrypt errors, logs only the error class/event, and keeps true
   plaintext values unchanged. Use the same seam for client, account, negative
   item, and dispute helpers.
4. Change `clients.dateOfBirth` to `text('date_of_birth')`. Generate a reviewable
   migration that converts existing timestamp values with
   `to_char(date_of_birth, 'YYYY-MM-DD')`; do not drop or overwrite a value.
   Update client POST to persist `encrypted.dateOfBirth`, not `new Date(...)`.
5. Ensure `ClientEncryptionFields` and route update data are schema-derived and
   contain text ciphertext for DOB. Do not use `as` to satisfy Drizzle.
6. Run focused suites, `npm run typecheck`, `npm run lint`, and
   `npx drizzle-kit check`; inspect generated SQL before any owner applies it.
7. Commit:

   ```bash
   git add src/lib/db-encryption.ts src/lib/__tests__/db-encryption.test.ts \
     src/app/api/admin/clients/route.ts src/app/api/admin/clients/[id]/route.ts \
     src/__tests__/api/admin/clients.test.ts \
     src/__tests__/api/admin/client-update-pii-encryption.test.ts db/schema.ts drizzle
   git commit -m "fix(security): fail closed on PII decryption"
   ```

## Task 3: Encrypt LLM keys at rest without changing their runtime API

**Files:**

- Modify: `src/lib/settings-service.ts`.
- Create or modify: `src/lib/__tests__/settings-service.test.ts`.
- Modify: `src/__tests__/api/admin/settings-validation.test.ts` only if its
  mocked settings contract changes.

1. Write failing tests that `updateLLMConfig({ apiKey })` persists `v3:` data,
   `getLLMConfig()` returns the decrypted key, a legacy plaintext setting still
   works, and a ciphertext decrypt failure yields no API key rather than the
   raw stored value.
2. Run the focused settings suite; confirm it currently stores the raw API key.
3. Add private `encryptSecretSetting`/`decryptSecretSetting` helpers that act
   only on `llm.api_key`; leave generic setting types and non-secret settings
   unchanged. Clear the cache after writes and never cache/log raw ciphertext
   through a public response.
4. Re-run focused tests plus the LLM route validation suite.
5. Commit:

   ```bash
   git add src/lib/settings-service.ts src/lib/__tests__/settings-service.test.ts \
     src/__tests__/api/admin/settings-validation.test.ts
   git commit -m "fix(security): encrypt LLM keys at rest"
   ```

## Task 4: Resumable controlled-data rotation command

**Files:**

- Create: `src/lib/encryption-rotation.ts`.
- Create: `src/lib/__tests__/encryption-rotation.test.ts`.
- Create: `scripts/rotate-encryption-keys.ts`.
- Modify: `package.json`.
- Modify: `db/schema.ts`.
- Create: next numbered Drizzle SQL migration and journal entry.

1. Write failing unit tests for: dry-run has zero writes; a batch upgrades a
   legacy value to the active `v3` key; a saved table/ID checkpoint resumes
   without revisiting earlier rows; a decrypt failure preserves the row and
   marks the run failed; and command status/output excludes plaintext,
   ciphertext, and keys.
2. Add `encryption_rotation_runs` with `id`, `active_key_id`, `status`,
   `current_table`, `checkpoint_id`, per-run counters, `failure_class`, and
   timestamps. It must not contain a data value, error message, or secret.
3. Implement a rotation planner over the existing encrypted fields:
   `clients`, `credit_accounts`, `negative_items`, `disputes`, and the
   `system_settings` row `llm.api_key`. Fetch deterministic primary-key batches,
   decrypt strictly, encrypt with the active key, write one row transactionally,
   then advance the checkpoint. Plaintext legacy PII is also upgraded.
4. Implement the CLI defaulting to dry run. `--execute --run-id <uuid>` is
   required to write; `--resume <uuid>` resumes only a compatible active-key
   run. Print aggregate counts and run IDs only. Refuse a changed active key
   when resuming.
5. Add `security:rotate-encryption` to `package.json` using `tsx`. Document
   that owners must first deploy both old and new keys, run the executable
   rotation against an authorized database, verify zero legacy rows, and only
   then retire old key material.
6. Run focused tests and `npx drizzle-kit check`; inspect generated migration
   SQL. Commit:

   ```bash
   git add src/lib/encryption-rotation.ts src/lib/__tests__/encryption-rotation.test.ts \
     scripts/rotate-encryption-keys.ts package.json db/schema.ts drizzle
   git commit -m "feat(security): add resumable encryption rotation"
   ```

## Task 5: Program record, verification, and owner handoff

**Files:**

- Modify: `docs/plans/2026-08-09-remaining-work-completion-program.md` after
  the documentation branch is integrated.
- Modify: `env.example` if Task 1 has not already done so.

1. Add the exact secret migration order, dry-run/execute/resume examples, and
   the rule that production rotation requires the owner’s authorized database.
2. Run `git diff --check`, `npm run typecheck`, `npm run lint`, `npm run test`,
   `npm run build`, and `npx drizzle-kit check`. For the build, use the explicit
   local validation configuration only; never commit local secrets.
3. Conduct a defect-focused review: no fail-open decrypt path; no stored
   timestamp ciphertext; no unbounded update; no secrets in logs/output; all
   legacy formats still covered; migration reversible by retaining legacy keys.
4. Commit the documentation record only after the documentation branch is
   integrated:

   ```bash
   git add docs/plans/2026-08-09-remaining-work-completion-program.md env.example
   git commit -m "docs(security): document encryption key rotation"
   ```

## Owner-required production steps

1. Generate a 32-byte key outside the repository and put it in the production
   secret manager as the new `ENCRYPTION_KEYRING` entry.
2. Retain the current `ENCRYPTION_KEY` and any previous keyring entries until a
   completed rotation run proves all values are `v3` with the active key ID.
3. Apply the reviewed Drizzle migrations only to the authorized target database.
4. Execute a dry run, review aggregate counts, then run `--execute` and retain
   the rotation run ID as deployment evidence.

## Owner production runbook

This command is deliberately database-authoritative: run it only from a
deployment environment that is configured for the specific authorized target
database. Never point it at production from an unreviewed local shell.

1. Generate a new 32-byte key in the deployment secret manager. Configure the
   new active ID and a keyring that contains both the new key and every key
   needed to decrypt existing `v3` records. Keep `ENCRYPTION_KEY` available
   while legacy CBC or unkeyed `v2` records might still exist.

   ```dotenv
   # Replace each placeholder with exactly 64 hexadecimal characters.
   ENCRYPTION_ACTIVE_KEY_ID="2026_08"
   ENCRYPTION_KEYRING='{"2026_08":"new-64-character-hex-key","2026_01":"previous-64-character-hex-key"}'
   ENCRYPTION_KEY="legacy-64-character-hex-key"
   ```

2. Deploy the dual-key configuration first, then apply the reviewed migration:

   ```bash
   npm run db:migrate
   ```

3. Run the default, read-only dry run and record only its aggregate output.
   It creates no rotation run and makes no database writes.

   ```bash
   npm run security:rotate-encryption
   ```

4. After reviewing the dry-run counts, start an executable run with a freshly
   generated UUID. Store the UUID with the deployment record; the command never
   prints plaintext, ciphertext, or keys.

   ```bash
   npm run security:rotate-encryption -- --execute --run-id 6be7c27d-1f95-4a77-a52e-0fafb1f38b1a
   ```

5. If a run stops with `failure=decryption_failed`, correct the authorized
   key configuration without changing `ENCRYPTION_ACTIVE_KEY_ID`, then resume
   the saved run. A resume with a different active key ID is rejected.

   ```bash
   npm run security:rotate-encryption -- --execute --resume 6be7c27d-1f95-4a77-a52e-0fafb1f38b1a
   ```

6. Run a final dry run. It must complete with `rotated=0` before retiring
   legacy keys. Keep the prior keyring entries and `ENCRYPTION_KEY` until this
   evidence is retained and the owner approves their removal. The ciphertext
   formats remain decryptable while those keys are retained.
