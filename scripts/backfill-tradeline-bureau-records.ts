/**
 * Backfill per-bureau tradeline fields (ADR 0005) for reports in an active Service Engagement,
 * or in none (reports saved before engagements existed). Closed and superseded engagements
 * are left alone.
 *
 * Re-parses each stored report file and fills the date of first delinquency, removal date,
 * original creditor, last payment, last activity, tradeline key and bureau on the existing
 * credit_accounts rows. It never deletes or recreates rows, so negative items, dispute
 * links and parser review approvals are untouched. A report that fails to parse is logged
 * and skipped.
 *
 * Dry run (default): npx tsx --conditions=react-server scripts/backfill-tradeline-bureau-records.ts
 * Write changes:     npx tsx --conditions=react-server scripts/backfill-tradeline-bureau-records.ts --apply
 */

import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '../db/client';
import { creditAccounts, creditReports, serviceEngagements } from '../db/schema';
import { parseStoredCreditReport } from '../src/lib/credit-analysis';
import { decryptCreditAccountData } from '../src/lib/db-encryption';
import { planTradelineBackfill } from '../src/lib/tradeline-backfill';

async function backfill(apply: boolean) {
  const reports = await db
    .select({ id: creditReports.id, fileUrl: creditReports.fileUrl, fileType: creditReports.fileType, bureau: creditReports.bureau })
    .from(creditReports)
    .leftJoin(serviceEngagements, eq(creditReports.serviceEngagementId, serviceEngagements.id))
    .where(and(
      eq(creditReports.parseStatus, 'completed'),
      or(eq(serviceEngagements.status, 'active'), isNull(creditReports.serviceEngagementId)),
    ));

  console.log(`${apply ? 'Applying' : 'Dry run'}: ${reports.length} reports`);
  let rowsUpdated = 0;
  let failed = 0;

  for (const report of reports) {
    try {
      const parsed = await parseStoredCreditReport(report);
      const rows = (await db
        .select({ id: creditAccounts.id, bureau: creditAccounts.bureau, creditorName: creditAccounts.creditorName, accountNumber: creditAccounts.accountNumber })
        .from(creditAccounts)
        .where(eq(creditAccounts.creditReportId, report.id)))
        .map(row => ({ ...row, creditorName: String(decryptCreditAccountData({ creditorName: row.creditorName }).creditorName) }));

      const updates = planTradelineBackfill({ reportId: report.id, reportBureau: report.bureau, rows, parsedAccounts: parsed.accounts });
      console.log(`report ${report.id}: ${updates.length} of ${rows.length} rows to fill`);

      if (apply) {
        for (const update of updates) {
          await db.update(creditAccounts).set(update.set).where(eq(creditAccounts.id, update.id));
        }
      }
      rowsUpdated += updates.length;
    } catch (error) {
      failed += 1;
      console.error(`report ${report.id}: skipped, ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  console.log(`${apply ? 'Updated' : 'Would update'} ${rowsUpdated} rows; ${failed} reports skipped`);
}

backfill(process.argv.includes('--apply'))
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
