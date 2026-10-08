import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';
import { db } from '@/db/client';
import { disputes, negativeItems, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateUniqueDisputeLetter } from '@/lib/ai-letter-generator';
import { selectLibraryForGeneration } from '@/lib/letter-generation-library';
import { requireLatestApprovedReportForClient } from '@/lib/parser-review-gate';
import { persistGeneratedDisputeDraft } from '@/lib/dispute-draft-generator';
import { decideEscalation, loadDisputeChain } from '@/lib/dispute-escalation-decision';
import { findAwaitingClientConfirmation } from '@/lib/dispute-evidence';
import { getResponseReviewRecommendation } from '@/lib/response-review-recommendation';
import { logServerEvent } from '@/lib/server-logger';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const [currentDispute] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
    if (!currentDispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    if (currentDispute.outcome !== 'verified' && currentDispute.outcome !== 'no_response') {
      return NextResponse.json({ error: 'A verified or no-response review is required before creating a next-cycle draft' }, { status: 400 });
    }

    if (currentDispute.outcome === 'verified' && (!currentDispute.responseReceivedAt || !currentDispute.responseDocumentUrl)) {
      return NextResponse.json({ error: 'Verified escalation requires a completed response review with evidence' }, { status: 400 });
    }

    if (currentDispute.outcome === 'no_response') {
      if (!currentDispute.responseDeadline || currentDispute.responseDeadline > new Date()) {
        return NextResponse.json({
          error: 'No-response escalation is available only after the response deadline has elapsed',
        }, { status: 400 });
      }
    }

    const recommendation = getResponseReviewRecommendation({
      outcome: currentDispute.outcome,
      currentRound: currentDispute.round || 1,
      bureau: currentDispute.bureau,
    });
    if (recommendation.kind !== 'create_next_draft') {
      return NextResponse.json({ error: 'This response outcome does not recommend a next-cycle draft' }, { status: 400 });
    }
    const escalationPlan = recommendation.plan;

    const [existingChild] = await db
      .select({ id: disputes.id })
      .from(disputes)
      .where(eq(disputes.priorDisputeId, currentDispute.id))
      .limit(1);
    if (existingChild) {
      return NextResponse.json({ error: 'A next-cycle draft already exists for this response review' }, { status: 409 });
    }

    const [client] = await db.select().from(clients).where(eq(clients.id, currentDispute.clientId)).limit(1);
    const [negativeItem] = currentDispute.negativeItemId
      ? await db.select().from(negativeItems).where(eq(negativeItems.id, currentDispute.negativeItemId)).limit(1)
      : [];

    if (!client || !negativeItem) {
      return NextResponse.json({ error: 'Client or negative item missing for escalation' }, { status: 400 });
    }

    const reportGate = await requireLatestApprovedReportForClient(currentDispute.clientId);
    if (!reportGate.allowed) {
      return NextResponse.json(
        { error: reportGate.reason || 'The latest credit report must be approved before creating a re-dispute.' },
        { status: 409 }
      );
    }

    const awaitingConfirmation = await findAwaitingClientConfirmation(currentDispute.id);
    if (awaitingConfirmation) {
      return NextResponse.json({ error: 'High-risk evidence packet is awaiting client confirmation' }, { status: 409 });
    }

    if (escalationPlan.targetRecipient === 'cfpb') {
      const decision = decideEscalation({
        plan: escalationPlan,
        history: await loadDisputeChain(currentDispute.id),
      });
      if (decision.kind === 'blocked') {
        return NextResponse.json({ error: decision.message, reason: decision.eligibility.reason, eligible_at: decision.eligibility.eligibleAt?.toISOString() || null }, { status: 409 });
      }
    }
    const librarySelection = await selectLibraryForGeneration({
      round: escalationPlan.nextRound,
      targetRecipient: escalationPlan.targetRecipient,
      bureau: currentDispute.bureau,
      itemType: negativeItem.itemType,
      reasonCodes: escalationPlan.reasonCodes,
      methodology: escalationPlan.methodology,
    });

    const letterContent = await generateUniqueDisputeLetter({
      disputeType: escalationPlan.disputeType,
      round: escalationPlan.nextRound,
      targetRecipient: escalationPlan.targetRecipient,
      methodology: escalationPlan.methodology,
      clientData: { name: `${client.firstName} ${client.lastName}` },
      itemData: {
        creditorName: negativeItem.creditorName,
        originalCreditor: negativeItem.originalCreditor || undefined,
        accountNumber: negativeItem.creditAccountId ? undefined : negativeItem.id.slice(-4),
        itemType: negativeItem.itemType,
        amount: negativeItem.amount || undefined,
        dateReported: negativeItem.dateReported?.toISOString(),
        bureau: currentDispute.bureau,
      },
      reasonCodes: escalationPlan.reasonCodes,
      customReason: escalationPlan.customReason,
      librarySelection,
    });

    const persistedDraft = await persistGeneratedDisputeDraft({
      clientId: currentDispute.clientId,
      negativeItemId: currentDispute.negativeItemId,
      bureau: currentDispute.bureau,
      disputeReason: escalationPlan.customReason,
      disputeType: escalationPlan.disputeType,
      round: escalationPlan.nextRound,
      escalationPath: escalationPlan.targetRecipient,
      letterContent,
      creditorName: negativeItem.creditorName,
      accountNumber: negativeItem.creditAccountId ? null : negativeItem.id.slice(-4),
      methodology: escalationPlan.methodology,
      reasonCodes: escalationPlan.reasonCodes,
      priorDisputeId: currentDispute.id,
      analysisConfidence: currentDispute.analysisConfidence,
      autoSelected: currentDispute.autoSelected ?? false,
      items: [{
        kind: 'tradeline',
        bureau: currentDispute.bureau,
        creditorName: negativeItem.creditorName,
        originalCreditor: negativeItem.originalCreditor,
        accountNumber: negativeItem.creditAccountId ? null : negativeItem.id.slice(-4),
        itemType: negativeItem.itemType,
        amount: negativeItem.amount,
        dateReported: negativeItem.dateReported?.toISOString(),
      }],
      selection: librarySelection,
      actorUserId: adminUser.id,
    });

    const [created] = await db.select().from(disputes).where(eq(disputes.id, persistedDraft.disputeId)).limit(1);

    return NextResponse.json({
      message: 'Escalation dispute created',
      dispute: {
        id: created.id,
        round: created.round,
        dispute_type: created.disputeType,
        status: created.status,
      },
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.disputes.id.quick.redispute.error', error: error });
    return NextResponse.json({ error: 'Failed to create quick re-dispute' }, { status: 500 });
  }
}
