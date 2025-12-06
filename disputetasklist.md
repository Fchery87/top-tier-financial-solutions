# Dispute Wizard Fix Task List

1. Parser validation
   - Re-run `parseIdentityIQReport` on sample HTML (e.g., `C_Pique_creditReport.html`) and log `negativeItems`, `personalInfoDisputes`, `inquiryDisputes` to confirm bureau-specific splits, counts, and FCRA flags.

2. Import/ingestion pipeline
   - Persist `ExtendedParsedCreditData` fully: per-bureau booleans/dates/status for tradelines, dedup key `creditor|bureau|itemType|accountNumber`, and storage of `personalInfoDisputes` + `inquiryDisputes` (with `isPastFcraLimit`).

3. API surface
   - Update `/api/admin/clients/:id` (and related dispute endpoints) to return per-bureau tradeline flags/dates/status, plus `personalInfoDisputes` and `inquiryDisputes` arrays for the wizard.

4. Wizard UI/selection
   - Step 2: add tabs/sections for Tradelines, Personal Info, and Inquiries; render bureau chips using `itemAppearsOnBureau` and allow selection of personal info items and inquiries (show “FCRA violation” for stale inquiries).

5. Letter generation
   - Ensure combined and per-item letters filter by bureau, accept selected personal/inquiry items, and map reasons: factual/verification for personal info; Section 605 for inquiries beyond 2 years.

6. Quality checks
   - Re-run end-to-end on sample report: verify item counts, bureau placements, personal info discrepancy availability, and inquiry FCRA flags. Add snapshot/integration tests for ingest → API shape.

7. Seed/config updates
   - Align dispute templates/reason codes with the new buckets (tradelines, personal info, inquiries) and ensure seeds reflect bureau-aware handling.
