summary:
P1.2 plan: the detector itself is already pull-scoped in `src/lib/credit-analysis.ts:652-671`; the remaining bug surface is persistence/read-path mixing because `db/schema.ts:632-646` has no report provenance on `bureau_discrepancies`, and the admin discrepancies API returns unresolved rows by `clientId` only at `src/app/api/admin/disputes/discrepancies/route.ts:43-83`. Least-risk path: add nullable `creditReportId`, thread it through writes, and filter reads by the active pull.

findings:
1. step: Add report provenance to `bureau_discrepancies` as an additive, nullable column.
   files: `db/schema.ts:632-646`, new Drizzle migration under `drizzle/` or the repo’s SQL migration path
   risk: schema drift/backfill ambiguity; making the column non-null would block existing rows and force a risky bulk backfill
   verification: `npm run db:migrate` on a scratch DB, then `npm run typecheck`
2. step: Thread `creditReportId` through discrepancy writes and keep deletion scoped to the current pull.
   files: `src/lib/credit-analysis.ts:652-671`, `src/lib/credit-analysis-discrepancies.ts:1-43`
   risk: if `creditReportId` is required too early, legacy callers will fail; if deletion stays `clientId`-wide, old pulls can be wiped unintentionally
   verification: extend `src/lib/__tests__/credit-analysis-discrepancies.test.ts` to assert two pulls of the same creditor with different balances do not collide across report IDs
3. step: Make discrepancy reads report-aware so the UI only shows the active pull.
   files: `src/app/api/admin/disputes/discrepancies/route.ts:43-83`, `src/components/admin/dispute-wizard/hooks/useDisputeIntelligence.ts:17-27`, likely `src/components/admin/dispute-wizard/WizardContext.tsx:318-320`
   risk: UI/API contract break if `reportId` is made mandatory; keep it optional and default to current behavior while the wizard passes the active report ID
   verification: API check for `/api/admin/disputes/discrepancies?clientId=...&reportId=...` returns only rows for that pull; existing `clientId`-only callers still work
4. step: Add regression coverage for the exact false-positive scenario and the rollback path.
   files: `src/lib/__tests__/credit-analysis-discrepancies.test.ts` and/or a new API test near `src/__tests__/...`
   risk: a unit-only fixture may miss the write/read-path interaction; include both persistence-scoped and retrieval-scoped assertions
   verification: `npm run test -- credit-analysis-discrepancies` (or equivalent targeted vitest run), then full `npm run validate`

top risk:
Schema provenance without report-aware reads still leaves cross-pull leakage in the admin workflow; the migration and API filter must ship together.