import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { disputes } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { buildLetterLintContextForDispute } from '@/lib/letter-lint-context';
import { lintGeneratedLetter } from '@/lib/letter-lint';
import { logServerEvent } from '@/lib/server-logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseReasonCodes(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((code): code is string => typeof code === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await requireCapability('letters:write');
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    const [dispute] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });

    const lint = lintGeneratedLetter(body.content, buildLetterLintContextForDispute({
      reasonCodes: parseReasonCodes(dispute.reasonCodes),
      creditorName: dispute.creditorName,
      accountNumber: dispute.accountNumber,
      bureau: dispute.bureau,
      letterContextSnapshot: dispute.letterContextSnapshot,
    }));
    return NextResponse.json({ ...lint, preview: true });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.disputes.id.letter.lint.error', error: error });
    return NextResponse.json({ error: 'Failed to lint dispute letter' }, { status: 500 });
  }
}
