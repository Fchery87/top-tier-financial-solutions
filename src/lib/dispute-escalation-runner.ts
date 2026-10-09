import { randomUUID } from 'crypto';
import { and, eq, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { disputes, negativeItems, creditAccounts, slaInstances, tasks } from '@/db/schema';
import { generateUniqueDisputeLetter } from '@/lib/ai-letter-generator';
import { selectLibraryForGeneration } from '@/lib/letter-generation-library';
import { setSetting } from '@/lib/settings-service';
import { buildEscalationPlan, getDisputeSlaInstanceId, type EscalationPlan } from '@/lib/dispute-automation';
import { persistGeneratedDisputeDraft } from '@/lib/dispute-draft-generator';
import { decideDisputePolicy, hasStoredEvidencePacket } from '@/lib/dispute-policy-decision';
import { decideEscalation, loadDisputeChain } from '@/lib/dispute-escalation-decision';
import { tryLoadLetterConsumerIdentity, type LetterConsumerIdentity, type LetterIdentityField } from '@/lib/letter-consumer-identity';
import { logServerEvent } from '@/lib/server-logger';

export const ESCALATION_LAST_RUN_SETTING_KEY = 'automation.dispute_escalations.last_run';

export interface RunDisputeEscalationOptions {
  dryRun: boolean;
}

/** Why a candidate was skipped, when staff must act on it. */
export interface EscalationSkipReason {
  dispute_id: string;
  reason: 'letter_identity_incomplete';
  missing: LetterIdentityField[];
}

export interface RunDisputeEscalationResult {
  success: true;
  dry_run: boolean;
  checked: number;
  escalated: number;
  would_escalate: number;
  skipped: number;
  skip_reasons: EscalationSkipReason[];
  deferred: number;
  next_eligibility_at: string | null;
}

interface EscalationLetterParamsInput {
  consumer: LetterConsumerIdentity;
  dispute: Pick<typeof disputes.$inferSelect, 'bureau'>;
  negativeItem: Pick<
    typeof negativeItems.$inferSelect,
    'id' | 'creditorName' | 'originalCreditor' | 'itemType' | 'amount' | 'dateReported'
  >;
  creditAccount: Pick<typeof creditAccounts.$inferSelect, 'accountNumber'> | null;
  plan: EscalationPlan;
}

export function buildEscalationLetterParams(input: EscalationLetterParamsInput) {
  return {
    disputeType: input.plan.disputeType,
    round: input.plan.nextRound,
    targetRecipient: input.plan.targetRecipient,
    methodology: input.plan.methodology,
    clientData: input.consumer,
    itemData: {
      creditorName: input.negativeItem.creditorName,
      originalCreditor: input.negativeItem.originalCreditor || undefined,
      accountNumber: input.creditAccount?.accountNumber || undefined,
      itemType: input.negativeItem.itemType,
      amount: input.negativeItem.amount || undefined,
      dateReported: input.negativeItem.dateReported?.toISOString() || undefined,
      bureau: input.dispute.bureau,
    },
    reasonCodes: input.plan.reasonCodes,
    customReason: input.plan.customReason,
  };
}

function getTaskMarker(disputeId: string): string {
  return `[AUTO_ESCALATION:${disputeId}]`;
}

export async function runDisputeEscalationAutomation(
  options: RunDisputeEscalationOptions
): Promise<RunDisputeEscalationResult> {
  const now = new Date();

  const candidates = await db
    .select()
    .from(disputes)
    .where(
      and(
        inArray(disputes.status, ['sent', 'in_progress', 'responded']),
        isNull(disputes.responseReceivedAt),
        lte(disputes.escalationReadyAt, now)
      )
    );

  let escalatedCount = 0;
  let wouldEscalateCount = 0;
  let skippedCount = 0;
  const skipReasons: EscalationSkipReason[] = [];
  let deferredCount = 0;
  let nextEligibilityAt: Date | null = null;

  for (const dispute of candidates) {
    if ((dispute.round || 1) >= 4) {
      skippedCount += 1;
      continue;
    }

    const [existingChild] = await db
      .select({ id: disputes.id })
      .from(disputes)
      .where(eq(disputes.priorDisputeId, dispute.id))
      .limit(1);

    if (existingChild) {
      skippedCount += 1;
      continue;
    }

    if (!dispute.negativeItemId) {
      skippedCount += 1;
      continue;
    }

    const [negativeItem] = await db
      .select()
      .from(negativeItems)
      .where(eq(negativeItems.id, dispute.negativeItemId))
      .limit(1);

    const [creditAccount] = negativeItem?.creditAccountId
      ? await db
          .select({ accountNumber: creditAccounts.accountNumber })
          .from(creditAccounts)
          .where(eq(creditAccounts.id, negativeItem.creditAccountId))
          .limit(1)
      : [null];

    if (!negativeItem) {
      skippedCount += 1;
      continue;
    }

    const plan = buildEscalationPlan({
      currentRound: dispute.round || 1,
      trigger: 'no_response',
      currentBureau: dispute.bureau,
    });

    const decision = plan.targetRecipient === 'cfpb'
      ? decideEscalation({ plan, history: await loadDisputeChain(dispute.id) })
      : null;
    if (decision?.kind === 'blocked') {
      deferredCount += 1;
      const eligibleAt = decision.eligibility.eligibleAt;
      if (eligibleAt && (!nextEligibilityAt || eligibleAt < nextEligibilityAt)) nextEligibilityAt = eligibleAt;
      continue;
    }

    // Automated escalations get the same server-side policy decision as staff
    // requests. Without stored client factual confirmation, a high-risk plan
    // is refused and left for staff review.
    const policyDecision = decideDisputePolicy({
      reasonCodes: plan.reasonCodes,
      hasEvidencePacket: hasStoredEvidencePacket(dispute.evidenceDocumentIds),
      hasClientFactualConfirmation: false,
    });
    if (!policyDecision.approved) {
      skippedCount += 1;
      continue;
    }

    // The letter is written from the decrypted identity. Without a name and
    // full address there is no letter to draft; staff must complete the profile.
    const identityResult = await tryLoadLetterConsumerIdentity(dispute.clientId);
    if (!identityResult.ok) {
      skippedCount += 1;
      skipReasons.push({ dispute_id: dispute.id, reason: 'letter_identity_incomplete', missing: identityResult.error.missing });
      logServerEvent({
        level: 'warn',
        event: 'server.lib.dispute.escalation.skipped.letter_identity_incomplete',
        metadata: { disputeId: dispute.id, missing: identityResult.error.missing.join(',') },
      });
      continue;
    }

    if (options.dryRun) {
      wouldEscalateCount += 1;
      continue;
    }

    const letterParams = buildEscalationLetterParams({
      consumer: identityResult.identity,
      dispute,
      negativeItem,
      creditAccount: creditAccount || null,
      plan,
    });
    const librarySelection = await selectLibraryForGeneration({
      round: letterParams.round,
      targetRecipient: letterParams.targetRecipient,
      bureau: letterParams.itemData.bureau,
      itemType: letterParams.itemData.itemType,
      reasonCodes: letterParams.reasonCodes,
      methodology: letterParams.methodology,
    });

    const generation = await generateUniqueDisputeLetter({ ...letterParams, librarySelection });

    const createdAt = new Date();
    const persistedDraft = await persistGeneratedDisputeDraft({
      clientId: dispute.clientId,
      negativeItemId: dispute.negativeItemId,
      bureau: dispute.bureau,
      disputeReason: `Auto escalation: ${plan.customReason}`,
      disputeType: plan.disputeType,
      round: plan.nextRound,
      escalationPath: plan.targetRecipient,
      letterContent: generation.letter,
      creditorName: negativeItem.creditorName,
      accountNumber: creditAccount?.accountNumber || null,
      generatedByAi: generation.source === 'ai',
      methodology: plan.methodology,
      priorDisputeId: dispute.id,
      reasonCodes: plan.reasonCodes,
      policyDecision,
      items: [{
        kind: 'tradeline',
        bureau: dispute.bureau,
        creditorName: negativeItem.creditorName,
        originalCreditor: negativeItem.originalCreditor,
        accountNumber: creditAccount?.accountNumber || null,
        itemType: negativeItem.itemType,
        amount: negativeItem.amount,
        dateReported: negativeItem.dateReported?.toISOString(),
      }],
      selection: librarySelection,
    });

    await db
      .update(disputes)
      .set({
        status: 'escalated',
        outcome: dispute.outcome || 'no_response',
        escalationReason: 'Automatically escalated due to no response within SLA window.',
        updatedAt: createdAt,
      })
      .where(eq(disputes.id, dispute.id));

    const [openTask] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.clientId, dispute.clientId),
          eq(tasks.status, 'todo'),
          eq(tasks.title, `Review auto-escalated dispute R${plan.nextRound}`)
        )
      )
      .limit(1);

    if (!openTask) {
      await db.insert(tasks).values({
        id: randomUUID(),
        clientId: dispute.clientId,
        title: `Review auto-escalated dispute R${plan.nextRound}`,
        description: `${getTaskMarker(dispute.id)} Verify and send drafted escalation ${persistedDraft.disputeId} for ${dispute.bureau}.`,
        status: 'todo',
        priority: 'high',
        dueDate: createdAt,
        visibleToClient: false,
        isBlocking: true,
        createdAt,
        updatedAt: createdAt,
      });
    }

    await db
      .update(slaInstances)
      .set({
        status: 'breached',
        breachNotifiedAt: createdAt,
        updatedAt: createdAt,
      })
      .where(eq(slaInstances.id, getDisputeSlaInstanceId(dispute.id)));

    escalatedCount += 1;
  }

  const result: RunDisputeEscalationResult = {
    success: true,
    dry_run: options.dryRun,
    checked: candidates.length,
    escalated: escalatedCount,
    would_escalate: wouldEscalateCount,
    skipped: skippedCount,
    skip_reasons: skipReasons,
    deferred: deferredCount,
    next_eligibility_at: nextEligibilityAt?.toISOString() || null,
  };

  await setSetting(
    ESCALATION_LAST_RUN_SETTING_KEY,
    {
      ranAt: now.toISOString(),
      success: true,
      dryRun: options.dryRun,
      checked: result.checked,
      escalated: result.escalated,
      wouldEscalate: result.would_escalate,
      skipped: result.skipped,
      skipReasons: result.skip_reasons,
      deferred: result.deferred,
      nextEligibilityAt: result.next_eligibility_at,
      error: null,
    },
    'json',
    'compliance',
    'Last run metadata for dispute escalation automation'
  );

  return result;
}

export async function writeDisputeEscalationFailure(error: unknown) {
  await setSetting(
    ESCALATION_LAST_RUN_SETTING_KEY,
    {
      ranAt: new Date().toISOString(),
      success: false,
      dryRun: false,
      checked: 0,
      escalated: 0,
      wouldEscalate: 0,
      skipped: 0,
      skipReasons: [],
      deferred: 0,
      nextEligibilityAt: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    },
    'json',
    'compliance',
    'Last run metadata for dispute escalation automation'
  );
}
