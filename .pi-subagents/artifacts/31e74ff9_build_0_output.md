Implemented the P1.2 persistence/read/write scope:

- Added `creditReportId` threading to discrepancy writes in `credit-analysis` and `credit-analysis-discrepancies`.
- Made the discrepancies API accept optional `reportId` while preserving `clientId`-only queries.
- Added migration `drizzle/0034_bureau_discrepancies_credit_report_id.sql` and journal entry.
- Added/updated tests for same-client different-pull isolation and report-aware filtering.

Verified with:
- `npm test -- --run src/lib/__tests__/credit-analysis-discrepancies.test.ts src/__tests__/api/admin/discrepancies.test.ts` ✅
- `npm run typecheck` ✅
- `npm run lint -- ...targeted files...` ✅

Residual risks:
- Existing unrelated worktree changes were present in `git status`; not touched by this task.
- The new filter is API-only; no UI consumers were updated.