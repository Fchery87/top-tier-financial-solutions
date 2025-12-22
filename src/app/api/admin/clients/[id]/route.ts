import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, creditReports, creditAnalyses, creditAccounts, negativeItems, disputes, creditScoreHistory, user, personalInfoDisputes, inquiryDisputes, clientAgreements, tasks, clientCases } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { eq, desc, asc } from 'drizzle-orm';
import { decryptClientData, decryptCreditAccountData, decryptNegativeItemData, decryptDisputeData, encryptClientData } from '@/lib/db-encryption';
import { encrypt } from '@/lib/encryption';

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

    // Decrypt client data
    const decryptedClient = decryptClientData({
      firstName: clientResult.firstName,
      lastName: clientResult.lastName,
      phone: clientResult.phone,
      streetAddress: undefined, // Not fetched in this query
      city: undefined,
      state: undefined,
      zipCode: undefined,
      dateOfBirth: undefined,
      ssnLast4: undefined,
    });

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

    // Get personal info and inquiry disputes (PII + inquiries from parser)
    const personalInfoDisputesResult = await db
      .select()
      .from(personalInfoDisputes)
      .where(eq(personalInfoDisputes.clientId, id))
      .orderBy(desc(personalInfoDisputes.createdAt));

    const inquiryDisputesResult = await db
      .select()
      .from(inquiryDisputes)
      .where(eq(inquiryDisputes.clientId, id))
      .orderBy(desc(inquiryDisputes.createdAt));

    // Get score history for timeline
    const scoreHistoryResult = await db
      .select()
      .from(creditScoreHistory)
      .where(eq(creditScoreHistory.clientId, id))
      .orderBy(asc(creditScoreHistory.recordedAt));

    // Readiness signals derived from existing data
    const agreementsForClient = await db
      .select({ status: clientAgreements.status })
      .from(clientAgreements)
      .where(eq(clientAgreements.clientId, id));

    const tasksForClient = await db
      .select({
        status: tasks.status,
        visibleToClient: tasks.visibleToClient,
        isBlocking: tasks.isBlocking,
        createdAt: tasks.createdAt,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(eq(tasks.clientId, id));

    const casesForClient = clientResult.userId
      ? await db
          .select({ id: clientCases.id })
          .from(clientCases)
          .where(eq(clientCases.userId, clientResult.userId))
      : [];

    // Parse recommendations from latest analysis
    let recommendations: string[] = [];
    if (latestAnalysis?.recommendations) {
      try {
        recommendations = JSON.parse(latestAnalysis.recommendations);
      } catch {
        recommendations = [];
      }
    }

    const hasPortalUser = !!clientResult.userId;
    const hasSignedAgreement = agreementsForClient.some(a => a.status === 'signed');
    const hasCreditReport = reports.length > 0;
    const hasAnalyzedReport = !!latestAnalysis;
    const hasCase = casesForClient.length > 0;
    const hasDisputes = disputesResult.length > 0;

    const unfinishedClientTasks = tasksForClient.filter(
      (t) => t.visibleToClient && t.status !== 'done',
    );
    const blockingTasks = unfinishedClientTasks.filter((t) => t.isBlocking);

    // Derive how long we've been waiting on the client based on the oldest blocking task
    let waitingOnClientSince: Date | null = null;
    for (const task of blockingTasks) {
      const candidate = task.dueDate || task.createdAt;
      if (!candidate) continue;
      if (!waitingOnClientSince || candidate < waitingOnClientSince) {
        waitingOnClientSince = candidate;
      }
    }

    const now = new Date();
    const waitingOnClientDays = waitingOnClientSince
      ? Math.floor((now.getTime() - waitingOnClientSince.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Simple SLA-style at-risk flag: client has open blocking tasks for 7+ days
    const atRisk = blockingTasks.length > 0 && waitingOnClientDays >= 7;

    const readiness = {
      has_portal_user: hasPortalUser,
      has_signed_agreement: hasSignedAgreement,
      has_credit_report: hasCreditReport,
      has_analyzed_report: hasAnalyzedReport,
      has_case: hasCase,
      has_disputes: hasDisputes,
      unfinished_client_tasks: unfinishedClientTasks.length,
      blocking_tasks: blockingTasks.length,
      waiting_on_client_since: waitingOnClientSince?.toISOString() ?? null,
      waiting_on_client_days: waitingOnClientSince ? waitingOnClientDays : null,
      at_risk: atRisk,
      is_ready_for_round:
        hasPortalUser && hasSignedAgreement && hasAnalyzedReport && blockingTasks.length === 0,
    };

    return NextResponse.json({
      client: {
        id: clientResult.id,
        user_id: clientResult.userId,
        lead_id: clientResult.leadId,
        first_name: decryptedClient.firstName,
        last_name: decryptedClient.lastName,
        email: clientResult.email,
        phone: decryptedClient.phone,
        status: clientResult.status,
        notes: clientResult.notes,
        converted_at: clientResult.convertedAt?.toISOString(),
        created_at: clientResult.createdAt?.toISOString(),
        updated_at: clientResult.updatedAt?.toISOString(),
        user_name: clientResult.userName,
        user_email: clientResult.userEmail,
      },
      readiness,
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
      credit_accounts: accountsResult.map(a => {
        // Compute bureaus array from per-bureau booleans
        const bureaus: string[] = [];
        if (a.onTransunion) bureaus.push('transunion');
        if (a.onExperian) bureaus.push('experian');
        if (a.onEquifax) bureaus.push('equifax');

        // Decrypt credit account data
        const decrypted = decryptCreditAccountData({
          creditorName: a.creditorName,
        });

        return {
          id: a.id,
          creditor_name: decrypted.creditorName,
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
          bureau: a.bureau, // Legacy field
          // Per-bureau presence data
          bureaus, // Computed array of bureau names
          on_transunion: a.onTransunion ?? false,
          on_experian: a.onExperian ?? false,
          on_equifax: a.onEquifax ?? false,
          transunion_date: a.transunionDate?.toISOString(),
          experian_date: a.experianDate?.toISOString(),
          equifax_date: a.equifaxDate?.toISOString(),
          transunion_balance: a.transunionBalance,
          experian_balance: a.experianBalance,
          equifax_balance: a.equifaxBalance,
          is_negative: a.isNegative,
          risk_level: a.riskLevel,
        };
      }),
      negative_items: negativeItemsResult.map(n => {
        // Compute bureaus array from per-bureau booleans
        const bureaus: string[] = [];
        if (n.onTransunion) bureaus.push('transunion');
        if (n.onExperian) bureaus.push('experian');
        if (n.onEquifax) bureaus.push('equifax');

        // Decrypt negative item data
        const decrypted = decryptNegativeItemData({
          creditorName: n.creditorName,
        });

        return {
          id: n.id,
          item_type: n.itemType,
          creditor_name: decrypted.creditorName,
          original_creditor: n.originalCreditor,
          amount: n.amount,
          date_reported: n.dateReported?.toISOString(),
          bureau: n.bureau, // Legacy field
          // Per-bureau presence data
          bureaus, // Computed array of bureau names
          on_transunion: n.onTransunion ?? false,
          on_experian: n.onExperian ?? false,
          on_equifax: n.onEquifax ?? false,
          transunion_date: n.transunionDate?.toISOString(),
          experian_date: n.experianDate?.toISOString(),
          equifax_date: n.equifaxDate?.toISOString(),
          transunion_status: n.transunionStatus,
          experian_status: n.experianStatus,
          equifax_status: n.equifaxStatus,
          risk_severity: n.riskSeverity,
          recommended_action: n.recommendedAction,
          dispute_reason: n.disputeReason,
          notes: n.notes,
        };
      }),
      negative_items_count: negativeItemsResult.length,
      personal_info_disputes: personalInfoDisputesResult.map(p => ({
        id: p.id,
        bureau: p.bureau,
        type: p.type,
        value: p.value,
        created_at: p.createdAt?.toISOString(),
      })),
      inquiry_disputes: inquiryDisputesResult.map(i => ({
        id: i.id,
        creditor_name: i.creditorName,
        bureau: i.bureau,
        inquiry_date: i.inquiryDate?.toISOString(),
        inquiry_type: i.inquiryType,
        is_past_fcra_limit: i.isPastFcraLimit,
        days_since_inquiry: i.daysSinceInquiry,
        created_at: i.createdAt?.toISOString(),
      })),
      disputes: disputesResult.map(d => {
        // Decrypt dispute data
        const decrypted = decryptDisputeData({
          creditorName: d.creditorName,
        });

        return {
          id: d.id,
          bureau: d.bureau,
          dispute_reason: d.disputeReason,
          dispute_type: d.disputeType,
          status: d.status,
          round: d.round,
          tracking_number: d.trackingNumber,
          sent_at: d.sentAt?.toISOString(),
          response_deadline: d.responseDeadline?.toISOString(),
          response_received_at: d.responseReceivedAt?.toISOString(),
          outcome: d.outcome,
          response_notes: d.responseNotes,
          response_document_url: d.responseDocumentUrl,
          verification_method: d.verificationMethod,
          escalation_reason: d.escalationReason,
          creditor_name: decrypted.creditorName,
          account_number: d.accountNumber,
          created_at: d.createdAt?.toISOString(),
        };
      }),
      score_history: scoreHistoryResult.map(s => ({
        id: s.id,
        score_transunion: s.scoreTransunion,
        score_experian: s.scoreExperian,
        score_equifax: s.scoreEquifax,
        average_score: s.averageScore,
        source: s.source,
        notes: s.notes,
        recorded_at: s.recordedAt?.toISOString(),
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

    // Encrypt PII fields if they're being updated
    const fieldsToEncrypt: Record<string, string | null> = {};

    if (body.first_name !== undefined) {
      fieldsToEncrypt.firstName = body.first_name;
    }
    if (body.last_name !== undefined) {
      fieldsToEncrypt.lastName = body.last_name;
    }
    if (body.phone !== undefined) {
      fieldsToEncrypt.phone = body.phone;
    }

    // Encrypt if there are PII fields to update
    if (Object.keys(fieldsToEncrypt).length > 0) {
      const encrypted = encryptClientData(fieldsToEncrypt);
      Object.assign(updateData, encrypted);
    } else {
      // Non-encrypted fields
      if (body.first_name !== undefined) updateData.firstName = body.first_name;
      if (body.last_name !== undefined) updateData.lastName = body.last_name;
      if (body.phone !== undefined) updateData.phone = body.phone;
    }

    if (body.email !== undefined) updateData.email = body.email;
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
