import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, creditAnalyses, creditReports, negativeItems, creditAccounts } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq, desc } from 'drizzle-orm';
import { generateAuditReportHTML, type AuditReportData } from '@/lib/audit-report';
import { generateCreditAnalysisReportHTML, type CreditAnalysisReportData } from '@/lib/credit-analysis-report';
import { parseIdentityIQReport } from '@/lib/parsers/identityiq-parser';
import { getFileFromR2 } from '@/lib/r2-storage';
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

// Helper functions for empty bureau data
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

// GET - Generate and return the HTML report for the authenticated client
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const reportType = searchParams.get('type') || 'simple';

  try {
    // Find the client record linked to this user
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return new NextResponse('No client profile found', { status: 404 });
    }

    // For comprehensive report, try to get fresh parsed data from latest credit report
    if (reportType === 'comprehensive') {
      const [latestReport] = await db
        .select()
        .from(creditReports)
        .where(eq(creditReports.clientId, client.id))
        .orderBy(desc(creditReports.uploadedAt))
        .limit(1);

      if (latestReport && latestReport.fileType === 'html') {
        try {
          const fileBuffer = await getFileFromR2(latestReport.fileUrl);
          const htmlContent = fileBuffer.toString('utf-8');
          const parsedData = parseIdentityIQReport(htmlContent);

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
            headers: { 'Content-Type': 'text/html' },
          });
        } catch (parseError) {
          console.error('Error parsing credit report for comprehensive view:', parseError);
          // Fall through to simple report
        }
      }
    }

    // Fallback to simple report
    const [analysis] = await db
      .select()
      .from(creditAnalyses)
      .where(eq(creditAnalyses.clientId, client.id))
      .orderBy(desc(creditAnalyses.createdAt))
      .limit(1);

    if (!analysis) {
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Report Not Available</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F9F8F6; }
            .container { text-align: center; padding: 40px; max-width: 500px; }
            h1 { color: #0F172A; margin-bottom: 16px; }
            p { color: #64748B; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Report Not Yet Available</h1>
            <p>Your credit analysis report is still being prepared. Please check back later or contact support if you have questions.</p>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Get negative items
    const negItems = await db
      .select()
      .from(negativeItems)
      .where(eq(negativeItems.clientId, client.id));

    // Get accounts
    const accounts = await db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.clientId, client.id));

    const reportData: AuditReportData = {
      client: {
        name: `${client.firstName} ${client.lastName}`,
        email: client.email,
        phone: client.phone,
      },
      scores: {
        transunion: analysis.scoreTransunion,
        experian: analysis.scoreExperian,
        equifax: analysis.scoreEquifax,
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
        totalAccounts: analysis.totalAccounts || accounts.length,
        openAccounts: analysis.openAccounts || 0,
        totalDebt: analysis.totalDebt || 0,
        totalCreditLimit: analysis.totalCreditLimit || 0,
        utilizationPercent: analysis.utilizationPercent,
        derogatoryCount: analysis.derogatoryCount || 0,
        collectionsCount: analysis.collectionsCount || 0,
        latePaymentCount: analysis.latePaymentCount || 0,
      },
      recommendations: analysis.recommendations ? JSON.parse(analysis.recommendations) : [],
      generatedAt: new Date(),
    };

    const reportHtml = generateAuditReportHTML(reportData);

    return new NextResponse(reportHtml, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Error generating audit report:', error);
    return new NextResponse('Failed to generate report', { status: 500 });
  }
}
