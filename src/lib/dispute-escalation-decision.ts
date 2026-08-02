import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { disputes } from '@/db/schema';
import { assessCfpbEligibility, type CfpbEligibility } from '@/lib/cfpb-eligibility';
import type { EscalationPlan } from '@/lib/dispute-automation';

export interface DisputeHistoryEntry {
  id: string;
  clientId: string;
  negativeItemId: string | null;
  priorDisputeId: string | null;
  targetRecipient: string | null;
  status: string | null;
  sentAt: Date | null;
  responseReceivedAt: Date | null;
}

export type EscalationDecision =
  | { kind: 'ready'; plan: EscalationPlan; eligibility: CfpbEligibility | null }
  | { kind: 'blocked'; plan: EscalationPlan; eligibility: CfpbEligibility; message: string };

export function decideEscalation(input: {
  plan: EscalationPlan;
  history: DisputeHistoryEntry[];
  now?: Date;
}): EscalationDecision {
  if (input.plan.targetRecipient !== 'cfpb') return { kind: 'ready', plan: input.plan, eligibility: null };

  const current = input.history[0];
  const craDispute = input.history.find(entry => entry.targetRecipient === 'bureau' && entry.sentAt !== null);
  const eligibility = assessCfpbEligibility({
    submittedToCra: Boolean(craDispute),
    sentAt: craDispute?.sentAt || null,
    responseReceivedAt: craDispute?.responseReceivedAt || null,
  }, input.now);

  if (!current || craDispute && (craDispute.clientId !== current.clientId || craDispute.negativeItemId !== current.negativeItemId)) {
    return {
      kind: 'blocked',
      plan: input.plan,
      eligibility: { eligible: false, reason: 'missing_cra_dispute', eligibleAt: null },
      message: 'A prior CRA dispute for the same client and item is required before CFPB escalation.',
    };
  }

  if (!eligibility.eligible) {
    return {
      kind: 'blocked',
      plan: input.plan,
      eligibility,
      message: eligibility.eligibleAt
        ? `CFPB escalation is deferred until ${eligibility.eligibleAt.toISOString()}.`
        : 'CFPB escalation requires a submitted CRA dispute that is no longer pending.',
    };
  }

  return { kind: 'ready', plan: input.plan, eligibility };
}

export async function loadDisputeChain(startDisputeId: string): Promise<DisputeHistoryEntry[]> {
  const history: DisputeHistoryEntry[] = [];
  const visited = new Set<string>();
  let disputeId: string | null = startDisputeId;

  while (disputeId && !visited.has(disputeId) && history.length < 12) {
    visited.add(disputeId);
    const [dispute] = await db
      .select({
        id: disputes.id,
        clientId: disputes.clientId,
        negativeItemId: disputes.negativeItemId,
        priorDisputeId: disputes.priorDisputeId,
        targetRecipient: disputes.escalationPath,
        status: disputes.status,
        sentAt: disputes.sentAt,
        responseReceivedAt: disputes.responseReceivedAt,
      })
      .from(disputes)
      .where(eq(disputes.id, disputeId))
      .limit(1);
    if (!dispute) break;
    history.push(dispute);
    disputeId = dispute.priorDisputeId;
  }

  return history;
}
