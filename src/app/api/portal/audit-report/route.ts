import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, auditReports, creditAnalyses } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq, desc } from 'drizzle-orm';

import type { BureauSummary, BureauCreditUtilization } from '@/lib/parsers/pdf-parser';

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.id) {
    return null;
  }
  
  return session.user;
}

// GET - Check if client has an audit report available
export async function GET(_request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find the client record linked to this user
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ 
        has_report: false,
        message: 'No client profile found. Please contact support.' 
      });
    }

    // Check if there's a completed analysis
    const [analysis] = await db
      .select()
      .from(creditAnalyses)
      .where(eq(creditAnalyses.clientId, client.id))
      .orderBy(desc(creditAnalyses.createdAt))
      .limit(1);

    // Check for saved audit reports
    const [savedReport] = await db
      .select()
      .from(auditReports)
      .where(eq(auditReports.clientId, client.id))
      .orderBy(desc(auditReports.generatedAt))
      .limit(1);

    const hasReport = !!analysis || !!savedReport;

    return NextResponse.json({
      has_report: hasReport,
      client_name: `${client.firstName} ${client.lastName}`,
      report_date: savedReport?.generatedAt?.toISOString() || analysis?.createdAt?.toISOString(),
      scores: analysis ? {
        transunion: analysis.scoreTransunion,
        experian: analysis.scoreExperian,
        equifax: analysis.scoreEquifax,
      } : null,
    });
  } catch (error) {
    console.error('Error checking audit report:', error);
    return NextResponse.json({ error: 'Failed to check report status' }, { status: 500 });
  }
}

// Helper functions for empty bureau data
function _createEmptyBureauSummary(): BureauSummary {
  const emptyMetrics = {
    creditScore: undefined,
    lenderRank: undefined,
    scoreScale: undefined,
    reportDate: undefined,
    totalAccounts: 0,
    openAccounts: 0,
    closedAccounts: 0,
    delinquent: 0,
    derogatory: 0,
    collection: 0,
    balances: 0,
    payments: 0,
    publicRecords: 0,
    inquiries: 0,
  };
  return {
    transunion: { ...emptyMetrics },
    experian: { ...emptyMetrics },
    equifax: { ...emptyMetrics },
  };
}

function _createEmptyCreditUtilization(): BureauCreditUtilization {
  const emptyUtil = { balance: 0, limit: 0, percent: 0, rating: 'no_data' as const };
  return {
    transunion: { ...emptyUtil },
    experian: { ...emptyUtil },
    equifax: { ...emptyUtil },
    total: { ...emptyUtil },
  };
}
