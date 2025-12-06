import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, creditAnalyses, negativeItems, creditAccounts, auditReports, creditReports } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { generateAuditReportHTML, calculateProjectedScoreIncrease, type AuditReportData } from '@/lib/audit-report';
import { generateCreditAnalysisReportHTML, type CreditAnalysisReportData } from '@/lib/credit-analysis-report';
import { parseIdentityIQReport } from '@/lib/parsers/identityiq-parser';
import { getFileFromR2 } from '@/lib/r2-storage';
import type { BureauSummary, BureauCreditUtilization } from '@/lib/parsers/pdf-parser';

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

// GET - Generate and return report HTML (preview)
// Query params: ?type=comprehensive (default) | simple
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const reportType = searchParams.get('type') || 'comprehensive';

  try {
    // Get client info
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // For comprehensive report, try to get fresh parsed data from latest credit report
    if (reportType === 'comprehensive') {
      const [latestReport] = await db
        .select()
        .from(creditReports)
        .where(eq(creditReports.clientId, clientId))
        .orderBy(desc(creditReports.uploadedAt))
        .limit(1);

      if (latestReport && latestReport.fileType === 'html') {
        try {
          // Get file from R2 and parse it fresh
          const fileBuffer = await getFileFromR2(latestReport.fileUrl);
          const htmlContent = fileBuffer.toString('utf-8');
          const parsedData = parseIdentityIQReport(htmlContent);

          // Build comprehensive report data
          const comprehensiveData: CreditAnalysisReportData = {
            client: {
              firstName: client.firstName,
              lastName: client.lastName,
              email: client.email,
              phone: client.phone,
            },
            reportDate: latestReport.reportDate?.toISOString() || new Date().toISOString(),
            bureauSummary: parsedData.bureauSummary || createEmptyBureauSummary(),
            bureauPersonalInfo: parsedData.bureauPersonalInfo,
            creditUtilization: parsedData.creditUtilization || createEmptyCreditUtilization(),
            derogatoryAccounts: parsedData.derogatoryAccounts || [],
            publicRecords: parsedData.publicRecords || [],
            inquiries: parsedData.inquiries.map(inq => ({
              creditorName: inq.creditorName,
              inquiryDate: inq.inquiryDate,
              bureau: inq.bureau,
              inquiryType: inq.inquiryType,
            })),
            companyInfo: {
              name: 'Top Tier Financial Solutions',
              address: '2141 Cortelyou Road',
              city: 'Brooklyn',
              state: 'NY',
              zip: '11226',
              email: 'info@toptierfinancialsolutions.com',
              phone: '(347) 699-4664',
              officePhone: '(800) 478-7119',
              fax: '(718) 489-4145',
              website: 'https://www.toptierfinancialsolutions.com',
              preparedBy: 'Frantz Chery',
            },
          };

          const reportHtml = generateCreditAnalysisReportHTML(comprehensiveData);

          return new NextResponse(reportHtml, {
            headers: {
              'Content-Type': 'text/html',
            },
          });
        } catch (parseError) {
          console.error('Error parsing credit report for comprehensive view:', parseError);
          // Fall through to simple report
        }
      }
    }

    // Fallback to simple report or if type=simple
    const [analysis] = await db
      .select()
      .from(creditAnalyses)
      .where(eq(creditAnalyses.clientId, clientId))
      .orderBy(desc(creditAnalyses.createdAt))
      .limit(1);

    const negItems = await db
      .select()
      .from(negativeItems)
      .where(eq(negativeItems.clientId, clientId));

    const accounts = await db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.clientId, clientId));

    const reportData: AuditReportData = {
      client: {
        name: `${client.firstName} ${client.lastName}`,
        email: client.email,
        phone: client.phone,
      },
      scores: {
        transunion: analysis?.scoreTransunion || null,
        experian: analysis?.scoreExperian || null,
        equifax: analysis?.scoreEquifax || null,
      },
      negativeItems: negItems.map(item => ({
        itemType: item.itemType,
        creditorName: item.creditorName,
        amount: item.amount,
        riskSeverity: item.riskSeverity || 'medium',
        recommendedAction: item.recommendedAction,
        bureau: item.bureau,
      })),
      accounts: accounts.map(acc => ({
        creditorName: acc.creditorName,
        accountType: acc.accountType,
        balance: acc.balance,
        creditLimit: acc.creditLimit,
        isNegative: acc.isNegative || false,
      })),
      summary: {
        totalAccounts: analysis?.totalAccounts || accounts.length,
        openAccounts: analysis?.openAccounts || 0,
        totalDebt: analysis?.totalDebt || 0,
        totalCreditLimit: analysis?.totalCreditLimit || 0,
        utilizationPercent: analysis?.utilizationPercent || null,
        derogatoryCount: analysis?.derogatoryCount || 0,
        collectionsCount: analysis?.collectionsCount || 0,
        latePaymentCount: analysis?.latePaymentCount || 0,
      },
      recommendations: analysis?.recommendations ? JSON.parse(analysis.recommendations) : [],
      generatedAt: new Date(),
    };

    const reportHtml = generateAuditReportHTML(reportData);

    return new NextResponse(reportHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error generating audit report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

// Helper functions to create empty bureau data
function createEmptyBureauSummary(): BureauSummary {
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

function createEmptyCreditUtilization(): BureauCreditUtilization {
  const emptyUtil = { balance: 0, limit: 0, percent: 0, rating: 'no_data' as const };
  return {
    transunion: { ...emptyUtil },
    experian: { ...emptyUtil },
    equifax: { ...emptyUtil },
    total: { ...emptyUtil },
  };
}

// POST - Generate, save to database, and return report info
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;

  try {
    // Get client info
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get latest analysis
    const [analysis] = await db
      .select()
      .from(creditAnalyses)
      .where(eq(creditAnalyses.clientId, clientId))
      .orderBy(desc(creditAnalyses.createdAt))
      .limit(1);

    // Get negative items
    const negItems = await db
      .select()
      .from(negativeItems)
      .where(eq(negativeItems.clientId, clientId));

    // Get credit accounts
    const accounts = await db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.clientId, clientId));

    // Build report data
    const reportData: AuditReportData = {
      client: {
        name: `${client.firstName} ${client.lastName}`,
        email: client.email,
        phone: client.phone,
      },
      scores: {
        transunion: analysis?.scoreTransunion || null,
        experian: analysis?.scoreExperian || null,
        equifax: analysis?.scoreEquifax || null,
      },
      negativeItems: negItems.map(item => ({
        itemType: item.itemType,
        creditorName: item.creditorName,
        amount: item.amount,
        riskSeverity: item.riskSeverity || 'medium',
        recommendedAction: item.recommendedAction,
        bureau: item.bureau,
      })),
      accounts: accounts.map(acc => ({
        creditorName: acc.creditorName,
        accountType: acc.accountType,
        balance: acc.balance,
        creditLimit: acc.creditLimit,
        isNegative: acc.isNegative || false,
      })),
      summary: {
        totalAccounts: analysis?.totalAccounts || accounts.length,
        openAccounts: analysis?.openAccounts || 0,
        totalDebt: analysis?.totalDebt || 0,
        totalCreditLimit: analysis?.totalCreditLimit || 0,
        utilizationPercent: analysis?.utilizationPercent || null,
        derogatoryCount: analysis?.derogatoryCount || 0,
        collectionsCount: analysis?.collectionsCount || 0,
        latePaymentCount: analysis?.latePaymentCount || 0,
      },
      recommendations: analysis?.recommendations ? JSON.parse(analysis.recommendations) : [],
      generatedAt: new Date(),
    };

    const reportHtml = generateAuditReportHTML(reportData);
    const projectedIncrease = calculateProjectedScoreIncrease(reportData.negativeItems);

    // Save to database
    const reportId = randomUUID();
    const now = new Date();

    await db.insert(auditReports).values({
      id: reportId,
      clientId,
      generatedById: adminUser.id,
      reportHtml,
      scoreTransunion: analysis?.scoreTransunion || null,
      scoreExperian: analysis?.scoreExperian || null,
      scoreEquifax: analysis?.scoreEquifax || null,
      negativeItemsCount: negItems.length,
      totalDebt: analysis?.totalDebt || null,
      projectedScoreIncrease: projectedIncrease,
      sentViaEmail: false,
      generatedAt: now,
      createdAt: now,
    });

    return NextResponse.json({
      id: reportId,
      client_id: clientId,
      generated_at: now.toISOString(),
      negative_items_count: negItems.length,
      projected_score_increase: projectedIncrease,
      scores: {
        transunion: analysis?.scoreTransunion || null,
        experian: analysis?.scoreExperian || null,
        equifax: analysis?.scoreEquifax || null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving audit report:', error);
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 });
  }
}
