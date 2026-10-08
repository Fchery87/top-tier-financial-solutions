import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';
import { db } from '@/db/client';
import { clientDocuments, clients, disputes, negativeItems, disputeOutcomes, slaDefinitions, slaInstances } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { recordLibraryOutcome } from '@/lib/letter-library-effectiveness';
import { saveDisputeLetter } from '@/lib/dispute-letter-workflow';
import { triggerAutomation } from '@/lib/email-service';
import {
  calculateDisputeDeadlines,
  getDisputeSlaDefinitionId,
  getDisputeSlaInstanceId,
} from '@/lib/dispute-automation';
import {
  getResponseReviewRecommendation,
  type ResponseReviewOutcome,
} from '@/lib/response-review-recommendation';
import { isClientOwnedEvidenceDocument } from '@/lib/evidence-documents';
import { findAwaitingClientConfirmation } from '@/lib/dispute-evidence';

const STRUCTURED_RESPONSE_OUTCOMES: ReadonlySet<string> = new Set([
  'deleted',
  'updated',
  'verified',
  'no_response',
  'frivolous',
]);

function isResponseReviewOutcome(value: unknown): value is ResponseReviewOutcome {
  return typeof value === 'string' && STRUCTURED_RESPONSE_OUTCOMES.has(value);
}

// GET single dispute
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireCapability('disputes:read');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
        response_document_id: dispute.responseDocumentId,
        response_document_url: dispute.responseDocumentUrl,
        response_channel: dispute.responseChannel,
        score_impact: dispute.scoreImpact,
        reason_codes: dispute.reasonCodes,
        analysis_confidence: dispute.analysisConfidence,
        auto_selected: dispute.autoSelected,
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
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      status,
      outcome,
      responseNotes,
      responseDocumentId,
      responseDocumentUrl,
      responseChannel,
      submissionMethod,
      submissionRecipient,
      submissionProofDocumentUrl,
      submissionDate,
      trackingNumber,
      sentAt,
      responseReceivedAt,
      escalationReason,
      createNextRound,
      scoreImpact,
      reasonCodes,
      analysisConfidence,
      autoSelected,
      responseType,
      letterContent,
      acknowledgeWarnings,
      expectedRevision,
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

    if (createNextRound === true) {
      return NextResponse.json({
        error: 'Response review cannot create a next-cycle draft automatically',
      }, { status: 400 });
    }

    let negativeItem: typeof negativeItems.$inferSelect | null = null;
    if (currentDispute.negativeItemId) {
      const [item] = await db
        .select()
        .from(negativeItems)
        .where(eq(negativeItems.id, currentDispute.negativeItemId))
        .limit(1);
      negativeItem = item || null;
    }

    if (letterContent !== undefined) {
      if (typeof letterContent !== 'string') {
        return NextResponse.json({ error: 'letterContent must be a string' }, { status: 400 });
      }
      const letterResult = await saveDisputeLetter({
        disputeId: id,
        content: letterContent,
        source: 'manual',
        actorUserId: adminUser.id,
        acknowledgeWarnings: acknowledgeWarnings === true,
        expectedRevision: typeof expectedRevision === 'number' ? expectedRevision : undefined,
      });
      if (letterResult.kind === 'immutable') return NextResponse.json({ error: 'This letter is immutable' }, { status: 409 });
      if (letterResult.kind === 'conflict') return NextResponse.json({ error: 'conflict', ...letterResult }, { status: 409 });
      if (letterResult.kind === 'blocked') return NextResponse.json({ error: 'This letter references data that is not in the client file.', ...letterResult }, { status: 422 });
      if (letterResult.kind === 'warnings') return NextResponse.json({ error: 'needs_acknowledgement', ...letterResult }, { status: 409 });
    }

    const markingSent = status === 'sent' || (sentAt !== undefined && sentAt !== null);
    if (markingSent) {
      const awaitingConfirmation = await findAwaitingClientConfirmation(id);
      if (awaitingConfirmation) {
        return NextResponse.json({ error: 'High-risk evidence packet is awaiting client confirmation' }, { status: 409 });
      }
    }

    const isMarkingSubmitted = status === 'sent' || status === 'submitted' || sentAt !== undefined;
    const hasSubmissionTracking = Boolean(submissionMethod && submissionRecipient && (submissionDate || sentAt));
    if (isMarkingSubmitted && !hasSubmissionTracking) {
      return NextResponse.json({ error: 'Submission tracking is required before marking a dispute submitted' }, { status: 400 });
    }

    if (outcome !== undefined && !isResponseReviewOutcome(outcome)) {
      return NextResponse.json({ error: 'Outcome must use structured response review vocabulary' }, { status: 400 });
    }

    if (responseReceivedAt !== undefined && outcome === undefined) {
      return NextResponse.json({ error: 'Response Review requires a response document and outcome classification' }, { status: 400 });
    }

    let selectedResponseDocument: {
      id: string;
      userId: string;
      fileUrl: string;
    } | null = null;

    if (outcome !== undefined) {
      if (outcome === 'no_response') {
        const deadline = currentDispute.responseDeadline;
        if (!deadline || deadline > new Date()) {
          return NextResponse.json({ error: 'No response can be recorded only after the response deadline has elapsed' }, { status: 400 });
        }
        if (responseReceivedAt || responseDocumentId || responseDocumentUrl) {
          return NextResponse.json({
            error: 'No response reviews cannot include response evidence or a receipt date',
          }, { status: 400 });
        }
      } else {
        const requestedResponseDocumentId = typeof responseDocumentId === 'string'
          ? responseDocumentId.trim()
          : '';
        if (!responseReceivedAt) {
          return NextResponse.json({
            error: 'Response Review requires a response date and response document for this outcome',
          }, { status: 400 });
        }
        if (!requestedResponseDocumentId) {
          return NextResponse.json({
            error: 'Response Review requires a controlled response document for this outcome',
          }, { status: 400 });
        }

        const [client] = await db
          .select({ userId: clients.userId })
          .from(clients)
          .where(eq(clients.id, currentDispute.clientId))
          .limit(1);
        const [document] = await db
          .select({
            id: clientDocuments.id,
            userId: clientDocuments.userId,
            fileUrl: clientDocuments.fileUrl,
          })
          .from(clientDocuments)
          .where(eq(clientDocuments.id, requestedResponseDocumentId))
          .limit(1);

        if (!document || !isClientOwnedEvidenceDocument({
          clientUserId: client?.userId ?? null,
          document,
        })) {
          return NextResponse.json({
            error: 'Response document must belong to the dispute client',
          }, { status: 400 });
        }

        selectedResponseDocument = document;
      }
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

    if (selectedResponseDocument) {
      updateData.responseDocumentId = selectedResponseDocument.id;
      updateData.responseDocumentUrl = selectedResponseDocument.fileUrl;
    }

    if (responseChannel !== undefined) {
      updateData.responseChannel = responseChannel;
    }

    if (submissionMethod !== undefined) {
      updateData.submissionMethod = submissionMethod;
      if (submissionMethod === 'certified_mail' && responseChannel === undefined) {
        updateData.responseChannel = 'mail';
      }
    }

    if (submissionRecipient !== undefined) {
      updateData.submissionRecipient = submissionRecipient;
    }

    if (submissionProofDocumentUrl !== undefined) {
      updateData.submissionProofDocumentUrl = submissionProofDocumentUrl;
    }

    if (scoreImpact !== undefined) {
      updateData.scoreImpact = scoreImpact;
    }

    if (reasonCodes !== undefined) {
      updateData.reasonCodes = Array.isArray(reasonCodes) ? JSON.stringify(reasonCodes) : reasonCodes;
    }

    if (analysisConfidence !== undefined) {
      updateData.analysisConfidence = Math.round(analysisConfidence);
    }

    if (autoSelected !== undefined) {
      updateData.autoSelected = !!autoSelected;
    }

    if (trackingNumber !== undefined) {
      updateData.trackingNumber = trackingNumber;
    }

    if (sentAt !== undefined) {
      updateData.sentAt = sentAt ? new Date(sentAt) : null;
      // Set response deadline and escalationReadyAt when marked as sent
      if (sentAt) {
        const sendDate = new Date(sentAt);
        const { responseDeadline, escalationReadyAt } = calculateDisputeDeadlines(
          sendDate,
          currentDispute.escalationPath
        );
        updateData.responseDeadline = responseDeadline;
        updateData.escalationReadyAt = escalationReadyAt;
      }
    }

    if (responseReceivedAt !== undefined) {
      updateData.responseReceivedAt = responseReceivedAt ? new Date(responseReceivedAt) : null;
    }

    if (escalationReason !== undefined) {
      updateData.escalationReason = escalationReason;
    }

    // Add admin audit entry to escalation history
    const existingHistory = currentDispute.escalationHistory 
      ? JSON.parse(currentDispute.escalationHistory) 
      : [];
    existingHistory.push({
      action: status !== undefined ? `status_changed_to_${status}` : 'updated',
      timestamp: new Date().toISOString(),
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      changes: {
        ...(status !== undefined && { status }),
        ...(outcome !== undefined && { outcome }),
        ...(selectedResponseDocument && { responseDocumentId: selectedResponseDocument.id }),
        ...(sentAt !== undefined && { sentAt }),
        ...(responseChannel !== undefined && { responseChannel }),
        ...(scoreImpact !== undefined && { scoreImpact }),
      },
    });
    updateData.escalationHistory = JSON.stringify(existingHistory);
    
    // Update dispute
    await db
      .update(disputes)
      .set(updateData)
      .where(eq(disputes.id, id));

    console.log(`[AUDIT] Dispute ${id} updated by admin ${adminUser.email}`);

    if (sentAt !== undefined) {
      const slaDefinitionId = getDisputeSlaDefinitionId();
      const slaInstanceId = getDisputeSlaInstanceId(currentDispute.id);
      const now = new Date();

      await db
        .insert(slaDefinitions)
        .values({
          id: slaDefinitionId,
          name: 'Dispute Response Window',
          description: 'Tracks 30-day bureau response SLA for sent disputes.',
          stage: 'round_in_progress',
          maxDays: 30,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();

      if (sentAt) {
        await db
          .insert(slaInstances)
          .values({
            id: slaInstanceId,
            clientId: currentDispute.clientId,
            definitionId: slaDefinitionId,
            stage: 'round_in_progress',
            startedAt: new Date(sentAt),
            dueAt: (updateData.responseDeadline as Date) || null,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: slaInstances.id,
            set: {
              dueAt: (updateData.responseDeadline as Date) || null,
              status: 'active',
              completedAt: null,
              breachNotifiedAt: null,
              updatedAt: now,
            },
          });
      } else {
        await db
          .update(slaInstances)
          .set({
            status: 'completed',
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(slaInstances.id, slaInstanceId));
      }
    }

    if (responseReceivedAt && currentDispute.responseReceivedAt === null) {
      const now = new Date();
      await db
        .update(slaInstances)
        .set({
          status: 'completed',
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(slaInstances.id, getDisputeSlaInstanceId(currentDispute.id)));
    }

    if (outcome) {
      const outcomeId = randomUUID();
      const responseDateValue = responseReceivedAt ? new Date(responseReceivedAt) : new Date();

      await db.insert(disputeOutcomes).values({
        id: outcomeId,
        disputeId: currentDispute.id,
        clientId: currentDispute.clientId,
        bureau: currentDispute.bureau,
        round: currentDispute.round,
        outcome,
        responseType: responseType || status || currentDispute.status,
        responseChannel: responseChannel || currentDispute.responseChannel,
        responseDate: responseDateValue,
        scoreImpact: scoreImpact ?? currentDispute.scoreImpact ?? null,
        reasonCodes: Array.isArray(reasonCodes)
          ? JSON.stringify(reasonCodes)
          : reasonCodes ?? currentDispute.reasonCodes ?? null,
        methodology: currentDispute.methodology,
        disputeType: currentDispute.disputeType,
        itemType: negativeItem?.itemType || null,
        creditorName: currentDispute.creditorName || negativeItem?.creditorName || null,
        analysisConfidence: analysisConfidence !== undefined
          ? Math.round(analysisConfidence)
          : currentDispute.analysisConfidence ?? null,
        responseDocumentUrl: outcome === 'no_response'
          ? null
          : selectedResponseDocument?.fileUrl ?? currentDispute.responseDocumentUrl ?? null,
        notes: responseNotes ?? null,
        createdBy: adminUser.id,
        createdAt: new Date(),
      });

      await recordLibraryOutcome({
        libraryId: currentDispute.letterTemplateId,
        previousOutcome: currentDispute.outcome,
        nextOutcome: outcome,
      });
    }

    // Fetch updated dispute
    const [updatedDispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, id))
      .limit(1);

    // Trigger email automations based on status/outcome changes
    try {
      // Dispute marked as sent
      if (sentAt && currentDispute.sentAt === null) {
        const responseDeadlineDate = updatedDispute.responseDeadline 
          ? new Date(updatedDispute.responseDeadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : 'within 30 days';
        
        await triggerAutomation('dispute_sent', currentDispute.clientId, {
          dispute_count: 1,
          bureau_name: currentDispute.bureau.charAt(0).toUpperCase() + currentDispute.bureau.slice(1),
          creditor_name: updatedDispute.creditorName || 'the disputed item',
          dispute_round: updatedDispute.round || 1,
          response_deadline: responseDeadlineDate,
          dispute_id: id,
        });
      }

      // Response received
      if (responseReceivedAt && currentDispute.responseReceivedAt === null) {
        await triggerAutomation('response_received', currentDispute.clientId, {
          bureau_name: currentDispute.bureau.charAt(0).toUpperCase() + currentDispute.bureau.slice(1),
          creditor_name: updatedDispute.creditorName || 'the disputed item',
          dispute_round: updatedDispute.round || 1,
          dispute_id: id,
          outcome,
        });
      }

      // Item deleted - celebration email
      if (outcome === 'deleted' && currentDispute.outcome !== 'deleted') {
        await triggerAutomation('item_deleted', currentDispute.clientId, {
          creditor_name: updatedDispute.creditorName || 'Negative Item',
          bureau_name: currentDispute.bureau.charAt(0).toUpperCase() + currentDispute.bureau.slice(1),
          dispute_id: id,
        });
      }
    } catch (emailError) {
      // Log but don't fail the request if email fails
      console.error('Error sending automated email:', emailError);
    }

    return NextResponse.json({
      dispute: {
        id: updatedDispute.id,
        status: updatedDispute.status,
        outcome: updatedDispute.outcome,
        response_notes: updatedDispute.responseNotes,
        response_document_id: updatedDispute.responseDocumentId,
        response_document_url: updatedDispute.responseDocumentUrl,
        tracking_number: updatedDispute.trackingNumber,
        response_channel: updatedDispute.responseChannel,
        submission_method: updatedDispute.submissionMethod,
        submission_recipient: updatedDispute.submissionRecipient,
        submission_proof_document_url: updatedDispute.submissionProofDocumentUrl,
        score_impact: updatedDispute.scoreImpact,
        analysis_confidence: updatedDispute.analysisConfidence,
        auto_selected: updatedDispute.autoSelected,
        sent_at: updatedDispute.sentAt?.toISOString(),
        response_deadline: updatedDispute.responseDeadline?.toISOString(),
        response_received_at: updatedDispute.responseReceivedAt?.toISOString(),
        updated_at: updatedDispute.updatedAt?.toISOString(),
      },
      next_round_dispute: null,
      next_cycle_recommendation: outcome && isResponseReviewOutcome(outcome)
        ? getResponseReviewRecommendation({
          outcome,
          currentRound: currentDispute.round || 1,
          bureau: currentDispute.bureau,
        })
        : null,
      message: 'Dispute updated successfully',
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
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
