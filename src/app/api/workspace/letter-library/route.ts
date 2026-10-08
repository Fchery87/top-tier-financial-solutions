import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/db/client';
import { disputeLetterLibrary } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { recordAdminActivity } from '@/lib/admin-activity';
import { logServerEvent } from '@/lib/server-logger';

function parseStringArray(value: unknown): string[] | null {
  if (value === undefined || value === null || value === '') return null;
  try {
    const candidate: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(candidate) || !candidate.every(item => typeof item === 'string')) return null;
    return candidate.map(item => item.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

function parseStringArrayStrict(value: unknown): { valid: true; value: string[] | null } | { valid: false } {
  if (value === undefined || value === null || value === '') return { valid: true, value: null };
  try {
    const candidate: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(candidate) || !candidate.every(item => typeof item === 'string')) return { valid: false };
    return { valid: true, value: candidate.map(item => item.trim()).filter(Boolean) };
  } catch {
    return { valid: false };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function serializeRow(row: typeof disputeLetterLibrary.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    methodology: row.methodology,
    target_recipient: row.targetRecipient,
    round: row.round,
    item_types: parseStringArray(row.itemTypes),
    bureau: row.bureau,
    reason_codes: parseStringArray(row.reasonCodes),
    content: row.content,
    prompt_context: row.promptContext,
    variables: parseStringArray(row.variables),
    legal_citations: parseStringArray(row.legalCitations),
    times_used: row.timesUsed ?? 0,
    success_count: row.successCount ?? 0,
    effectiveness_rating: row.effectivenessRating,
    last_used_at: row.lastUsedAt?.toISOString() ?? null,
    is_active: row.isActive ?? false,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export function parsePayload(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const methodology = typeof body.methodology === 'string' ? body.methodology.trim() : '';
  const targetRecipient = typeof body.target_recipient === 'string' ? body.target_recipient.trim() : 'bureau';
  const content = typeof body.content === 'string' ? body.content : '';
  const round = body.round === undefined || body.round === null || body.round === ''
    ? 1
    : Number(body.round);
  if (!name || !methodology || !content || !Number.isInteger(round) || round < 1) return null;

  const itemTypes = parseStringArrayStrict(body.item_types);
  const reasonCodes = parseStringArrayStrict(body.reason_codes);
  const variables = parseStringArrayStrict(body.variables);
  const legalCitations = parseStringArrayStrict(body.legal_citations);
  if (!itemTypes.valid || !reasonCodes.valid || !variables.valid || !legalCitations.valid) return null;

  return {
    name,
    description: typeof body.description === 'string' ? body.description : null,
    methodology,
    targetRecipient,
    round,
    itemTypes: itemTypes.value ? JSON.stringify(itemTypes.value) : null,
    bureau: typeof body.bureau === 'string' && body.bureau.trim() ? body.bureau.trim() : null,
    reasonCodes: reasonCodes.value ? JSON.stringify(reasonCodes.value) : null,
    content,
    promptContext: typeof body.prompt_context === 'string' ? body.prompt_context : null,
    variables: variables.value ? JSON.stringify(variables.value) : null,
    legalCitations: legalCitations.value ? JSON.stringify(legalCitations.value) : null,
    isActive: body.is_active === undefined ? true : body.is_active === true,
  };
}

export async function GET() {
  const user = await requireCapability('templates:read');
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const rows = await db.select().from(disputeLetterLibrary).orderBy(desc(disputeLetterLibrary.updatedAt));
    return NextResponse.json({ templates: rows.map(serializeRow) });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.letter.library.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch letter library' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireCapability('templates:write');
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody)) return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    const body = rawBody;
    const payload = parsePayload(body);
    if (!payload) return NextResponse.json({ error: 'Name, methodology, round, and content are required' }, { status: 400 });

    const id = randomUUID();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(disputeLetterLibrary).values({ id, ...payload, createdAt: now, updatedAt: now });
      await recordAdminActivity(tx, {
        actorUserId: user.id,
        action: 'letter_library.created',
        subjectType: 'letter_library',
        subjectId: id,
        metadata: { changedFields: Object.keys(payload).sort() },
      });
    });
    return NextResponse.json({ id, name: payload.name }, { status: 201 });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.letter.library.error', error: error });
    return NextResponse.json({ error: 'Failed to create letter library row' }, { status: 500 });
  }
}
