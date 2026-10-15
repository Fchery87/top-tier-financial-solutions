import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { clients, findingReviews, negativeItems } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { capabilityDeniedResponse } from '@/lib/capability-denial';
import { collectItemFindings } from '@/lib/letter-findings';
import { recordSensitiveRead } from '@/lib/sensitive-read-audit';
import { logServerEvent } from '@/lib/server-logger';

/** Interpretive Findings for the client's negative items, with any staff decision. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return capabilityDeniedResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 403 }));
  }
  const { id: clientId } = await params;

  try {
    const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const items = await db
      .select({ id: negativeItems.id, creditorName: negativeItems.creditorName })
      .from(negativeItems)
      .where(eq(negativeItems.clientId, clientId));
    const findings = (await collectItemFindings(clientId, items.map(item => item.id)))
      .filter(finding => finding.tier === 'interpretive');

    await recordSensitiveRead(db, {
      kind: 'client_record',
      actorUserId: adminUser.id,
      clientId,
      route: request.nextUrl.pathname,
      requestId: request.headers.get('x-request-id') ?? 'unavailable',
    });

    return NextResponse.json({
      findings: findings.map(finding => ({
        negative_item_id: finding.itemId,
        creditor_name: items.find(item => item.id === finding.itemId)?.creditorName ?? null,
        bureau: finding.bureau,
        text: finding.text,
        review: finding.review,
      })),
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.workspace.clients.held_findings.get.error', error });
    return NextResponse.json({ error: 'Failed to load held findings' }, { status: 500 });
  }
}

/** Records a staff decision to approve an Interpretive Finding into letters or drop it. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return capabilityDeniedResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 403 }));
  }
  const { id: clientId } = await params;

  try {
    const body = await request.json() as { negative_item_id?: unknown; finding_text?: unknown; decision?: unknown };
    const negativeItemId = typeof body.negative_item_id === 'string' ? body.negative_item_id : '';
    const findingText = typeof body.finding_text === 'string' ? body.finding_text : '';
    const decision = body.decision === 'approved' || body.decision === 'dropped' ? body.decision : null;
    if (!negativeItemId || !findingText || !decision) {
      return NextResponse.json({ error: 'negative_item_id, finding_text and a decision of approved or dropped are required' }, { status: 400 });
    }

    const [item] = await db
      .select({ id: negativeItems.id })
      .from(negativeItems)
      .where(and(eq(negativeItems.id, negativeItemId), eq(negativeItems.clientId, clientId)))
      .limit(1);
    if (!item) return NextResponse.json({ error: 'Negative item not found for this client' }, { status: 404 });

    // Only a finding the server itself produced can be approved into a letter.
    const held = (await collectItemFindings(clientId, [negativeItemId]))
      .some(finding => finding.tier === 'interpretive' && finding.text === findingText);
    if (!held) return NextResponse.json({ error: 'That finding is not a current interpretive finding for this item' }, { status: 409 });

    const now = new Date();
    await db
      .insert(findingReviews)
      .values({ id: randomUUID(), clientId, negativeItemId, findingText, decision, decidedById: adminUser.id, decidedAt: now })
      .onConflictDoUpdate({
        target: [findingReviews.negativeItemId, findingReviews.findingText],
        set: { decision, decidedById: adminUser.id, decidedAt: now },
      });

    return NextResponse.json({ negative_item_id: negativeItemId, finding_text: findingText, review: decision });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.workspace.clients.held_findings.post.error', error });
    return NextResponse.json({ error: 'Failed to record the decision' }, { status: 500 });
  }
}
