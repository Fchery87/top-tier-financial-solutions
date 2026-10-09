import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { auth } from '@/lib/auth';
import { clients, evidencePackets, inquiryDisputes, negativeItems, personalInfoDisputes } from '@/db/schema';
import { decryptNegativeItemData } from '@/lib/db-encryption';
import type { DisputeItemKind } from '@/lib/high-risk-claim-registry';
import { headers } from 'next/headers';
import { deriveEvidencePacketState, hasExplicitClientFactualConfirmation, HIGH_RISK_CLAIM_TYPES } from '@/lib/dispute-evidence';
import { logServerEvent } from '@/lib/server-logger';
import { readJsonBody, validationErrorResponse } from '@/lib/request-validation';
import { z } from 'zod';

const confirmationSchema = z.object({
  evidence_packet_id: z.string().trim().max(128).optional(),
  confirmation_text: z.string().trim().max(2_000).optional(),
});

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

/** What the client sees for the disputed item: whose account or inquiry, and on which bureaus. */
interface PortalClaimItem {
  kind: DisputeItemKind;
  name: string;
  bureaus: string[];
}

function tradelineBureaus(row: { bureau: string | null; onTransunion: boolean | null; onExperian: boolean | null; onEquifax: boolean | null }): string[] {
  const flagged = [
    row.onTransunion ? 'transunion' : null,
    row.onExperian ? 'experian' : null,
    row.onEquifax ? 'equifax' : null,
  ].filter((bureau): bureau is string => bureau !== null);
  if (flagged.length > 0) return flagged;
  return row.bureau && row.bureau !== 'combined' ? [row.bureau] : [];
}

/** Loads the client's own items that the packets are about, keyed by `${kind}:${id}`. */
async function loadClaimItems(clientId: string, refs: { kind: DisputeItemKind; id: string }[]): Promise<Map<string, PortalClaimItem>> {
  const items = new Map<string, PortalClaimItem>();
  const idsOf = (kind: DisputeItemKind) => Array.from(new Set(refs.filter((ref) => ref.kind === kind).map((ref) => ref.id)));

  const tradelineIds = idsOf('tradeline');
  if (tradelineIds.length > 0) {
    const rows = await db
      .select({
        id: negativeItems.id,
        clientId: negativeItems.clientId,
        creditorName: negativeItems.creditorName,
        bureau: negativeItems.bureau,
        onTransunion: negativeItems.onTransunion,
        onExperian: negativeItems.onExperian,
        onEquifax: negativeItems.onEquifax,
      })
      .from(negativeItems)
      .where(and(eq(negativeItems.clientId, clientId), inArray(negativeItems.id, tradelineIds)));
    for (const row of rows) {
      if (row.clientId !== clientId) continue;
      const decrypted = decryptNegativeItemData({ creditorName: row.creditorName });
      items.set(`tradeline:${row.id}`, { kind: 'tradeline', name: String(decrypted.creditorName ?? ''), bureaus: tradelineBureaus(row) });
    }
  }

  const inquiryIds = idsOf('inquiry');
  if (inquiryIds.length > 0) {
    const rows = await db
      .select({ id: inquiryDisputes.id, clientId: inquiryDisputes.clientId, creditorName: inquiryDisputes.creditorName, bureau: inquiryDisputes.bureau })
      .from(inquiryDisputes)
      .where(and(eq(inquiryDisputes.clientId, clientId), inArray(inquiryDisputes.id, inquiryIds)));
    for (const row of rows) {
      if (row.clientId !== clientId) continue;
      items.set(`inquiry:${row.id}`, { kind: 'inquiry', name: row.creditorName, bureaus: row.bureau ? [row.bureau] : [] });
    }
  }

  const personalIds = idsOf('personal');
  if (personalIds.length > 0) {
    const rows = await db
      .select({ id: personalInfoDisputes.id, clientId: personalInfoDisputes.clientId, type: personalInfoDisputes.type, value: personalInfoDisputes.value, bureau: personalInfoDisputes.bureau })
      .from(personalInfoDisputes)
      .where(and(eq(personalInfoDisputes.clientId, clientId), inArray(personalInfoDisputes.id, personalIds)));
    for (const row of rows) {
      if (row.clientId !== clientId) continue;
      items.set(`personal:${row.id}`, { kind: 'personal', name: `${row.type.replaceAll('_', ' ')}: ${row.value}`, bureaus: [row.bureau] });
    }
  }

  return items;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    const rows = await db
      .select({
        id: evidencePackets.id,
        claimType: evidencePackets.claimType,
        disputeId: evidencePackets.disputeId,
        itemKind: evidencePackets.itemKind,
        itemId: evidencePackets.itemId,
        createdAt: evidencePackets.createdAt,
        confirmations: evidencePackets.confirmations,
      })
      .from(evidencePackets)
      .where(eq(evidencePackets.clientId, client.id));

    const awaiting = rows.filter((row) => deriveEvidencePacketState({
      claimType: row.claimType,
      confirmations: parseConfirmations(row.confirmations),
    }).kind === 'awaiting_client_confirmation');
    const items = await loadClaimItems(client.id, awaiting.flatMap((row) => (
      row.itemKind && row.itemId ? [{ kind: row.itemKind, id: row.itemId }] : []
    )));

    const packets = awaiting.map((row) => ({
      id: row.id,
      claim_type: row.claimType,
      dispute_id: row.disputeId,
      item: row.itemKind && row.itemId ? items.get(`${row.itemKind}:${row.itemId}`) ?? null : null,
      created_at: row.createdAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ packets });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.portal.high.risk.confirmations.list.error', error });
    return NextResponse.json({ error: 'Failed to list high-risk confirmations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = await readJsonBody(request, confirmationSchema);
    if (parsed.kind !== 'valid') {
      return validationErrorResponse(parsed);
    }
    const evidencePacketId = parsed.data.evidence_packet_id;
    const confirmationText = parsed.data.confirmation_text;

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

    const storedConfirmations = packet.confirmations ?? '[]';
    const confirmations = parseConfirmations(storedConfirmations).filter((confirmation) => {
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

    const updated = await db
      .update(evidencePackets)
      .set({
        confirmations: JSON.stringify(nextConfirmations),
        updatedAt: now,
      })
      .where(and(
        eq(evidencePackets.id, packet.id),
        sql`${evidencePackets.confirmations} = ${storedConfirmations}`,
      ))
      .returning({ confirmations: evidencePackets.confirmations });

    if (updated.length === 0) {
      const [current] = await db
        .select({ confirmations: evidencePackets.confirmations })
        .from(evidencePackets)
        .where(and(
          eq(evidencePackets.id, packet.id),
          eq(evidencePackets.clientId, client.id),
        ))
        .limit(1);
      const currentConfirmations = parseConfirmations(current?.confirmations ?? null);
      if (hasExplicitClientFactualConfirmation(currentConfirmations)) {
        return NextResponse.json({ confirmations: currentConfirmations });
      }
      return NextResponse.json({ error: 'Evidence packet confirmation changed. Retry the confirmation.' }, { status: 409 });
    }

    return NextResponse.json({ confirmations: nextConfirmations });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.portal.high.risk.confirmations.error', error: error });
    return NextResponse.json({ error: 'Failed to record high-risk confirmation' }, { status: 500 });
  }
}
