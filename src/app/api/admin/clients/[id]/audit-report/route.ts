import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, creditAnalyses, negativeItems, creditAccounts, auditReports } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { generateAuditReportHTML, calculateProjectedScoreIncrease, type AuditReportData } from '@/lib/audit-report';

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
export async function GET(
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
