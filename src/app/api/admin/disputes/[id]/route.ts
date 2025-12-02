import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { disputes, negativeItems, clients } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { generateUniqueDisputeLetter } from '@/lib/ai-letter-generator';

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

// GET single dispute
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
    const [dispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, id))
      .limit(1);

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    // Get client info
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, dispute.clientId))
      .limit(1);

    // Get negative item info if exists
    let negativeItem = null;
    if (dispute.negativeItemId) {
      const [item] = await db
        .select()
        .from(negativeItems)
        .where(eq(negativeItems.id, dispute.negativeItemId))
        .limit(1);
      negativeItem = item;
    }

    return NextResponse.json({
      dispute: {
        id: dispute.id,
        client_id: dispute.clientId,
        client_name: client ? `${client.firstName} ${client.lastName}` : 'Unknown',
        negative_item_id: dispute.negativeItemId,
        bureau: dispute.bureau,
        dispute_reason: dispute.disputeReason,
        dispute_type: dispute.disputeType,
        status: dispute.status,
        round: dispute.round,
        letter_content: dispute.letterContent,
        tracking_number: dispute.trackingNumber,
        sent_at: dispute.sentAt?.toISOString(),
        response_deadline: dispute.responseDeadline?.toISOString(),
        response_received_at: dispute.responseReceivedAt?.toISOString(),
        outcome: dispute.outcome,
        response_notes: dispute.responseNotes,
        response_document_url: dispute.responseDocumentUrl,
        escalation_reason: dispute.escalationReason,
        creditor_name: dispute.creditorName || negativeItem?.creditorName,
        account_number: dispute.accountNumber,
        created_at: dispute.createdAt?.toISOString(),
        updated_at: dispute.updatedAt?.toISOString(),
      },
      negative_item: negativeItem ? {
        id: negativeItem.id,
        item_type: negativeItem.itemType,
        creditor_name: negativeItem.creditorName,
        original_creditor: negativeItem.originalCreditor,
        amount: negativeItem.amount,
        bureau: negativeItem.bureau,
        risk_severity: negativeItem.riskSeverity,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching dispute:', error);
    return NextResponse.json({ error: 'Failed to fetch dispute' }, { status: 500 });
  }
}

// UPDATE dispute (status, response logging, outcome)
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
    const {
      status,
      outcome,
      responseNotes,
      responseDocumentUrl,
      trackingNumber,
      sentAt,
      responseReceivedAt,
      escalationReason,
      createNextRound,
    } = body;

    // Get current dispute
    const [currentDispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, id))
      .limit(1);

    if (!currentDispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (status !== undefined) {
      updateData.status = status;
    }

    if (outcome !== undefined) {
      updateData.outcome = outcome;
    }

    if (responseNotes !== undefined) {
      updateData.responseNotes = responseNotes;
    }

    if (responseDocumentUrl !== undefined) {
      updateData.responseDocumentUrl = responseDocumentUrl;
    }

    if (trackingNumber !== undefined) {
      updateData.trackingNumber = trackingNumber;
    }

    if (sentAt !== undefined) {
      updateData.sentAt = sentAt ? new Date(sentAt) : null;
      // Set response deadline to 30 days after sent date (FCRA requirement)
      if (sentAt) {
        const deadline = new Date(sentAt);
        deadline.setDate(deadline.getDate() + 30);
        updateData.responseDeadline = deadline;
      }
    }

    if (responseReceivedAt !== undefined) {
      updateData.responseReceivedAt = responseReceivedAt ? new Date(responseReceivedAt) : null;
    }

    if (escalationReason !== undefined) {
      updateData.escalationReason = escalationReason;
    }

    // Update dispute
    await db
      .update(disputes)
      .set(updateData)
      .where(eq(disputes.id, id));

    // Auto-escalation: Create Round 2 dispute if item was verified
    let nextRoundDispute = null;
    if (createNextRound && outcome === 'verified' && currentDispute.negativeItemId) {
      // Get client and negative item for next round letter generation
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, currentDispute.clientId))
        .limit(1);

      const [negativeItem] = await db
        .select()
        .from(negativeItems)
        .where(eq(negativeItems.id, currentDispute.negativeItemId))
        .limit(1);

      if (client && negativeItem) {
        const nextRound = (currentDispute.round || 1) + 1;
        const nextDisputeType = nextRound === 2 ? 'method_of_verification' : 'direct_creditor';
        const nextTarget = nextRound === 2 ? 'bureau' : 'creditor';

        // Generate escalation letter
        const letterContent = await generateUniqueDisputeLetter({
          disputeType: nextDisputeType,
          round: nextRound,
          targetRecipient: nextTarget,
          clientData: {
            name: `${client.firstName} ${client.lastName}`,
          },
          itemData: {
            creditorName: negativeItem.creditorName,
            originalCreditor: negativeItem.originalCreditor || undefined,
            accountNumber: negativeItem.id.slice(-8),
            itemType: negativeItem.itemType,
            amount: negativeItem.amount || undefined,
            dateReported: negativeItem.dateReported?.toISOString(),
            bureau: currentDispute.bureau,
          },
          reasonCodes: ['previously_disputed', 'request_verification_method'],
          customReason: escalationReason || `Item was verified in Round ${currentDispute.round}. Requesting method of verification.`,
        });

        const nextId = randomUUID();
        const now = new Date();

        await db.insert(disputes).values({
          id: nextId,
          clientId: currentDispute.clientId,
          negativeItemId: currentDispute.negativeItemId,
          bureau: currentDispute.bureau,
          disputeReason: `Escalation from Round ${currentDispute.round} - ${escalationReason || 'Item verified, requesting method of verification'}`,
          disputeType: nextDisputeType,
          status: 'draft',
          round: nextRound,
          escalationPath: nextTarget,
          letterContent,
          creditorName: negativeItem.creditorName,
          accountNumber: negativeItem.id.slice(-8),
          generatedByAi: true,
          createdAt: now,
          updatedAt: now,
        });

        // Fetch created dispute
        const [created] = await db
          .select()
          .from(disputes)
          .where(eq(disputes.id, nextId))
          .limit(1);

        nextRoundDispute = {
          id: created.id,
          round: created.round,
          dispute_type: created.disputeType,
          status: created.status,
        };
      }
    }

    // Fetch updated dispute
    const [updatedDispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, id))
      .limit(1);

    return NextResponse.json({
      dispute: {
        id: updatedDispute.id,
        status: updatedDispute.status,
        outcome: updatedDispute.outcome,
        response_notes: updatedDispute.responseNotes,
        tracking_number: updatedDispute.trackingNumber,
        sent_at: updatedDispute.sentAt?.toISOString(),
        response_deadline: updatedDispute.responseDeadline?.toISOString(),
        response_received_at: updatedDispute.responseReceivedAt?.toISOString(),
        updated_at: updatedDispute.updatedAt?.toISOString(),
      },
      next_round_dispute: nextRoundDispute,
      message: nextRoundDispute 
        ? `Dispute updated and Round ${nextRoundDispute.round} created`
        : 'Dispute updated successfully',
    });
  } catch (error) {
    console.error('Error updating dispute:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update dispute' },
      { status: 500 }
    );
  }
}

// DELETE dispute
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
    const [dispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, id))
      .limit(1);

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    await db.delete(disputes).where(eq(disputes.id, id));

    return NextResponse.json({ success: true, message: 'Dispute deleted' });
  } catch (error) {
    console.error('Error deleting dispute:', error);
    return NextResponse.json({ error: 'Failed to delete dispute' }, { status: 500 });
  }
}
