import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientDocuments, clients, evidencePackets } from '@/db/schema';
import { getAdminSessionUser } from '@/lib/admin-session';

const HIGH_RISK_CLAIM_TYPES = new Set([
  'identity_theft',
  'fraud',
  'not_mine',
  'never_late',
  'unauthorized_inquiry',
]);

function parseJsonArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatPacket(packet: typeof evidencePackets.$inferSelect) {
  return {
    id: packet.id,
    client_id: packet.clientId,
    dispute_id: packet.disputeId,
    claim_type: packet.claimType,
    document_ids: parseJsonArray(packet.documentIds),
    confirmations: parseJsonArray(packet.confirmations),
    created_at: packet.createdAt?.toISOString(),
    updated_at: packet.updatedAt?.toISOString(),
  };
}

function hasExplicitClientFactualConfirmation(confirmations: unknown[]) {
  return confirmations.some((confirmation) => {
    if (!confirmation || typeof confirmation !== 'object') return false;

    const item = confirmation as { key?: unknown; confirmed?: unknown };
    return item.key === 'client_factual_claim_confirmed' && item.confirmed === true;
  });
}

async function validateAdmin() {
  return getAdminSessionUser('super_admin');
}

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const clientId = body.client_id;
    const disputeId = body.dispute_id || null;
    const claimType = body.claim_type;
    const documentIds: string[] = Array.isArray(body.document_ids) ? body.document_ids : [];
    const confirmations = Array.isArray(body.confirmations) ? body.confirmations : [];

    if (!clientId || !claimType) {
      return NextResponse.json({ error: 'Client ID and claim type are required' }, { status: 400 });
    }

    if (HIGH_RISK_CLAIM_TYPES.has(claimType) && !hasExplicitClientFactualConfirmation(confirmations)) {
      return NextResponse.json({ error: 'High-risk claims require explicit client factual confirmation' }, { status: 400 });
    }

    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (documentIds.length > 0) {
      const ownedDocuments = await db
        .select({ id: clientDocuments.id, userId: clientDocuments.userId })
        .from(clientDocuments)
        .where(inArray(clientDocuments.id, documentIds));

      const ownedIds = new Set(ownedDocuments.map((document) => document.id));
      if (documentIds.some((id) => !ownedIds.has(id))) {
        return NextResponse.json({ error: 'Evidence packet includes documents that do not exist or are not available' }, { status: 400 });
      }
    }

    const now = new Date();
    const [created] = await db.insert(evidencePackets).values({
      id: randomUUID(),
      clientId,
      disputeId,
      claimType,
      documentIds: JSON.stringify(documentIds),
      confirmations: JSON.stringify(confirmations),
      createdAt: now,
      updatedAt: now,
    }).returning();

    return NextResponse.json(formatPacket(created), { status: 201 });
  } catch (error) {
    console.error('Error creating evidence packet:', error);
    return NextResponse.json({ error: 'Failed to create evidence packet' }, { status: 500 });
  }
}
