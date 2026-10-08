import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { disputeLetterLibrary, disputeLetterRevisions, disputes } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { buildLetterLintContextForDispute } from '@/lib/letter-lint-context';
import { lintGeneratedLetter } from '@/lib/letter-lint';
import { recordAdminActivity } from '@/lib/admin-activity';
import { logRequest } from '@/lib/request-log';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

export async function GET(_request: NextRequest, context: RouteContext) {
  const started = Date.now();
  const user = await requireCapability('disputes:read');
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;
  try {
    const [dispute] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });

    await recordAdminActivity(db, {
      actorUserId: user.id,
      action: 'dispute_letter.viewed',
      subjectType: 'dispute_letter',
      subjectId: id,
    });
    logRequest({
      requestId: _request.headers.get('x-request-id') ?? id,
      method: 'GET',
      path: `/api/admin/disputes/${id}/letter`,
      status: 200,
      durationMs: Date.now() - started,
      actorId: user.id,
    });

    const revisions = await db
      .select()
      .from(disputeLetterRevisions)
      .where(eq(disputeLetterRevisions.disputeId, id))
      .orderBy(desc(disputeLetterRevisions.revision));
    const library = dispute.letterTemplateId
      ? (await db.select().from(disputeLetterLibrary).where(eq(disputeLetterLibrary.id, dispute.letterTemplateId)).limit(1))[0] || null
      : null;
    const lint = lintGeneratedLetter(dispute.letterContent || '', buildLetterLintContextForDispute({
      reasonCodes: parseReasonCodes(dispute.reasonCodes),
      creditorName: dispute.creditorName,
      accountNumber: dispute.accountNumber,
      bureau: dispute.bureau,
      letterContextSnapshot: dispute.letterContextSnapshot,
    }));

    const latestRevision = revisions[0] || null;
    return NextResponse.json({
      dispute_id: dispute.id,
      content: dispute.letterContent || '',
      current_revision: latestRevision?.revision || 0,
      immutable_reason: dispute.status === 'sent' || dispute.sentAt
        ? 'This dispute has been sent and its letter is immutable.'
        : null,
      lint,
      library: library ? {
        id: library.id,
        name: library.name,
        methodology: library.methodology,
        target_recipient: library.targetRecipient,
        rationale: parseJsonObject(latestRevision?.generationMetadata || null),
      } : null,
      revisions: revisions.map((revision) => ({
        id: revision.id,
        revision: revision.revision,
        source: revision.source,
        tone_label: revision.toneLabel,
        warnings_acknowledged: revision.warningsAcknowledged,
        acknowledged_by: revision.acknowledgedBy,
        created_by: revision.createdBy,
        created_at: revision.createdAt?.toISOString() || null,
        content: revision.content,
        lint_findings: parseJsonObject(revision.lintFindings),
        generation_metadata: parseJsonObject(revision.generationMetadata),
      })),
      user_id: user.id,
    });
  } catch (error) {
    console.error('Error loading dispute letter state:', error);
    return NextResponse.json({ error: 'Failed to load letter state' }, { status: 500 });
  }
}
