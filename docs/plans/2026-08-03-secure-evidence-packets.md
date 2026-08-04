# Secure Evidence Documents and Evidence Packets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let staff upload and select controlled evidence documents for a dispute response, create attributable Evidence Packets from those documents, and remove the unsafe response-document URL paste workflow.

**Architecture:** Reuse the existing R2-backed `client_documents` source of truth instead of introducing another object store or duplicating bytes. Store an optional `responseDocumentId` on each dispute and a `createdById` on each Evidence Packet; routes verify that every selected document belongs to the dispute's client before persisting references. The dispute detail panel loads the client's evidence inventory, uploads staff-provided response evidence through the existing R2 helper, and makes packet assembly an explicit staff action.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Drizzle ORM with Neon Postgres, Cloudflare R2, Vitest, Testing Library, Tailwind CSS.

## Scope and invariants

- Files continue to be private R2 objects. Database fields hold an R2 key, never a public URL.
- A response review accepts `responseDocumentId`, never an arbitrary response-document URL. For compatibility, existing `responseDocumentUrl` records remain readable.
- The selected response document must be a `client_documents` record owned by the dispute client; its stored R2 key becomes `responseDocumentUrl` and its ID becomes `responseDocumentId`.
- `no_response` continues to record neither a receipt date nor a document.
- Evidence Packet document IDs must all belong to the packet client. Merely existing in the database is insufficient.
- Evidence Packets are append-only: creation captures `createdById` and timestamp; this slice adds no mutation or deletion route.
- Staff evidence uploads use the existing R2 helper and insert into `client_documents`, so portal-uploaded and staff-uploaded documents share one selection inventory.
- Do not change portal upload behavior, add direct public R2 URLs, implement malware scanning, or delete legacy identity-document rows in this slice.

### Task 1: Add durable document and author references

**Files:**
- Modify: `db/schema.ts`
- Create: generated `drizzle/NNNN_secure_evidence_documents.sql` and Drizzle metadata via `npm run db:generate`
- Test: `src/__tests__/api/admin/response-review.test.ts`
- Test: `src/__tests__/api/admin/evidence-packets.test.ts`

**Step 1: Write failing route tests**

Add a response-review test that submits `responseDocumentId: 'doc-1'` and expects the route to persist the document's controlled key, not a caller-supplied URL. Add an Evidence Packet test that expects `created_by_id` in the response.

**Step 2: Run the focused tests to verify they fail**

Run:
```bash
./node_modules/.bin/vitest run --pool=threads --maxWorkers=1 \
  src/__tests__/api/admin/response-review.test.ts \
  src/__tests__/api/admin/evidence-packets.test.ts
```

Expected: FAIL because the schema and routes do not expose the document and creator references.

**Step 3: Extend the schema**

Add to `disputes`:
```ts
responseDocumentId: text('response_document_id')
  .references(() => clientDocuments.id, { onDelete: 'set null' }),
```

Add to `evidencePackets`:
```ts
createdById: text('created_by_id')
  .references(() => user.id, { onDelete: 'set null' }),
```

Add indexes for both references and relations for the document/creator. Generate the migration; review the generated SQL before continuing.

**Step 4: Run focused tests and typecheck**

Run the focused tests and `npm run typecheck`. Expected: PASS after route tasks below are complete; do not apply the migration to a shared database during implementation.

### Task 2: Centralize client-owned evidence lookup

**Files:**
- Create: `src/lib/evidence-documents.ts`
- Test: `src/__tests__/lib/evidence-documents.test.ts`

**Step 1: Write failing unit tests**

Cover:

```ts
expect(isControlledDocumentKey('client-documents/client-1/a.pdf')).toBe(true);
expect(isControlledDocumentKey('https://example.com/a.pdf')).toBe(false);
```

And cover that the lookup result is accepted only when `document.userId === client.userId`.

**Step 2: Run the unit test to verify it fails**

Run:
```bash
./node_modules/.bin/vitest run src/__tests__/lib/evidence-documents.test.ts
```

**Step 3: Implement minimal helpers**

Export a narrow `isControlledDocumentKey` prefix validator and a `findClientOwnedDocument` query helper. The helper must look up the dispute/client first and constrain the document to that client's user ID. It returns `{ document, client }` or a typed `not_found`/`not_owned` result; it must not expose a signed URL.

**Step 4: Run the unit test**

Expected: PASS.

### Task 3: Complete the staff evidence upload seam

**Files:**
- Create: `src/app/api/admin/disputes/evidence/upload/route.ts`
- Test: `src/__tests__/api/admin/dispute-evidence-upload.test.ts`
- Modify: `src/components/workspace/dispute-wizard/hooks/useEvidenceSelection.ts` only if its response contract needs alignment

**Step 1: Write failing API tests**

Test that a staff member with `disputes:write` can upload a PDF for `client_id`, resulting in an R2 key under `client-documents/<client user id>/evidence`; test rejection for an unsupported MIME type, a file over 10 MB, a missing client, and a client without a usable case record.

**Step 2: Run the test to verify it fails**

Run:
```bash
./node_modules/.bin/vitest run src/__tests__/api/admin/dispute-evidence-upload.test.ts
```

**Step 3: Implement the route**

Require `disputes:write`; resolve `clients.userId` and the client's newest case. Validate the same allowed MIME types and 10 MB ceiling used by portal document upload. Call `uploadToR2`, insert a `clientDocuments` row with `uploadedBy: 'admin'`, and return the document's ID, type, R2 key, size, and created date. Never return `uploadResult.url`.

**Step 4: Run the route test**

Expected: PASS. Existing wizard uploads should use the now-real endpoint without inventing a separate storage contract.

### Task 4: Make response review select an owned evidence document

**Files:**
- Modify: `src/app/api/admin/disputes/[id]/route.ts`
- Modify: `src/components/workspace/disputes/DisputeDetailPanel.tsx`
- Modify: `src/components/workspace/disputes/__tests__/DisputeDetailPanel.test.tsx`
- Modify: `src/__tests__/api/admin/response-review.test.ts`

**Step 1: Add failing response-review API tests**

Test that an actual outcome:

```ts
{ outcome: 'verified', responseReceivedAt: '...', responseDocumentId: 'doc-1' }
```

is accepted only when `doc-1` belongs to the dispute client. Test that an arbitrary `responseDocumentUrl` is rejected for a new review and that `no_response` still needs no document.

**Step 2: Run the focused test to verify it fails**

Run the response-review test file. Expected: FAIL because the route still trusts `responseDocumentUrl`.

**Step 3: Implement server validation**

Read `responseDocumentId` from the payload. For actual outcomes, resolve it through `findClientOwnedDocument`, persist both `responseDocumentId` and its controlled R2 key, and add the ID to the escalation-history audit payload. Return both fields from GET and PUT responses. Do not overwrite legacy values unless a new document ID is supplied.

**Step 4: Replace the URL field in the UI**

Load `GET /api/admin/disputes/evidence?clientId=<id>` when an actual response outcome is chosen. Render a labeled document select with file name, type, and uploaded date; add an upload action that posts the selected file to `/api/admin/disputes/evidence/upload` and refreshes the list. Keep the response date/document controls hidden for `no_response`.

**Step 5: Verify focused tests**

Run the API and component test files. Expected: PASS.

### Task 5: Harden and surface Evidence Packets

**Files:**
- Modify: `src/app/api/admin/evidence-packets/route.ts`
- Modify: `src/__tests__/api/admin/evidence-packets.test.ts`
- Create: `src/components/workspace/disputes/EvidencePacketPanel.tsx`
- Create: `src/components/workspace/disputes/__tests__/EvidencePacketPanel.test.tsx`
- Modify: `src/components/workspace/disputes/DisputeDetailPanel.tsx`

**Step 1: Write failing route tests**

Add tests that reject document IDs belonging to another client, persist `createdById`, and list packets for the current dispute through a new capability-gated `GET` route.

**Step 2: Run the API test to verify it fails**

Run:
```bash
./node_modules/.bin/vitest run src/__tests__/api/admin/evidence-packets.test.ts
```

**Step 3: Implement ownership and listing**

The POST must compare each selected `clientDocuments.userId` to `clients.userId` for the packet client. Set `createdById: adminUser.id`. Add `GET ?client_id=&dispute_id=` that returns only packets for the requested client/dispute, including document IDs, confirmation data, creator ID, and timestamps.

**Step 4: Write failing component tests**

Cover document selection, low-risk packet creation, a visible high-risk confirmation requirement, packet refresh after creation, and the empty state.

**Step 5: Implement `EvidencePacketPanel`**

Use the client evidence endpoint for the inventory and the packet endpoint for creation/listing. Keep high-risk confirmation display-only: tell staff the client must confirm factual claims through the portal; do not add a staff bypass. Mount the panel inside the existing dispute detail view so the dispute ID and client ID are always explicit.

**Step 6: Run route and component tests**

Expected: PASS.

### Task 6: Document, migrate, and verify the vertical slice

**Files:**
- Modify: `docs/plans/credit-repair-platform-roadmap.md`
- Modify: `docs/plans/2026-08-02-workspace-portal-letter-studio-completion.md`
- Test: `e2e/dispute-wizard.spec.ts` or create a focused authenticated evidence workflow spec if existing fixtures can provide the document inventory

**Step 1: Update documentation**

Mark the secure-document/Evidence Packet follow-up complete only after validation. Record that R2 keys are private, staff response uploads and selection are client-owned, and this is not malware scanning or public document delivery.

**Step 2: Generate and review the migration**

Run:
```bash
npm run db:generate
npx drizzle-kit check
```

Review the generated SQL for the nullable `response_document_id` and `created_by_id` references. Do not apply it to a remote database without explicit user authorization.

**Step 3: Run focused checks**

Run the new/changed unit, API, and component tests plus `npm run typecheck` and `npm run lint`.

**Step 4: Run repository validation**

Run:
```bash
npm run test
npm run build
```

Expected: all test shards and the serial stage pass; build completes with the same local-process permission used by the repository's prior build validation.

**Step 5: Commit**

```bash
git add db/schema.ts drizzle src/app/api src/components src/lib src/__tests__ docs/plans e2e
git commit -m "feat(evidence): add secure packet workflow"
```
