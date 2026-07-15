import { db } from '@/db/client';
import { creditReports } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export interface ParserReviewGateResult {
  allowed: boolean;
  reason?: string;
  reportId?: string;
  parserReviewStatus?: string | null;
  parseStatus?: string | null;
}

export async function requireLatestApprovedReportForClient(clientId: string): Promise<ParserReviewGateResult> {
  const [latestReport] = await db
    .select()
    .from(creditReports)
    .where(eq(creditReports.clientId, clientId))
    .orderBy(desc(creditReports.uploadedAt))
    .limit(1);

  if (!latestReport) {
    return {
      allowed: false,
      reason: 'Upload and parse a credit report before using this workflow.',
    };
  }

  if (latestReport.parseStatus !== 'completed') {
    return {
      allowed: false,
      reason: 'The latest credit report is not fully parsed yet.',
      reportId: latestReport.id,
      parseStatus: latestReport.parseStatus,
      parserReviewStatus: latestReport.parserReviewStatus,
    };
  }

  if (latestReport.parserReviewStatus !== 'approved') {
    return {
      allowed: false,
      reason: 'The latest credit report must be approved in the parser review queue before continuing.',
      reportId: latestReport.id,
      parseStatus: latestReport.parseStatus,
      parserReviewStatus: latestReport.parserReviewStatus,
    };
  }

  return {
    allowed: true,
    reportId: latestReport.id,
    parseStatus: latestReport.parseStatus,
    parserReviewStatus: latestReport.parserReviewStatus,
  };
}
