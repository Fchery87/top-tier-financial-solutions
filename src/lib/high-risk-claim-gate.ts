import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { evidencePackets, inquiryDisputes, negativeItems, personalInfoDisputes } from '@/db/schema';
import { deriveItemClaimConfirmation } from '@/lib/dispute-evidence';
import { decideDisputePolicy, type DisputePolicyDecision } from '@/lib/dispute-policy-decision';
import {
  HIGH_RISK_CONFIRMATION_REQUIRED,
  isDisputeItemKind,
  isHighRiskClaimType,
  type DisputeItemKind,
  type HighRiskClaimBlocker,
  type ItemClaimConfirmation,
} from '@/lib/high-risk-claim-registry';

export interface DisputeItemRef {
  kind: DisputeItemKind;
  id: string;
}

export type HighRiskClaimDecision =
  | { kind: 'approved'; policyDecision: DisputePolicyDecision; evidencePacketIds: string[] }
  | { kind: 'not_approved'; violations: string[] }
  | { kind: 'confirmation_required'; blockers: HighRiskClaimBlocker[] };

function blockerState(confirmation: Exclude<ItemClaimConfirmation, { state: 'confirmed' }>): HighRiskClaimBlocker['state'] {
  return confirmation.state === 'none' ? 'no_packet' : confirmation.state;
}

/**
 * Decides dispute policy for the items a letter is about. Every high-risk
 * reason code applies to every item, and each (item, claim type) needs its own
 * packet with documents and the client's portal confirmation. Confirmation is
 * read from evidence_packets only; nothing in the request body can supply it.
 */
export async function decideHighRiskClaims(params: {
  clientId: string;
  reasonCodes: string[];
  items: DisputeItemRef[];
}): Promise<HighRiskClaimDecision> {
  const highRiskCodes = Array.from(new Set(params.reasonCodes.filter(isHighRiskClaimType)));
  const blockers: HighRiskClaimBlocker[] = [];
  const evidencePacketIds: string[] = [];

  if (highRiskCodes.length > 0 && params.items.length === 0) {
    blockers.push(...highRiskCodes.map((claimType) => ({ itemId: null, itemKind: null, claimType, state: 'no_packet' as const })));
  } else if (highRiskCodes.length > 0) {
    const itemIds = Array.from(new Set(params.items.map((item) => item.id)));
    const rows = await db
      .select({
        id: evidencePackets.id,
        clientId: evidencePackets.clientId,
        itemKind: evidencePackets.itemKind,
        itemId: evidencePackets.itemId,
        claimType: evidencePackets.claimType,
        documentIds: evidencePackets.documentIds,
        confirmations: evidencePackets.confirmations,
      })
      .from(evidencePackets)
      .where(and(eq(evidencePackets.clientId, params.clientId), inArray(evidencePackets.itemId, itemIds)));

    for (const item of params.items) {
      for (const claimType of highRiskCodes) {
        const confirmation = deriveItemClaimConfirmation(rows.filter((row) => (
          row.clientId === params.clientId
          && row.itemKind === item.kind
          && row.itemId === item.id
          && row.claimType === claimType
        )));
        const itemDecision = decideDisputePolicy({
          reasonCodes: [claimType],
          hasEvidencePacket: confirmation.state === 'awaiting_client_confirmation' || confirmation.state === 'confirmed',
          hasClientFactualConfirmation: confirmation.state === 'confirmed',
        });
        if (confirmation.state === 'confirmed' && itemDecision.approved) {
          evidencePacketIds.push(confirmation.packetId);
        } else if (confirmation.state !== 'confirmed') {
          blockers.push({ itemId: item.id, itemKind: item.kind, claimType, state: blockerState(confirmation) });
        }
      }
    }
  }

  if (blockers.length > 0) return { kind: 'confirmation_required', blockers };

  const policyDecision = decideDisputePolicy({
    reasonCodes: params.reasonCodes,
    hasEvidencePacket: highRiskCodes.length > 0,
    hasClientFactualConfirmation: highRiskCodes.length > 0,
  });
  if (!policyDecision.approved) return { kind: 'not_approved', violations: policyDecision.violations };

  return { kind: 'approved', policyDecision, evidencePacketIds: Array.from(new Set(evidencePacketIds)) };
}

/** The 409 body for `confirmation_required`. */
export function highRiskConfirmationRequiredBody(blockers: HighRiskClaimBlocker[]) {
  return {
    error: 'Client confirmation is required for high-risk claims',
    code: HIGH_RISK_CONFIRMATION_REQUIRED,
    items: blockers,
  };
}

/** Reads the item refs out of a request's `disputeItems` payloads. A missing kind means a tradeline. */
export function disputeItemRefs(payloads: unknown): DisputeItemRef[] {
  if (!Array.isArray(payloads)) return [];
  return payloads.flatMap((payload) => {
    if (!payload || typeof payload !== 'object') return [];
    const { id, kind } = payload as { id?: unknown; kind?: unknown };
    if (typeof id !== 'string' || !id) return [];
    return [{ kind: isDisputeItemKind(kind) ? kind : 'tradeline', id }];
  });
}

/** True when the item exists in its kind's table and belongs to the client. */
export async function isItemOwnedByClient(item: DisputeItemRef, clientId: string): Promise<boolean> {
  const table = item.kind === 'tradeline' ? negativeItems : item.kind === 'inquiry' ? inquiryDisputes : personalInfoDisputes;
  const [row] = await db
    .select({ id: table.id, clientId: table.clientId })
    .from(table)
    .where(and(eq(table.id, item.id), eq(table.clientId, clientId)))
    .limit(1);
  return row?.id === item.id && row.clientId === clientId;
}
