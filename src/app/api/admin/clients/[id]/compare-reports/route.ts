import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, creditReports, negativeItems, creditAccounts, creditScoreHistory } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { eq, desc } from 'drizzle-orm';

async function validateAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return null;
  }
  
  const isAdmin = await isSuperAdmin(session.user.email);
  if (!isAdmin) {
    return null;
  }
  
  return session.user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;
  const { searchParams } = new URL(request.url);
  const reportId1 = searchParams.get('report1');
  const reportId2 = searchParams.get('report2');

  try {
    // Verify client exists
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get all reports for this client
    const reports = await db
      .select()
      .from(creditReports)
      .where(eq(creditReports.clientId, clientId))
      .orderBy(desc(creditReports.uploadedAt));

    if (reports.length < 2) {
      return NextResponse.json({
        error: 'Need at least 2 credit reports to compare',
        reports_count: reports.length,
      }, { status: 400 });
    }

    // Use provided report IDs or default to most recent vs second most recent
    const olderReportId = reportId1 || reports[1]?.id;
    const newerReportId = reportId2 || reports[0]?.id;

    if (!olderReportId || !newerReportId) {
      return NextResponse.json({ error: 'Could not determine reports to compare' }, { status: 400 });
    }

    // Get analyses for both reports
    const [olderReport] = await db
      .select()
      .from(creditReports)
      .where(eq(creditReports.id, olderReportId))
      .limit(1);

    const [newerReport] = await db
      .select()
      .from(creditReports)
      .where(eq(creditReports.id, newerReportId))
      .limit(1);

    // Get negative items from both reports
    const olderNegativeItems = await db
      .select()
      .from(negativeItems)
      .where(eq(negativeItems.creditReportId, olderReportId));

    const newerNegativeItems = await db
      .select()
      .from(negativeItems)
      .where(eq(negativeItems.creditReportId, newerReportId));

    // Get accounts from both reports
    const olderAccounts = await db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.creditReportId, olderReportId));

    const newerAccounts = await db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.creditReportId, newerReportId));

    // Get score history for comparison period
    const scoreHistory = await db
      .select()
      .from(creditScoreHistory)
      .where(eq(creditScoreHistory.clientId, clientId))
      .orderBy(desc(creditScoreHistory.recordedAt));

    // Compare and find differences
    const comparison = compareReportData(
      {
        report: olderReport,
        negativeItems: olderNegativeItems,
        accounts: olderAccounts,
      },
      {
        report: newerReport,
        negativeItems: newerNegativeItems,
        accounts: newerAccounts,
      }
    );

    // Get score at each report time
    const olderScoreRecord = scoreHistory.find(s => 
      s.creditReportId === olderReportId
    );
    const newerScoreRecord = scoreHistory.find(s => 
      s.creditReportId === newerReportId
    );

    return NextResponse.json({
      client: {
        id: client.id,
        name: `${client.firstName} ${client.lastName}`,
      },
      older_report: {
        id: olderReport.id,
        uploaded_at: olderReport.uploadedAt?.toISOString(),
        bureau: olderReport.bureau,
        report_date: olderReport.reportDate?.toISOString(),
        scores: olderScoreRecord ? {
          transunion: olderScoreRecord.scoreTransunion,
          experian: olderScoreRecord.scoreExperian,
          equifax: olderScoreRecord.scoreEquifax,
          average: olderScoreRecord.averageScore,
        } : null,
      },
      newer_report: {
        id: newerReport.id,
        uploaded_at: newerReport.uploadedAt?.toISOString(),
        bureau: newerReport.bureau,
        report_date: newerReport.reportDate?.toISOString(),
        scores: newerScoreRecord ? {
          transunion: newerScoreRecord.scoreTransunion,
          experian: newerScoreRecord.scoreExperian,
          equifax: newerScoreRecord.scoreEquifax,
          average: newerScoreRecord.averageScore,
        } : null,
      },
      comparison: {
        ...comparison,
        score_changes: calculateScoreChanges(olderScoreRecord, newerScoreRecord),
      },
      available_reports: reports.map(r => ({
        id: r.id,
        uploaded_at: r.uploadedAt?.toISOString(),
        bureau: r.bureau,
        report_date: r.reportDate?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error comparing reports:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compare reports' },
      { status: 500 }
    );
  }
}

interface ReportData {
  report: typeof creditReports.$inferSelect;
  negativeItems: (typeof negativeItems.$inferSelect)[];
  accounts: (typeof creditAccounts.$inferSelect)[];
}

function compareReportData(older: ReportData, newer: ReportData) {
  // Find removed negative items (WINS!)
  const removedItems: Array<{
    id: string;
    creditor_name: string;
    item_type: string;
    amount: number | null;
    bureau: string | null;
    risk_severity: string;
  }> = [];

  // Find new negative items (problems)
  const newItems: Array<{
    id: string;
    creditor_name: string;
    item_type: string;
    amount: number | null;
    bureau: string | null;
    risk_severity: string;
  }> = [];

  // Compare by creditor name + type + bureau (fuzzy match)
  const olderItemKeys = new Map(
    older.negativeItems.map(item => [
      normalizeItemKey(item.creditorName, item.itemType, item.bureau),
      item
    ])
  );

  const newerItemKeys = new Map(
    newer.negativeItems.map(item => [
      normalizeItemKey(item.creditorName, item.itemType, item.bureau),
      item
    ])
  );

  // Find removed (in older but not in newer = WIN!)
  for (const [key, item] of olderItemKeys) {
    if (!newerItemKeys.has(key)) {
      removedItems.push({
        id: item.id,
        creditor_name: item.creditorName,
        item_type: item.itemType,
        amount: item.amount,
        bureau: item.bureau,
        risk_severity: item.riskSeverity || 'medium',
      });
    }
  }

  // Find new items (in newer but not in older)
  for (const [key, item] of newerItemKeys) {
    if (!olderItemKeys.has(key)) {
      newItems.push({
        id: item.id,
        creditor_name: item.creditorName,
        item_type: item.itemType,
        amount: item.amount,
        bureau: item.bureau,
        risk_severity: item.riskSeverity || 'medium',
      });
    }
  }

  // Account changes
  const accountsRemoved: string[] = [];
  const accountsAdded: string[] = [];

  const olderAccountKeys = new Set(
    older.accounts.map(a => normalizeAccountKey(a.creditorName, a.accountType))
  );

  const newerAccountKeys = new Set(
    newer.accounts.map(a => normalizeAccountKey(a.creditorName, a.accountType))
  );

  for (const key of olderAccountKeys) {
    if (!newerAccountKeys.has(key)) {
      accountsRemoved.push(key);
    }
  }

  for (const key of newerAccountKeys) {
    if (!olderAccountKeys.has(key)) {
      accountsAdded.push(key);
    }
  }

  // Calculate debt changes
  const olderTotalDebt = older.accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const newerTotalDebt = newer.accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  return {
    items_removed: removedItems,
    items_removed_count: removedItems.length,
    items_added: newItems,
    items_added_count: newItems.length,
    accounts_removed: accountsRemoved,
    accounts_added: accountsAdded,
    debt_change: newerTotalDebt - olderTotalDebt,
    older_total_negative_items: older.negativeItems.length,
    newer_total_negative_items: newer.negativeItems.length,
    older_total_accounts: older.accounts.length,
    newer_total_accounts: newer.accounts.length,
    summary: {
      is_improvement: removedItems.length > newItems.length,
      net_items_removed: removedItems.length - newItems.length,
      has_wins: removedItems.length > 0,
    },
  };
}

function normalizeItemKey(creditorName: string, itemType: string, bureau: string | null): string {
  return `${creditorName.toLowerCase().trim()}|${itemType}|${bureau || 'unknown'}`;
}

function normalizeAccountKey(creditorName: string, accountType: string | null): string {
  return `${creditorName.toLowerCase().trim()}|${accountType || 'unknown'}`;
}

function calculateScoreChanges(
  older: typeof creditScoreHistory.$inferSelect | undefined,
  newer: typeof creditScoreHistory.$inferSelect | undefined
) {
  if (!older || !newer) {
    return null;
  }

  const changes: Array<{
    bureau: string;
    older_score: number | null;
    newer_score: number | null;
    change: number;
  }> = [];

  const bureaus = [
    { key: 'transunion', older: older.scoreTransunion, newer: newer.scoreTransunion },
    { key: 'experian', older: older.scoreExperian, newer: newer.scoreExperian },
    { key: 'equifax', older: older.scoreEquifax, newer: newer.scoreEquifax },
  ];

  for (const { key, older: olderScore, newer: newerScore } of bureaus) {
    if (olderScore !== null || newerScore !== null) {
      changes.push({
        bureau: key,
        older_score: olderScore,
        newer_score: newerScore,
        change: (newerScore || 0) - (olderScore || 0),
      });
    }
  }

  const olderAvg = older.averageScore;
  const newerAvg = newer.averageScore;

  return {
    by_bureau: changes,
    average_change: olderAvg && newerAvg ? newerAvg - olderAvg : null,
    total_improvement: changes.reduce((sum, c) => sum + Math.max(0, c.change), 0),
  };
}
