import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { evidencePackets } from '@/db/schema';

/** Something no earlier letter on the item cited, which justifies another Bureau Dispute. */
export interface NewFact {
  description: string;
  evidencePacketId: string;
}

interface UnusedEvidencePacket {
  id: string;
  claimType: string;
  documentIds: string;
}

function documentCount(documentIds: string): number {
  try {
    const parsed: unknown = JSON.parse(documentIds);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/** A packet keeps the first dispute that used it, so a packet with no dispute was never cited. */
export function describeUnusedEvidence(packets: UnusedEvidencePacket[]): NewFact[] {
  return packets.flatMap(packet => {
    const count = documentCount(packet.documentIds);
    if (count === 0) return [];
    const claim = packet.claimType.replace(/_/g, ' ');
    return [{
      description: `client-supplied ${claim} evidence (${count} ${count === 1 ? 'document' : 'documents'}) not included in an earlier dispute`,
      evidencePacketId: packet.id,
    }];
  });
}

export async function loadNewFacts(input: { clientId: string; negativeItemId: string }): Promise<NewFact[]> {
  const packets = await db
    .select({ id: evidencePackets.id, claimType: evidencePackets.claimType, documentIds: evidencePackets.documentIds })
    .from(evidencePackets)
    .where(and(
      eq(evidencePackets.clientId, input.clientId),
      eq(evidencePackets.itemKind, 'tradeline'),
      eq(evidencePackets.itemId, input.negativeItemId),
      isNull(evidencePackets.disputeId),
    ));

  return describeUnusedEvidence(packets);
}
