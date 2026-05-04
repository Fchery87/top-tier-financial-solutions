import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { creditReports } from '@/db/schema';
import { getAdminSessionUser } from '@/lib/admin-session';

function formatPull(report: typeof creditReports.$inferSelect) {
  return {
    id: report.id,
    client_id: report.clientId,
    service_engagement_id: report.serviceEngagementId,
    bureau: report.bureau,
    report_date: report.reportDate?.toISOString() || null,
    pulled_at: report.uploadedAt?.toISOString() || null,
    parse_status: report.parseStatus,
    parser_confidence: report.parserConfidence,
    parser_review_status: report.parserReviewStatus,
  };
}

async function validateAdmin() {
  return getAdminSessionUser('super_admin');
}

export async function GET(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceEngagementId = request.nextUrl.searchParams.get('service_engagement_id');
  if (!serviceEngagementId) {
    return NextResponse.json({ error: 'Service engagement ID is required' }, { status: 400 });
  }

  try {
    const reports = await db
      .select()
      .from(creditReports)
      .where(eq(creditReports.serviceEngagementId, serviceEngagementId))
      .orderBy(asc(creditReports.uploadedAt));

    return NextResponse.json({ items: reports.map(formatPull) });
  } catch (error) {
    console.error('Error fetching credit report pulls:', error);
    return NextResponse.json({ error: 'Failed to fetch credit report pulls' }, { status: 500 });
  }
}
