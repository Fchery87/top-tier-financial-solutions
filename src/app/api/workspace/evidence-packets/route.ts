import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientDocuments, clients, evidencePackets } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { deriveEvidencePacketState, deriveItemClaimConfirmation, HIGH_RISK_CLAIM_TYPES, staffSuppliedFactualConfirmation, verifyEvidencePacket } from '@/lib/dispute-evidence';
import { isItemOwnedByClient, type DisputeItemRef } from '@/lib/high-risk-claim-gate';
import { isDisputeItemKind, type ItemClaimConfirmation } from '@/lib/high-risk-claim-registry';
import { isClientOwnedEvidenceDocument } from '@/lib/evidence-documents';
import { logServerEvent } from '@/lib/server-logger';

function parseJsonArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type ItemLinkParse =
  | { kind: 'none' }
  | { kind: 'item'; item: DisputeItemRef }
  | { kind: 'invalid' };

/** `item_kind` and `item_id` come together, or not at all. */
function parseItemLink(itemKind: unknown, itemId: unknown): ItemLinkParse {
  const hasKind = itemKind !== undefined && itemKind !== null && itemKind !== '';
  const hasId = itemId !== undefined && itemId !== null && itemId !== '';
  if (!hasKind && !hasId) return { kind: 'none' };
  if (!isDisputeItemKind(itemKind) || typeof itemId !== 'string' || !itemId.trim()) return { kind: 'invalid' };
  return { kind: 'item', item: { kind: itemKind, id: itemId.trim() } };
}

function formatPacket(packet: typeof evidencePackets.$inferSelect) {
  const confirmations = parseJsonArray(packet.confirmations);
  const state = deriveEvidencePacketState({
    claimType: packet.claimType,
    confirmations,
  });
  return {
    id: packet.id,
    client_id: packet.clientId,
    dispute_id: packet.disputeId,
    item_kind: packet.itemKind,
    item_id: packet.itemId,
    claim_type: packet.claimType,
    document_ids: parseJsonArray(packet.documentIds),
    confirmations,
    state: state.kind,
    created_by_id: packet.createdById,
    created_at: packet.createdAt?.toISOString(),
    updated_at: packet.updatedAt?.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const adminUser = await requireCapability('disputes:read');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const clientId = request.nextUrl.searchParams.get('client_id');
  const disputeId = request.nextUrl.searchParams.get('dispute_id');
  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
  }
  const itemLink = parseItemLink(
    request.nextUrl.searchParams.get('item_kind'),
    request.nextUrl.searchParams.get('item_id'),
  );
  if (itemLink.kind === 'invalid') {
    return NextResponse.json({ error: 'item_kind and item_id must be given together' }, { status: 400 });
  }

  try {
    const packets = (await db
      .select()
      .from(evidencePackets)
      .where(and(
        eq(evidencePackets.clientId, clientId),
        disputeId ? eq(evidencePackets.disputeId, disputeId) : undefined,
        itemLink.kind === 'item' ? eq(evidencePackets.itemKind, itemLink.item.kind) : undefined,
        itemLink.kind === 'item' ? eq(evidencePackets.itemId, itemLink.item.id) : undefined,
      ))
      .orderBy(desc(evidencePackets.createdAt)))
      .filter((packet) => itemLink.kind !== 'item'
        || (packet.itemKind === itemLink.item.kind && packet.itemId === itemLink.item.id));

    if (itemLink.kind !== 'item') {
      return NextResponse.json({ packets: packets.map(formatPacket) });
    }

    const claims: Record<string, ItemClaimConfirmation> = {};
    for (const claimType of new Set(packets.map((packet) => packet.claimType))) {
      claims[claimType] = deriveItemClaimConfirmation(packets.filter((packet) => packet.claimType === claimType));
    }
    return NextResponse.json({ packets: packets.map(formatPacket), claims });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.evidence.packets.error', error: error });
    return NextResponse.json({ error: 'Failed to list evidence packets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const clientId = body.client_id;
    const disputeId = body.dispute_id || null;
    const claimType = body.claim_type;
    const documentIds: string[] = Array.isArray(body.document_ids) ? body.document_ids : [];
    const confirmations = Array.isArray(body.confirmations) ? body.confirmations : [];
    const itemLink = parseItemLink(body.item_kind, body.item_id);

    if (!clientId || !claimType) {
      return NextResponse.json({ error: 'Client ID and claim type are required' }, { status: 400 });
    }

    if (itemLink.kind === 'invalid') {
      return NextResponse.json({ error: 'item_kind and item_id must be given together' }, { status: 400 });
    }

    if (HIGH_RISK_CLAIM_TYPES.has(claimType) && staffSuppliedFactualConfirmation(confirmations)) {
      return NextResponse.json({ error: 'Staff cannot record the client factual confirmation' }, { status: 400 });
    }

    const evidenceDecision = verifyEvidencePacket({ claimType, documentIds, confirmations });
    const blockingViolations = HIGH_RISK_CLAIM_TYPES.has(claimType)
      ? evidenceDecision.violations.filter((violation) => !violation.includes('explicit client factual confirmation'))
      : evidenceDecision.violations;
    if (blockingViolations.length > 0) {
      return NextResponse.json({ error: blockingViolations[0].replace(/\.$/, '') }, { status: 400 });
    }

    const [client] = await db
      .select({ id: clients.id, userId: clients.userId })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (itemLink.kind === 'item' && !(await isItemOwnedByClient(itemLink.item, clientId))) {
      return NextResponse.json({ error: 'The disputed item does not belong to the client' }, { status: 400 });
    }

    if (documentIds.length > 0) {
      const ownedDocuments = await db
        .select({
          id: clientDocuments.id,
          userId: clientDocuments.userId,
          fileUrl: clientDocuments.fileUrl,
        })
        .from(clientDocuments)
        .where(inArray(clientDocuments.id, documentIds));

      const documentsById = new Map(ownedDocuments.map((document) => [document.id, document]));
      const hasUnownedDocument = documentIds.some((id) => {
        const document = documentsById.get(id);
        return !document || !isClientOwnedEvidenceDocument({
          clientUserId: client.userId,
          document,
        });
      });
      if (hasUnownedDocument) {
        return NextResponse.json({ error: 'Evidence packet documents must belong to the client' }, { status: 400 });
      }
    }

    const now = new Date();
    const [created] = await db.insert(evidencePackets).values({
      id: randomUUID(),
      clientId,
      disputeId,
      itemKind: itemLink.kind === 'item' ? itemLink.item.kind : null,
      itemId: itemLink.kind === 'item' ? itemLink.item.id : null,
      claimType,
      documentIds: JSON.stringify(documentIds),
      confirmations: JSON.stringify(confirmations),
      createdById: adminUser.id,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return NextResponse.json(formatPacket(created), { status: 201 });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.evidence.packets.error', error: error });
    return NextResponse.json({ error: 'Failed to create evidence packet' }, { status: 500 });
  }
}
