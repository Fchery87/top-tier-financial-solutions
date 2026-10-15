import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { evidencePackets } from '@/db/schema';
import { collectItemFindings, isCitable } from '@/lib/letter-findings';

/** Something no earlier letter on the item cited, which justifies another Bureau Dispute. */
export interface NewFact {
  description: string;
  /** Set when the fact is client-supplied evidence the new letter should enclose. */
  evidencePacketId?: string;
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

/** Every Finding sentence the letters in a dispute chain cited. */
export function citedInChain(chain: Array<{ citedFindings: string | null }>): Set<string> {
  return new Set(chain.flatMap(entry => {
    if (!entry.citedFindings) return [];
    try {
      const parsed: unknown = JSON.parse(entry.citedFindings);
      return Array.isArray(parsed) ? parsed.filter((text): text is string => typeof text === 'string') : [];
    } catch {
      return [];
    }
  }));
}

export async function loadNewFacts(input: { clientId: string; negativeItemId: string; bureau: string; cited: Set<string> }): Promise<NewFact[]> {
  const packets = await db
    .select({ id: evidencePackets.id, claimType: evidencePackets.claimType, documentIds: evidencePackets.documentIds })
    .from(evidencePackets)
    .where(and(
      eq(evidencePackets.clientId, input.clientId),
      eq(evidencePackets.itemKind, 'tradeline'),
      eq(evidencePackets.itemId, input.negativeItemId),
      isNull(evidencePackets.disputeId),
    ));

  const findings = (await collectItemFindings(input.clientId, [input.negativeItemId]))
    .filter(finding => finding.bureau === input.bureau && isCitable(finding) && !input.cited.has(finding.text))
    .map(finding => ({ description: finding.text }));

  return [...describeUnusedEvidence(packets), ...findings];
}
