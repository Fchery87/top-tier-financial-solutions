import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { auth } from '@/lib/auth';
import { clients, evidencePackets } from '@/db/schema';
import { headers } from 'next/headers';

const HIGH_RISK_CLAIM_TYPES = new Set([
  'identity_theft',
  'fraud',
  'not_mine',
  'never_late',
  'unauthorized_inquiry',
]);

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  return session.user;
}

function parseConfirmations(value: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const evidencePacketId = body.evidence_packet_id as string | undefined;
    const confirmationText = (body.confirmation_text as string | undefined)?.trim();

    if (!evidencePacketId || !confirmationText) {
      return NextResponse.json({ error: 'Evidence packet ID and confirmation text are required' }, { status: 400 });
    }

    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    const [packet] = await db
      .select({
        id: evidencePackets.id,
        clientId: evidencePackets.clientId,
        claimType: evidencePackets.claimType,
        confirmations: evidencePackets.confirmations,
      })
      .from(evidencePackets)
      .where(and(
        eq(evidencePackets.id, evidencePacketId),
        eq(evidencePackets.clientId, client.id),
      ))
      .limit(1);

    if (!packet) {
      return NextResponse.json({ error: 'Evidence packet not found' }, { status: 404 });
    }

    if (!HIGH_RISK_CLAIM_TYPES.has(packet.claimType)) {
      return NextResponse.json({ error: 'Evidence packet does not require high-risk factual confirmation' }, { status: 400 });
    }

    const confirmations = parseConfirmations(packet.confirmations).filter((confirmation) => {
      if (!confirmation || typeof confirmation !== 'object') return true;
      return (confirmation as { key?: unknown }).key !== 'client_factual_claim_confirmed';
    });
    const now = new Date();
    const nextConfirmations = [
      ...confirmations,
      {
        key: 'client_factual_claim_confirmed',
        confirmed: true,
        source: 'portal',
        text: confirmationText,
        confirmed_at: now.toISOString(),
      },
    ];

    await db
      .update(evidencePackets)
      .set({
        confirmations: JSON.stringify(nextConfirmations),
        updatedAt: now,
      })
      .where(eq(evidencePackets.id, packet.id));

    return NextResponse.json({ confirmations: nextConfirmations });
  } catch (error) {
    console.error('Error recording portal high-risk confirmation:', error);
    return NextResponse.json({ error: 'Failed to record high-risk confirmation' }, { status: 500 });
  }
}
