import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, creditReports, creditAnalyses, creditAccounts, negativeItems, disputes, user } from '@/db/schema';
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

  const { id } = await params;

  try {
    const [clientResult] = await db
      .select({
        id: clients.id,
        userId: clients.userId,
        leadId: clients.leadId,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
        status: clients.status,
        notes: clients.notes,
        convertedAt: clients.convertedAt,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(clients)
      .leftJoin(user, eq(clients.userId, user.id))
      .where(eq(clients.id, id))
      .limit(1);

    if (!clientResult) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get credit reports
    const reports = await db
      .select()
      .from(creditReports)
      .where(eq(creditReports.clientId, id))
      .orderBy(desc(creditReports.uploadedAt));

    // Get latest analysis
    const [latestAnalysis] = await db
      .select()
      .from(creditAnalyses)
      .where(eq(creditAnalyses.clientId, id))
      .orderBy(desc(creditAnalyses.createdAt))
      .limit(1);

    // Get all credit accounts
    const accountsResult = await db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.clientId, id))
      .orderBy(desc(creditAccounts.createdAt));

    // Get negative items (full list)
    const negativeItemsResult = await db
      .select()
      .from(negativeItems)
      .where(eq(negativeItems.clientId, id))
      .orderBy(desc(negativeItems.createdAt));

    // Get disputes
    const disputesResult = await db
      .select()
      .from(disputes)
      .where(eq(disputes.clientId, id))
      .orderBy(desc(disputes.createdAt));

    // Parse recommendations from latest analysis
    let recommendations: string[] = [];
    if (latestAnalysis?.recommendations) {
      try {
        recommendations = JSON.parse(latestAnalysis.recommendations);
      } catch {
        recommendations = [];
      }
    }

    return NextResponse.json({
      client: {
        id: clientResult.id,
        user_id: clientResult.userId,
        lead_id: clientResult.leadId,
        first_name: clientResult.firstName,
        last_name: clientResult.lastName,
        email: clientResult.email,
        phone: clientResult.phone,
        status: clientResult.status,
        notes: clientResult.notes,
        converted_at: clientResult.convertedAt?.toISOString(),
        created_at: clientResult.createdAt?.toISOString(),
        updated_at: clientResult.updatedAt?.toISOString(),
        user_name: clientResult.userName,
        user_email: clientResult.userEmail,
      },
      credit_reports: reports.map(r => ({
        id: r.id,
        file_name: r.fileName,
        file_type: r.fileType,
        file_url: r.fileUrl,
        file_size: r.fileSize,
        bureau: r.bureau,
        report_date: r.reportDate?.toISOString(),
        parse_status: r.parseStatus,
        uploaded_at: r.uploadedAt?.toISOString(),
      })),
      latest_analysis: latestAnalysis ? {
        id: latestAnalysis.id,
        score_transunion: latestAnalysis.scoreTransunion,
        score_experian: latestAnalysis.scoreExperian,
        score_equifax: latestAnalysis.scoreEquifax,
        total_accounts: latestAnalysis.totalAccounts,
        open_accounts: latestAnalysis.openAccounts,
        closed_accounts: latestAnalysis.closedAccounts,
        total_debt: latestAnalysis.totalDebt,
        total_credit_limit: latestAnalysis.totalCreditLimit,
        utilization_percent: latestAnalysis.utilizationPercent,
        derogatory_count: latestAnalysis.derogatoryCount,
        collections_count: latestAnalysis.collectionsCount,
        late_payment_count: latestAnalysis.latePaymentCount,
        inquiry_count: latestAnalysis.inquiryCount,
        created_at: latestAnalysis.createdAt?.toISOString(),
        recommendations,
      } : null,
      credit_accounts: accountsResult.map(a => ({
        id: a.id,
        creditor_name: a.creditorName,
        account_number: a.accountNumber,
        account_type: a.accountType,
        account_status: a.accountStatus,
        balance: a.balance,
        credit_limit: a.creditLimit,
        high_credit: a.highCredit,
        monthly_payment: a.monthlyPayment,
        past_due_amount: a.pastDueAmount,
        payment_status: a.paymentStatus,
        date_opened: a.dateOpened?.toISOString(),
        bureau: a.bureau,
        is_negative: a.isNegative,
        risk_level: a.riskLevel,
      })),
      negative_items: negativeItemsResult.map(n => ({
        id: n.id,
        item_type: n.itemType,
        creditor_name: n.creditorName,
        original_creditor: n.originalCreditor,
        amount: n.amount,
        date_reported: n.dateReported?.toISOString(),
        bureau: n.bureau,
        risk_severity: n.riskSeverity,
        recommended_action: n.recommendedAction,
        dispute_reason: n.disputeReason,
        notes: n.notes,
      })),
      negative_items_count: negativeItemsResult.length,
      disputes: disputesResult.map(d => ({
        id: d.id,
        bureau: d.bureau,
        dispute_reason: d.disputeReason,
        dispute_type: d.disputeType,
        status: d.status,
        round: d.round,
        sent_at: d.sentAt?.toISOString(),
        outcome: d.outcome,
        created_at: d.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const now = new Date();

    const updateData: Record<string, unknown> = { updatedAt: now };

    if (body.first_name !== undefined) updateData.firstName = body.first_name;
    if (body.last_name !== undefined) updateData.lastName = body.last_name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.user_id !== undefined) updateData.userId = body.user_id;

    await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await db.delete(clients).where(eq(clients.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
