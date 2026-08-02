import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { disputeLetterRevisions } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { saveDisputeLetter } from '@/lib/dispute-letter-workflow';

interface RouteContext {
  params: Promise<{ id: string; revisionId: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await requireCapability('letters:write');
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, revisionId } = await context.params;
  try {
    const revision = (await db.select().from(disputeLetterRevisions).where(eq(disputeLetterRevisions.id, revisionId)).limit(1))[0];
    if (!revision || revision.disputeId !== id) return NextResponse.json({ error: 'Revision not found' }, { status: 404 });

    const rawBody: unknown = await request.json().catch(() => ({}));
    const expectedRevision = isRecord(rawBody) && typeof rawBody.expectedRevision === 'number'
      ? rawBody.expectedRevision
      : undefined;
    const acknowledgeWarnings = isRecord(rawBody) && rawBody.acknowledgeWarnings === true;
    const result = await saveDisputeLetter({
      disputeId: id,
      content: revision.content,
      source: 'revert',
      actorUserId: user.id,
      acknowledgeWarnings,
      expectedRevision,
    });

    if (result.kind === 'immutable') return NextResponse.json({ error: 'This letter is immutable' }, { status: 409 });
    if (result.kind === 'conflict') return NextResponse.json({ error: 'conflict', ...result }, { status: 409 });
    if (result.kind === 'blocked') return NextResponse.json({ error: 'blocked', ...result }, { status: 422 });
    if (result.kind === 'warnings') return NextResponse.json({ error: 'needs_acknowledgement', ...result }, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error reverting dispute letter revision:', error);
    return NextResponse.json({ error: 'Failed to revert dispute letter' }, { status: 500 });
  }
}
