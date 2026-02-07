import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { disputes, clients, negativeItems, slaDefinitions, slaInstances } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { generateUniqueDisputeLetter } from '@/lib/ai-letter-generator';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { sensitiveLimiter } from '@/lib/rate-limit';
import { decryptDisputeData, decryptClientData } from '@/lib/db-encryption';
import { getAdminSessionUser } from '@/lib/admin-session';
import { evaluateDisputeCompliance } from '@/lib/dispute-compliance-policy';
import {
  calculateDisputeDeadlines,
  getDisputeSlaDefinitionId,
  getDisputeSlaInstanceId,
} from '@/lib/dispute-automation';

async function validateAdmin() {
  return getAdminSessionUser('super_admin');
}

function isMissingColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code || (error as { cause?: { code?: string } })?.cause?.code;
  const message = (error as { message?: string })?.message || '';
  return code === '42703' || message.includes('does not exist');
}

function safeDecryptClientName(client: { firstName: string; lastName: string } | null): string {
  if (!client) return 'Unknown';
  try {
    const decryptedClient = decryptClientData({
      firstName: client.firstName,
      lastName: client.lastName,
      phone: undefined,
      streetAddress: undefined,
      city: undefined,
      state: undefined,
      zipCode: undefined,
      dateOfBirth: undefined,
      ssnLast4: undefined,
    });
    return `${decryptedClient.firstName} ${decryptedClient.lastName}`;
  } catch (error) {
    // Keep endpoint functional when ENCRYPTION_KEY is not configured in local/dev.
    console.error('[Disputes API] Failed to decrypt client name:', error);
    return 'Unknown';
  }
}

function safeDecryptCreditorName(creditorName: string | null): string | null {
  try {
    const decryptedDispute = decryptDisputeData({ creditorName });
    return decryptedDispute.creditorName;
  } catch (error) {
    console.error('[Disputes API] Failed to decrypt creditor name:', error);
    return null;
  }
}

async function postHandler(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      clientId, 
      negativeItemId, 
      bureau, 
      disputeReason, 
      disputeType,
      methodology,
      evidenceDocumentIds,
      fcraSections,
      disputedFields,
      status,
      round,
      letterContent,
      trackingNumber,
      sentAt,
      responseDeadline,
      responseChannel,
      scoreImpact,
      reasonCodes,
      escalationPath,
      targetRecipient,
      analysisConfidence,
      autoSelected,
      clientConfirmedOwnershipClaims,
    } = body;

    if (!clientId || !bureau || !disputeReason) {
      return NextResponse.json(
        { error: 'Client ID, bureau, and dispute reason are required' },
        { status: 400 }
      );
    }

    const normalizedReasonCodes = Array.isArray(reasonCodes)
      ? reasonCodes
      : [disputeReason.includes('not mine') ? 'not_mine' : disputeReason.includes('never late') ? 'never_late' : disputeReason.includes('wrong') ? 'wrong_balance' : 'verification_required'];

    const compliance = evaluateDisputeCompliance({
      reasonCodes: normalizedReasonCodes,
      evidenceDocumentIds,
      clientConfirmedOwnershipClaims,
    });

    if (!compliance.isCompliant) {
      return NextResponse.json(
        { error: 'Dispute failed compliance checks', violations: compliance.violations },
        { status: 400 }
      );
    }

    // Get client info
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get negative item info if provided
    let negativeItem = null;
    if (negativeItemId) {
      const [item] = await db
        .select()
        .from(negativeItems)
        .where(eq(negativeItems.id, negativeItemId))
        .limit(1);
      negativeItem = item;
    }

    // Generate dispute letter using AI generator with FCRA/CRSA/Metro2 compliance (unless caller provided content)
    const generatedLetterContent = letterContent || await generateUniqueDisputeLetter({
      disputeType: disputeType || 'standard',
      round: round || 1,
      targetRecipient: targetRecipient || 'bureau',
      clientData: {
        name: `${client.firstName} ${client.lastName}`,
      },
      itemData: {
        creditorName: negativeItem?.creditorName || 'Unknown Creditor',
        originalCreditor: negativeItem?.originalCreditor || undefined,
        accountNumber: negativeItem?.id?.slice(-8) || undefined,
        itemType: negativeItem?.itemType || 'unknown',
        amount: negativeItem?.amount || undefined,
        dateReported: negativeItem?.dateReported?.toISOString() || undefined,
        bureau,
      },
      reasonCodes: Array.isArray(reasonCodes) && reasonCodes.length > 0
        ? reasonCodes
        : normalizedReasonCodes,
      customReason: disputeReason,
    });

    const normalizedConfidence = analysisConfidence !== undefined && analysisConfidence !== null
      ? Math.round(analysisConfidence)
      : null;

    // Create dispute record with admin audit trail
    const id = randomUUID();
    const now = new Date();
    
    // Build escalation history with admin info for audit trail
    const initialHistory = JSON.stringify([{
      action: 'created',
      timestamp: now.toISOString(),
      adminId: adminUser.id,
      adminEmail: adminUser.email,
    }]);

    const sentDate = sentAt ? new Date(sentAt) : null;
    const computedDeadlines = sentDate ? calculateDisputeDeadlines(sentDate, escalationPath || targetRecipient) : null;
    const computedResponseDeadline = sentDate
      ? responseDeadline
        ? new Date(responseDeadline)
        : computedDeadlines?.responseDeadline || null
      : null;

    // Encrypt creditor name (already encrypted if from negativeItem, so use as-is)
    const creditorNameValue = negativeItem?.creditorName || null;

    await db.insert(disputes).values({
      id,
      clientId,
      negativeItemId: negativeItemId || null,
      bureau,
      disputeReason,
      disputeType: disputeType || 'standard',
      status: status || 'draft',
      round: round || 1,
      letterContent: generatedLetterContent,
      methodology: methodology || null,
      fcraSections: fcraSections ? JSON.stringify(fcraSections) : null,
      disputedFields: disputedFields ? JSON.stringify(disputedFields) : null,
      evidenceDocumentIds: evidenceDocumentIds ? JSON.stringify(evidenceDocumentIds) : null,
      escalationHistory: initialHistory,
      trackingNumber: trackingNumber || null,
      sentAt: sentDate,
      responseDeadline: computedResponseDeadline,
      escalationReadyAt: computedDeadlines?.escalationReadyAt || null,
      responseChannel: responseChannel || null,
      scoreImpact: scoreImpact ?? null,
      reasonCodes: JSON.stringify(normalizedReasonCodes),
      escalationPath: escalationPath || targetRecipient || 'bureau',
      creditorName: creditorNameValue,
      accountNumber: negativeItem?.id?.slice(-8) || null,
      analysisConfidence: normalizedConfidence,
      autoSelected: !!autoSelected,
      createdAt: now,
      updatedAt: now,
    });
    
    console.log(`[AUDIT] Dispute ${id} created by admin ${adminUser.email} for client ${clientId}`);

    if (sentDate && computedResponseDeadline) {
      const definitionId = getDisputeSlaDefinitionId();
      const slaInstanceId = getDisputeSlaInstanceId(id);
      await db
        .insert(slaDefinitions)
        .values({
          id: definitionId,
          name: 'Dispute Response Window',
          description: 'Tracks 30-day bureau response SLA for sent disputes.',
          stage: 'round_in_progress',
          maxDays: 30,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();

      await db
        .insert(slaInstances)
        .values({
          id: slaInstanceId,
          clientId,
          definitionId,
          stage: 'round_in_progress',
          startedAt: sentDate,
          dueAt: computedResponseDeadline,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: slaInstances.id,
          set: {
            dueAt: computedResponseDeadline,
            status: 'active',
            completedAt: null,
            breachNotifiedAt: null,
            updatedAt: now,
          },
        });
    }

    // Fetch the created dispute
    const [createdDispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, id))
      .limit(1);

    return NextResponse.json({
      id: createdDispute.id,
      client_id: createdDispute.clientId,
      negative_item_id: createdDispute.negativeItemId,
      bureau: createdDispute.bureau,
      dispute_reason: createdDispute.disputeReason,
      dispute_type: createdDispute.disputeType,
      status: createdDispute.status,
      round: createdDispute.round,
      letter_content: createdDispute.letterContent,
      tracking_number: createdDispute.trackingNumber,
      sent_at: createdDispute.sentAt?.toISOString(),
      response_deadline: createdDispute.responseDeadline?.toISOString(),
      reason_codes: createdDispute.reasonCodes,
      analysis_confidence: createdDispute.analysisConfidence,
      auto_selected: createdDispute.autoSelected,
      created_at: createdDispute.createdAt?.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating dispute:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create dispute' },
      { status: 500 }
    );
  }
}

async function getHandler(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id');
  const status = searchParams.get('status');
  const bureau = searchParams.get('bureau');
  const round = searchParams.get('round');
  const outcome = searchParams.get('outcome');
   const methodology = searchParams.get('methodology');
  const awaitingResponse = searchParams.get('awaiting_response');
  const overdue = searchParams.get('overdue');

  try {
    // Build query with optional filters
    let query = db
      .select({
        dispute: disputes,
        client: clients,
      })
      .from(disputes)
      .leftJoin(clients, eq(disputes.clientId, clients.id));

    const conditions = [];

    if (clientId) {
      conditions.push(eq(disputes.clientId, clientId));
    }

    if (status) {
      conditions.push(eq(disputes.status, status));
    }

    if (bureau) {
      conditions.push(eq(disputes.bureau, bureau));
    }

    if (round) {
      conditions.push(eq(disputes.round, parseInt(round)));
    }

    if (outcome) {
      conditions.push(eq(disputes.outcome, outcome));
    }

    if (methodology) {
      conditions.push(eq(disputes.methodology, methodology));
    }

    // Filter for disputes awaiting response (sent but no response yet)
    if (awaitingResponse === 'true') {
      conditions.push(eq(disputes.status, 'sent'));
    }

    // Apply conditions if any
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    let results: Array<{
      dispute: {
        id: string;
        clientId: string;
        negativeItemId: string | null;
        bureau: string;
        disputeReason: string;
        disputeType: string | null;
        status: string | null;
        round: number | null;
        letterContent: string | null;
        trackingNumber: string | null;
        sentAt: Date | null;
        responseDeadline: Date | null;
        responseReceivedAt: Date | null;
        outcome: string | null;
        responseNotes: string | null;
        creditorName: string | null;
        accountNumber: string | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        responseDocumentUrl?: string | null;
        responseChannel?: string | null;
        scoreImpact?: number | null;
        reasonCodes?: string | null;
        analysisConfidence?: number | null;
        autoSelected?: boolean | null;
      };
      client: {
        firstName: string;
        lastName: string;
      } | null;
    }>;

    try {
      results = await query;
    } catch (queryError) {
      if (!isMissingColumnError(queryError)) {
        throw queryError;
      }

      // Backward compatibility for environments missing recent disputes columns.
      let fallbackQuery = db
        .select({
          dispute: {
            id: disputes.id,
            clientId: disputes.clientId,
            negativeItemId: disputes.negativeItemId,
            bureau: disputes.bureau,
            disputeReason: disputes.disputeReason,
            disputeType: disputes.disputeType,
            status: disputes.status,
            round: disputes.round,
            letterContent: disputes.letterContent,
            trackingNumber: disputes.trackingNumber,
            sentAt: disputes.sentAt,
            responseDeadline: disputes.responseDeadline,
            responseReceivedAt: disputes.responseReceivedAt,
            outcome: disputes.outcome,
            responseNotes: disputes.responseNotes,
            creditorName: disputes.creditorName,
            accountNumber: disputes.accountNumber,
            createdAt: disputes.createdAt,
            updatedAt: disputes.updatedAt,
          },
          client: {
            firstName: clients.firstName,
            lastName: clients.lastName,
          },
        })
        .from(disputes)
        .leftJoin(clients, eq(disputes.clientId, clients.id));

      const fallbackConditions = [];
      if (clientId) fallbackConditions.push(eq(disputes.clientId, clientId));
      if (status) fallbackConditions.push(eq(disputes.status, status));
      if (bureau) fallbackConditions.push(eq(disputes.bureau, bureau));
      if (round) fallbackConditions.push(eq(disputes.round, parseInt(round)));
      if (outcome) fallbackConditions.push(eq(disputes.outcome, outcome));
      if (awaitingResponse === 'true') fallbackConditions.push(eq(disputes.status, 'sent'));

      if (fallbackConditions.length > 0) {
        fallbackQuery = fallbackQuery.where(and(...fallbackConditions)) as typeof fallbackQuery;
      }

      results = await fallbackQuery;
    }

    // Filter overdue in JS (deadline passed, no response)
    let filteredResults = results;
    if (overdue === 'true') {
      const now = new Date();
      filteredResults = results.filter(r => {
        const deadline = r.dispute.responseDeadline;
        return deadline && deadline < now && !r.dispute.responseReceivedAt;
      });
    }

    // Sort by response deadline (urgent first), then by created date
    filteredResults.sort((a, b) => {
      // Prioritize items with deadlines
      if (a.dispute.responseDeadline && !b.dispute.responseDeadline) return -1;
      if (!a.dispute.responseDeadline && b.dispute.responseDeadline) return 1;
      
      // Sort by deadline if both have one
      if (a.dispute.responseDeadline && b.dispute.responseDeadline) {
        return a.dispute.responseDeadline.getTime() - b.dispute.responseDeadline.getTime();
      }
      
      // Fall back to created date
      return (b.dispute.createdAt?.getTime() || 0) - (a.dispute.createdAt?.getTime() || 0);
    });

    return NextResponse.json({
      disputes: filteredResults.map(({ dispute: d, client: c }) => {
        return {
          id: d.id,
          client_id: d.clientId,
          client_name: safeDecryptClientName(c),
          negative_item_id: d.negativeItemId,
          bureau: d.bureau,
          dispute_reason: d.disputeReason,
          dispute_type: d.disputeType,
          status: d.status,
          round: d.round,
          letter_content: d.letterContent,
          tracking_number: d.trackingNumber,
          sent_at: d.sentAt?.toISOString(),
          response_deadline: d.responseDeadline?.toISOString(),
          response_received_at: d.responseReceivedAt?.toISOString(),
          outcome: d.outcome,
          response_notes: d.responseNotes,
          response_document_url: d.responseDocumentUrl || null,
          response_channel: d.responseChannel || null,
          score_impact: d.scoreImpact ?? null,
          reason_codes: d.reasonCodes || null,
          analysis_confidence: d.analysisConfidence ?? null,
          auto_selected: d.autoSelected ?? null,
          creditor_name: safeDecryptCreditorName(d.creditorName),
          account_number: d.accountNumber,
          created_at: d.createdAt?.toISOString(),
          updated_at: d.updatedAt?.toISOString(),
        };
      }),
      total: filteredResults.length,
    });
  } catch (error) {
    console.error('Error fetching disputes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch disputes' },
      { status: 500 }
    );
  }
}

// Export rate-limited handlers
export const POST = rateLimited(sensitiveLimiter)(postHandler);
export const GET = rateLimited(sensitiveLimiter)(getHandler);
