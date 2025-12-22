import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { disputes, clients, negativeItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { generateUniqueDisputeLetter } from '@/lib/ai-letter-generator';
import { rateLimited } from '@/lib/rate-limit-middleware';
import { sensitiveLimiter } from '@/lib/rate-limit';
import { encryptDisputeData, decryptDisputeData, decryptClientData } from '@/lib/db-encryption';

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
    } = body;

    if (!clientId || !bureau || !disputeReason) {
      return NextResponse.json(
        { error: 'Client ID, bureau, and dispute reason are required' },
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
        : [disputeReason.includes('not mine') ? 'not_mine' : 
           disputeReason.includes('never late') ? 'never_late' : 
           disputeReason.includes('wrong') ? 'wrong_balance' : 'not_mine'],
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
    const computedResponseDeadline = sentDate
      ? responseDeadline
        ? new Date(responseDeadline)
        : (() => {
            const d = new Date(sentDate);
            d.setDate(d.getDate() + 30);
            return d;
          })()
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
      responseChannel: responseChannel || null,
      scoreImpact: scoreImpact ?? null,
      reasonCodes: reasonCodes ? JSON.stringify(reasonCodes) : null,
      escalationPath: escalationPath || targetRecipient || 'bureau',
      creditorName: creditorNameValue,
      accountNumber: negativeItem?.id?.slice(-8) || null,
      analysisConfidence: normalizedConfidence,
      autoSelected: !!autoSelected,
      createdAt: now,
      updatedAt: now,
    });
    
    console.log(`[AUDIT] Dispute ${id} created by admin ${adminUser.email} for client ${clientId}`);

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

    const results = await query;

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
        // Decrypt client name
        const decryptedClient = c ? decryptClientData({
          firstName: c.firstName,
          lastName: c.lastName,
          phone: undefined,
          streetAddress: undefined,
          city: undefined,
          state: undefined,
          zipCode: undefined,
          dateOfBirth: undefined,
          ssnLast4: undefined,
        }) : null;

        // Decrypt dispute creditor name
        const decryptedDispute = decryptDisputeData({
          creditorName: d.creditorName,
        });

        return {
          id: d.id,
          client_id: d.clientId,
          client_name: decryptedClient ? `${decryptedClient.firstName} ${decryptedClient.lastName}` : 'Unknown',
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
          response_document_url: d.responseDocumentUrl,
          response_channel: d.responseChannel,
          score_impact: d.scoreImpact,
          reason_codes: d.reasonCodes,
          analysis_confidence: d.analysisConfidence,
          auto_selected: d.autoSelected,
          creditor_name: decryptedDispute.creditorName,
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
