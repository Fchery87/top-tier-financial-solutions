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
import { buildEscalationPlan } from '@/lib/dispute-automation';

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

    if (currentDispute.outcome !== 'verified') {
      return NextResponse.json({ error: 'Quick re-dispute is only available for verified items' }, { status: 400 });
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

    const nextRound = (currentDispute.round || 1) + 1;
    const targetRecipient = nextRound >= 4 ? 'cfpb' : nextRound === 2 ? 'bureau' : 'creditor';
    const nextDisputeType = nextRound >= 4 ? 'fcra_violation_notice' : nextRound === 2 ? 'method_of_verification' : 'direct_creditor';
    const methodology = nextRound === 2 ? 'method_of_verification' : 'factual';
    const reasonCodes = nextRound >= 4
      ? ['repeat_verification', 'fcra_non_compliance']
      : nextRound === 2
      ? ['previously_disputed', 'request_verification_method']
      : ['verification_required', 'metro2_violation'];

    if (targetRecipient === 'cfpb') {
      const decision = decideEscalation({
        plan: buildEscalationPlan({ currentRound: currentDispute.round || 1, trigger: 'verified', currentBureau: currentDispute.bureau }),
        history: await loadDisputeChain(currentDispute.id),
      });
      if (decision.kind === 'blocked') {
        return NextResponse.json({ error: decision.message, reason: decision.eligibility.reason, eligible_at: decision.eligibility.eligibleAt?.toISOString() || null }, { status: 409 });
      }
    }
    const librarySelection = await selectLibraryForGeneration({
      round: nextRound,
      targetRecipient,
      bureau: currentDispute.bureau,
      itemType: negativeItem.itemType,
      reasonCodes,
      methodology,
    });

    const letterContent = await generateUniqueDisputeLetter({
      disputeType: nextDisputeType,
      round: nextRound,
      targetRecipient,
      methodology,
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
      reasonCodes,
      customReason: `Escalation after verification in Round ${currentDispute.round || 1}`,
      librarySelection,
    });

    const persistedDraft = await persistGeneratedDisputeDraft({
      clientId: currentDispute.clientId,
      negativeItemId: currentDispute.negativeItemId,
      bureau: currentDispute.bureau,
      disputeReason: `Escalation after verification in Round ${currentDispute.round || 1}`,
      disputeType: nextDisputeType,
      round: nextRound,
      escalationPath: targetRecipient,
      letterContent,
      creditorName: negativeItem.creditorName,
      accountNumber: negativeItem.creditAccountId ? null : negativeItem.id.slice(-4),
      methodology,
      reasonCodes,
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
    console.error('Error creating quick re-dispute:', error);
    return NextResponse.json({ error: 'Failed to create quick re-dispute' }, { status: 500 });
  }
}
