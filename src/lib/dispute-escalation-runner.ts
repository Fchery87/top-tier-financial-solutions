import { randomUUID } from 'crypto';
import { and, eq, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { clients, disputes, negativeItems, slaInstances, tasks } from '@/db/schema';
import { generateUniqueDisputeLetter } from '@/lib/ai-letter-generator';
import { setSetting } from '@/lib/settings-service';
import { buildEscalationPlan, getDisputeSlaInstanceId } from '@/lib/dispute-automation';

export const ESCALATION_LAST_RUN_SETTING_KEY = 'automation.dispute_escalations.last_run';

export interface RunDisputeEscalationOptions {
  dryRun: boolean;
}

export interface RunDisputeEscalationResult {
  success: true;
  dry_run: boolean;
  checked: number;
  escalated: number;
  would_escalate: number;
  skipped: number;
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

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, dispute.clientId))
      .limit(1);

    const [negativeItem] = await db
      .select()
      .from(negativeItems)
      .where(eq(negativeItems.id, dispute.negativeItemId))
      .limit(1);

    if (!client || !negativeItem) {
      skippedCount += 1;
      continue;
    }

    const plan = buildEscalationPlan({
      currentRound: dispute.round || 1,
      trigger: 'no_response',
      currentBureau: dispute.bureau,
    });

    if (options.dryRun) {
      wouldEscalateCount += 1;
      continue;
    }

    const letterContent = await generateUniqueDisputeLetter({
      disputeType: plan.disputeType,
      round: plan.nextRound,
      targetRecipient: plan.targetRecipient,
      methodology: plan.methodology,
      clientData: {
        name: `${client.firstName} ${client.lastName}`,
      },
      itemData: {
        creditorName: negativeItem.creditorName,
        originalCreditor: negativeItem.originalCreditor || undefined,
        accountNumber: negativeItem.id.slice(-8),
        itemType: negativeItem.itemType,
        amount: negativeItem.amount || undefined,
        dateReported: negativeItem.dateReported?.toISOString() || undefined,
        bureau: dispute.bureau,
      },
      reasonCodes: plan.reasonCodes,
      customReason: plan.customReason,
    });

    const createdAt = new Date();
    const nextDisputeId = randomUUID();

    await db.insert(disputes).values({
      id: nextDisputeId,
      clientId: dispute.clientId,
      negativeItemId: dispute.negativeItemId,
      bureau: dispute.bureau,
      disputeReason: `Auto escalation: ${plan.customReason}`,
      disputeType: plan.disputeType,
      status: 'draft',
      round: plan.nextRound,
      escalationPath: plan.targetRecipient,
      letterContent,
      creditorName: negativeItem.creditorName,
      accountNumber: negativeItem.id.slice(-8),
      generatedByAi: true,
      methodology: plan.methodology,
      priorDisputeId: dispute.id,
      reasonCodes: JSON.stringify(plan.reasonCodes),
      createdAt,
      updatedAt: createdAt,
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
        description: `${getTaskMarker(dispute.id)} Verify and send drafted escalation ${nextDisputeId} for ${dispute.bureau}.`,
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
      error: error instanceof Error ? error.message : 'Unknown error',
    },
    'json',
    'compliance',
    'Last run metadata for dispute escalation automation'
  );
}
