import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { disputeLetterLibrary } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { recordAdminActivity } from '@/lib/admin-activity';
import { isRecord, parsePayload, serializeRow } from '../route';
import { logServerEvent } from '@/lib/server-logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function findRow(id: string) {
  const [row] = await db
    .select()
    .from(disputeLetterLibrary)
    .where(eq(disputeLetterLibrary.id, id))
    .limit(1);
  return row || null;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await requireCapability('templates:read');
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  try {
    const row = await findRow(id);
    if (!row) return NextResponse.json({ error: 'Letter library row not found' }, { status: 404 });
    return NextResponse.json({ template: serializeRow(row) });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.letter.library.id.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch letter library row' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireCapability('templates:write');
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  try {
    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody)) return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    const existing = await findRow(id);
    if (!existing) return NextResponse.json({ error: 'Letter library row not found' }, { status: 404 });

    const mergedBody: Record<string, unknown> = {
      name: rawBody.name ?? existing.name,
      description: rawBody.description ?? existing.description,
      methodology: rawBody.methodology ?? existing.methodology,
      target_recipient: rawBody.target_recipient ?? existing.targetRecipient,
      round: rawBody.round ?? existing.round,
      item_types: rawBody.item_types ?? existing.itemTypes,
      bureau: rawBody.bureau ?? existing.bureau,
      reason_codes: rawBody.reason_codes ?? existing.reasonCodes,
      content: rawBody.content ?? existing.content,
      prompt_context: rawBody.prompt_context ?? existing.promptContext,
      variables: rawBody.variables ?? existing.variables,
      legal_citations: rawBody.legal_citations ?? existing.legalCitations,
      is_active: rawBody.is_active ?? existing.isActive,
    };
    const mergedPayload = parsePayload(mergedBody);
    if (!mergedPayload) return NextResponse.json({ error: 'Invalid letter library array or required field' }, { status: 400 });

    await db.transaction(async (tx) => {
      await tx
        .update(disputeLetterLibrary)
        .set({ ...mergedPayload, updatedAt: new Date() })
        .where(eq(disputeLetterLibrary.id, id));
      await recordAdminActivity(tx, {
        actorUserId: user.id,
        action: 'letter_library.updated',
        subjectType: 'letter_library',
        subjectId: id,
        metadata: { changedFields: Object.keys(rawBody).sort() },
      });
    });

    const updated = await findRow(id);
    return NextResponse.json({ template: updated ? serializeRow(updated) : null });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.letter.library.id.error', error: error });
    return NextResponse.json({ error: 'Failed to update letter library row' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await requireCapability('templates:write');
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  try {
    const existing = await findRow(id);
    if (!existing) return NextResponse.json({ error: 'Letter library row not found' }, { status: 404 });

    await db.transaction(async (tx) => {
      await tx
        .update(disputeLetterLibrary)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(disputeLetterLibrary.id, id));
      await recordAdminActivity(tx, {
        actorUserId: user.id,
        action: 'letter_library.deactivated',
        subjectType: 'letter_library',
        subjectId: id,
        metadata: { changedFields: ['isActive'] },
      });
    });

    return NextResponse.json({ id, is_active: false });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.letter.library.id.error', error: error });
    return NextResponse.json({ error: 'Failed to deactivate letter library row' }, { status: 500 });
  }
}
