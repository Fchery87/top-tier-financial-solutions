import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { creditAccounts, creditReports, negativeItems } from '@/db/schema';
import { decryptCreditAccountData } from '@/lib/db-encryption';
import { findCrossBureauMismatches, type CrossBureauFinding, type CrossBureauRow } from '@/lib/cross-bureau-findings';
import type { SpecificBureau } from '@/lib/tradeline-matching';

const COMPARABLE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SPECIFIC_BUREAUS = ['transunion', 'experian', 'equifax'];

interface ReportRef {
  id: string;
  bureau: string | null;
  reportDate: Date | null;
  createdAt: Date | null;
}

/**
 * The pulls comparable with an anchor pull: a combined report on its own, or a
 * single-bureau report with other bureaus' single-bureau reports taken within 30 days.
 */
export function comparableReportIds(anchor: ReportRef, reports: ReportRef[]): string[] {
  if (!anchor.bureau || !SPECIFIC_BUREAUS.includes(anchor.bureau)) return [anchor.id];
  const anchorTime = (anchor.reportDate ?? anchor.createdAt)?.getTime();
  if (anchorTime === undefined) return [anchor.id];
  const nearest = new Map<string, ReportRef>();
  for (const report of reports) {
    if (!report.bureau || !SPECIFIC_BUREAUS.includes(report.bureau) || report.bureau === anchor.bureau) continue;
    const time = (report.reportDate ?? report.createdAt)?.getTime();
    if (time === undefined || Math.abs(time - anchorTime) > COMPARABLE_WINDOW_MS) continue;
    const current = nearest.get(report.bureau);
    const currentTime = current ? (current.reportDate ?? current.createdAt)?.getTime() ?? Infinity : Infinity;
    if (Math.abs(time - anchorTime) < Math.abs(currentTime - anchorTime)) nearest.set(report.bureau, report);
  }
  return [anchor.id, ...[...nearest.values()].map(report => report.id)];
}

export async function loadComparableTradelines(clientId: string, anchorReportId: string): Promise<CrossBureauRow[]> {
  const reports = await db
    .select({ id: creditReports.id, bureau: creditReports.bureau, reportDate: creditReports.reportDate, createdAt: creditReports.createdAt })
    .from(creditReports)
    .where(and(eq(creditReports.clientId, clientId), eq(creditReports.parseStatus, 'completed')));
  const anchor = reports.find(report => report.id === anchorReportId);
  if (!anchor) return [];

  const rows = await db
    .select()
    .from(creditAccounts)
    .where(and(eq(creditAccounts.clientId, clientId), inArray(creditAccounts.creditReportId, comparableReportIds(anchor, reports))));
  return rows.map(row => ({ ...row, creditorName: String(decryptCreditAccountData({ creditorName: row.creditorName }).creditorName) }));
}

interface ItemRef {
  id: string;
  creditReportId: string;
  creditAccountId: string | null;
}

/** Every Cross-Bureau Mismatch behind each negative item, judged within the item's own pull. */
export async function loadItemCrossBureauFindings(clientId: string, items: ItemRef[]): Promise<Map<string, CrossBureauFinding[]>> {
  const byItem = new Map<string, CrossBureauFinding[]>();
  for (const reportId of new Set(items.map(item => item.creditReportId))) {
    const reportFindings = findCrossBureauMismatches(await loadComparableTradelines(clientId, reportId));
    if (reportFindings.length === 0) continue;
    for (const item of items) {
      if (item.creditReportId !== reportId || !item.creditAccountId) continue;
      const accountId = item.creditAccountId;
      const itemFindings = reportFindings.filter(finding => finding.accountIds.includes(accountId));
      if (itemFindings.length > 0) byItem.set(item.id, itemFindings);
    }
  }
  return byItem;
}

/** Cross-bureau findings a letter to one bureau should carry for the negative items it covers. */
export async function loadLetterCrossBureauFindings(input: {
  clientId: string;
  negativeItemIds: string[];
  bureau: string;
}): Promise<CrossBureauFinding[]> {
  if (input.negativeItemIds.length === 0 || !SPECIFIC_BUREAUS.includes(input.bureau)) return [];
  const items = await db
    .select({ id: negativeItems.id, creditReportId: negativeItems.creditReportId, creditAccountId: negativeItems.creditAccountId })
    .from(negativeItems)
    .where(and(eq(negativeItems.clientId, input.clientId), inArray(negativeItems.id, input.negativeItemIds)));
  const byItem = await loadItemCrossBureauFindings(input.clientId, items);
  const findings = [...new Set([...byItem.values()].flat())];
  return findings.filter(finding => finding.letterText[input.bureau as SpecificBureau]);
}
