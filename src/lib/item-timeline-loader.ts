import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { creditAccounts, creditReports, disputes, negativeItems } from '@/db/schema';
import { decryptCreditAccountData } from '@/lib/db-encryption';
import { findTimelineFindings, type TimelineDispute, type TimelineFinding } from '@/lib/item-timeline';

/** Item Timeline findings across every pull in the anchor report's Service Engagement. */
export async function loadTimelineFindings(clientId: string, anchorReportId: string): Promise<TimelineFinding[]> {
  const [anchor] = await db
    .select({ serviceEngagementId: creditReports.serviceEngagementId })
    .from(creditReports)
    .where(and(eq(creditReports.id, anchorReportId), eq(creditReports.clientId, clientId)))
    .limit(1);
  if (!anchor) return [];

  const reports = await db
    .select({ id: creditReports.id, bureau: creditReports.bureau, reportDate: creditReports.reportDate, createdAt: creditReports.createdAt })
    .from(creditReports)
    .where(and(
      eq(creditReports.clientId, clientId),
      eq(creditReports.parseStatus, 'completed'),
      anchor.serviceEngagementId ? eq(creditReports.serviceEngagementId, anchor.serviceEngagementId) : isNull(creditReports.serviceEngagementId),
    ));
  if (reports.length < 2) return [];

  const rows = await db
    .select()
    .from(creditAccounts)
    .where(and(eq(creditAccounts.clientId, clientId), inArray(creditAccounts.creditReportId, reports.map(report => report.id))));

  const disputeRows = await db
    .select({
      id: disputes.id,
      negativeItemId: disputes.negativeItemId,
      priorDisputeId: disputes.priorDisputeId,
      bureau: disputes.bureau,
      outcome: disputes.outcome,
      responseReceivedAt: disputes.responseReceivedAt,
      creditAccountId: negativeItems.creditAccountId,
    })
    .from(disputes)
    .innerJoin(negativeItems, eq(disputes.negativeItemId, negativeItems.id))
    .where(and(eq(disputes.clientId, clientId), or(eq(disputes.outcome, 'verified'), isNull(disputes.outcome))));

  const continued = new Set(disputeRows.map(row => row.priorDisputeId).filter((id): id is string => !!id));
  const timelineDisputes: TimelineDispute[] = disputeRows
    .filter(row => row.creditAccountId)
    .map(row => ({
      creditAccountId: row.creditAccountId as string,
      bureau: row.bureau,
      outcome: row.outcome,
      responseReceivedAt: row.responseReceivedAt,
      stillDisputed: continued.has(row.id),
    }));

  return findTimelineFindings({
    pulls: reports.map(report => ({ id: report.id, bureau: report.bureau, pulledAt: (report.reportDate ?? report.createdAt) as Date })).filter(pull => pull.pulledAt),
    rows: rows.map(row => ({ ...row, creditorName: String(decryptCreditAccountData({ creditorName: row.creditorName }).creditorName) })),
    disputes: timelineDisputes,
  });
}
