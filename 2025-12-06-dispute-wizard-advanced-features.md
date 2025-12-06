# Dispute Wizard Upgrade Specification

## Overview
Raise the Dispute Wizard to industry parity with five capabilities: **Data Consistency Checks**, **Compliance Guardrails**, **Auto-Triage & Batching**, **Response Clock**, and **Evidence-Aware Letters**. The work must remain compatible with Neon + Drizzle, Cloudflare R2 evidence storage, and Better-Auth admin validation.

**Touchpoints**: Next.js Admin Wizard UI, `/api/admin/disputes/*` routes, `credit_analysis` outputs, Drizzle schema, R2 file helpers (`getFileFromR2`, `uploadToR2`), and AI letter generation.

## Implementation Order
1) **Phase 1:** Data Consistency Checks + Compliance Guardrails  
2) **Phase 2:** Auto-Triage & Batching + Response Clock  
3) **Phase 3:** Evidence-Aware Letters

## Phase 1 — Data Consistency + Compliance Guardrails
### Data Consistency Checks
- Source: `credit_analysis` produces `bureau_discrepancies` records (cross-bureau status/balance/date mismatches, missing DOFD/original creditor, duplicate items, PII conflicts, obsolete age).
- API: `GET /api/admin/disputes/discrepancies?clientId=` (Better-Auth `validateAdmin` + `isSuperAdmin`) returns grouped discrepancies with suggested reason codes and legal basis; `POST /api/admin/disputes/discrepancies/resolve` marks resolved.
- UI: Wizard preflight panel shows High/Medium/Low discrepancies, maps each to items/bureaus, and enables “Add to Dispute” quick-action that seeds suggested reason codes and dispute type.

### Compliance Guardrails
- Access control: All dispute mutations use `validateAdmin()`; log admin user/email on create/update.
- High-risk claims guardrails: block `identity_theft`, `not_mine`, `never_late`, and `mixed_file` unless required evidence is present (see Phase 3 evidence map). Warn and require explicit admin confirmation with legal notice when bypassed.
- CROA/FCRA guardrails: enforce non-escalation before response deadline unless admin overrides with reason; capture `verificationMethod`, `escalationReason`, `fcraSections`, `disputedFields` on update.
- Preflight validation before letter generation: required fields (client, items, bureaus, methodology, round), required evidence, and no unresolved High discrepancies.

## Phase 2 — Auto-Triage & Batching + Response Clock
### Auto-Triage & Batching
- Logic: Group negative items by bureau × itemType; strategy rules (factual, debt_validation for collections, method_of_verification for round ≥2, goodwill for old lates, metro2_compliance for public records) with legal basis and priority derived from severity, amount, and cross-bureau discrepancies. Mirrors `src/lib/dispute-triage.ts` outputs.
- API: `POST /api/admin/disputes/triage` accepts `clientId`, `round`, optional `itemIds`; returns `batches`, `quickActions`, `summary` aligned to `TriagedBatch`/`TriageSummary` interfaces. Triage results can be saved as `dispute_batches` rows and individual `disputes` with `methodology`, `legalBasis`, `priority`.
- UI: Wizard “Items” step shows quick actions (all collections per bureau, approaching obsolescence, high severity, discrepancies). “Configure” step preselects strategy/round and allows batch send (combine per bureau when applicable).

### Response Clock
- Deadlines: set `responseDeadline` and `escalationReadyAt` when `status` becomes `sent` (30 days bureaus; 35–45 days creditors/collectors configurable). `trackingNumber` optional but recommended.
- Background job/cron: daily check for disputes where `status in ('sent','in_progress') AND escalationReadyAt <= now()` → notify admins and mark `status='escalated'` or queue follow-up generation; compute `escalationHistory` entry.
- UI: timeline chip per dispute shows D-remaining, turns red on expiry, and offers “Escalate now” to create next-round dispute prefilled with `priorDisputeId` and `methodology=method_of_verification`.

## Phase 3 — Evidence-Aware Letters
- Evidence map: `EVIDENCE_REQUIREMENTS` per reason code (identity theft → police/FTC + ID, paid collection → receipt/bank statement, method_of_verification → prior letter + response). Standard enclosures: ID + proof of address.
- Template schema: `dispute_letter_templates.evidenceRequirements` JSON `{ required: boolean, documentTypes: string[], prompt: string, warningIfMissing?: string }`. Library templates inherit requirements and populate `evidenceDocumentIds` on disputes when used.
- Flow: evidence picker pulls `client_documents` (from R2) filtered by `documentTypes`; required evidence gates “Generate Letter” unless admin overrides with explicit warning; selected docs saved to `disputes.evidenceDocumentIds` and shown as enclosure list in generated content (AI prompt includes enclosure summary).
- Storage: uploads stay in R2 via existing helpers; only IDs/URLs stored in DB. No raw PII in logs.

## Data Model (Drizzle)
```typescript
// db/schema.ts additions
export const disputes = pgTable('disputes', {
  // ... existing fields ...
  escalationReadyAt: timestamp('escalation_ready_at'),
  evidenceDocumentIds: text('evidence_document_ids'), // JSON array of clientDocuments IDs
});

export const disputeLetterTemplates = pgTable('dispute_letter_templates', {
  // ... existing fields ...
  evidenceRequirements: text('evidence_requirements'), // JSON
});
```

## Acceptance Criteria
- Phase 1: Discrepancy API returns grouped results; Wizard blocks generation when required evidence or High discrepancies unresolved; admin-only access enforced; guardrails display warnings for high-risk claims.
- Phase 2: Triage API returns batches/quick actions; Wizard can send combined-per-bureau letters using triaged strategies; deadlines and escalation-ready timestamps are written on send and surfaced in UI; cron/script can flag overdue items.
- Phase 3: Letter generation refuses high-risk reason codes without required evidence unless explicitly overridden; selected evidence persists on `disputes` and appears in generated letter enclosure section; templates carry evidence metadata.

## Delivery Notes
- Run Drizzle migration against Neon before deployment; keep schema/types in sync.
- Reparse existing credit reports as needed so discrepancy data and Metro 2 fields are available to the wizard.
- Use Better-Auth session + `isSuperAdmin` for all admin routes; prefer R2 signed URLs when referencing evidence in letters.