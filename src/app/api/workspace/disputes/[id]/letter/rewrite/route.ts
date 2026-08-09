import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { disputes, negativeItems } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { buildLetterLintContextForDispute } from '@/lib/letter-lint-context';
import { buildRewritePrompt, rewriteLetter, type LetterTone, type RewriteMode } from '@/lib/letter-rewriter';
import { saveDisputeLetter } from '@/lib/dispute-letter-workflow';
import { logServerEvent } from '@/lib/server-logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MODES = new Set<RewriteMode>(['rewrite', 'tone', 'custom']);
const TONES = new Set<LetterTone>(['professional', 'concerned', 'annoyed', 'disappointed', 'demanding']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseReasonCodes(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await requireCapability('letters:write');
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await context.params;

  try {
    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody)) return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });

    const modeValue = rawBody.mode;
    const mode = typeof modeValue === 'string' && MODES.has(modeValue as RewriteMode)
      ? modeValue as RewriteMode
      : null;
    if (!mode) return NextResponse.json({ error: 'mode must be rewrite, tone, or custom' }, { status: 400 });

    const toneValue = rawBody.tone;
    const tone = typeof toneValue === 'string' && TONES.has(toneValue as LetterTone)
      ? toneValue as LetterTone
      : undefined;
    if (mode === 'tone' && !tone) return NextResponse.json({ error: 'tone is required for tone mode' }, { status: 400 });

    const instruction = typeof rawBody.instruction === 'string' ? rawBody.instruction.trim() : undefined;
    const selectedText = typeof rawBody.selectedText === 'string' ? rawBody.selectedText : undefined;
    const expectedSelectedText = typeof rawBody.expectedSelectedText === 'string' ? rawBody.expectedSelectedText : selectedText;
    const selectionStart = typeof rawBody.selectionStart === 'number' && Number.isInteger(rawBody.selectionStart)
      ? rawBody.selectionStart
      : undefined;
    const selectionEnd = typeof rawBody.selectionEnd === 'number' && Number.isInteger(rawBody.selectionEnd)
      ? rawBody.selectionEnd
      : undefined;
    const expectedRevision = typeof rawBody.expectedRevision === 'number' ? rawBody.expectedRevision : undefined;
    const acknowledgeWarnings = rawBody.acknowledgeWarnings === true;

    const [dispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, id))
      .limit(1);
    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    if (!dispute.letterContent?.trim()) return NextResponse.json({ error: 'This dispute does not have a letter to rewrite' }, { status: 400 });
    if (dispute.status === 'sent' || dispute.sentAt) {
      return NextResponse.json({ error: 'This letter has already been sent and cannot be rewritten. Start a new round instead.' }, { status: 409 });
    }

    let negativeItem: typeof negativeItems.$inferSelect | null = null;
    if (dispute.negativeItemId) {
      const [item] = await db
        .select()
        .from(negativeItems)
        .where(eq(negativeItems.id, dispute.negativeItemId))
        .limit(1);
      negativeItem = item || null;
    }

    const lintContext = buildLetterLintContextForDispute({
      reasonCodes: parseReasonCodes(dispute.reasonCodes),
      creditorName: dispute.creditorName || negativeItem?.creditorName,
      originalCreditor: negativeItem?.originalCreditor,
      accountNumber: dispute.accountNumber || negativeItem?.id.slice(-4),
      bureau: dispute.bureau,
      letterContextSnapshot: dispute.letterContextSnapshot,
    });
    let selectedStart: number | undefined = selectionStart;
    let selectedEnd: number | undefined = selectionEnd;
    if ((selectedStart === undefined) !== (selectedEnd === undefined)) {
      return NextResponse.json({ error: 'selectionStart and selectionEnd must be provided together' }, { status: 400 });
    }
    if (selectedStart !== undefined && selectedEnd !== undefined) {
      if (selectedStart < 0 || selectedEnd <= selectedStart || selectedEnd > dispute.letterContent.length) {
        return NextResponse.json({ error: 'Invalid letter selection' }, { status: 400 });
      }
      if (!expectedSelectedText || dispute.letterContent.slice(selectedStart, selectedEnd) !== expectedSelectedText) {
        return NextResponse.json({ error: 'selection_conflict' }, { status: 409 });
      }
    } else if (selectedText) {
      const firstIndex = dispute.letterContent.indexOf(selectedText);
      const secondIndex = firstIndex < 0 ? -1 : dispute.letterContent.indexOf(selectedText, firstIndex + selectedText.length);
      if (firstIndex < 0 || secondIndex >= 0) return NextResponse.json({ error: 'selection_conflict' }, { status: 409 });
      selectedStart = firstIndex;
      selectedEnd = firstIndex + selectedText.length;
    }

    const sourceText = selectedStart !== undefined && selectedEnd !== undefined
      ? dispute.letterContent.slice(selectedStart, selectedEnd)
      : dispute.letterContent;
    const result = await rewriteLetter({
      currentLetter: sourceText,
      mode,
      tone,
      instruction,
      lintContext,
    });
    if (result.blocked) {
      const findings = result.findings;
      return NextResponse.json({ error: 'This rewrite references data that is not in the client file.', findings, attempts: result.attempts }, { status: 422 });
    }

    const updatedLetter = selectedStart !== undefined && selectedEnd !== undefined
      ? `${dispute.letterContent.slice(0, selectedStart)}${result.letter}${dispute.letterContent.slice(selectedEnd)}`
      : result.letter;
    const saveResult = await saveDisputeLetter({
      disputeId: id,
      content: updatedLetter,
      source: mode === 'tone' ? 'ai_tone' : 'ai_rewrite',
      actorUserId: user.id,
      acknowledgeWarnings,
      expectedRevision,
      toneLabel: tone || null,
      promptUsed: buildRewritePrompt({ currentLetter: sourceText, mode, tone, instruction, lintContext }),
    });

    if (saveResult.kind === 'immutable') return NextResponse.json({ error: 'This letter is immutable' }, { status: 409 });
    if (saveResult.kind === 'conflict') return NextResponse.json({ error: 'conflict', ...saveResult }, { status: 409 });
    if (saveResult.kind === 'blocked') return NextResponse.json({ error: 'This rewrite references data that is not in the client file.', ...saveResult, attempts: result.attempts }, { status: 422 });
    if (saveResult.kind === 'warnings') return NextResponse.json({ error: 'needs_acknowledgement', letter: updatedLetter, ...saveResult, attempts: result.attempts }, { status: 409 });

    return NextResponse.json({ letter: saveResult.content, findings: saveResult.findings, revision: saveResult.revision, attempts: result.attempts });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.disputes.id.letter.rewrite.error', error: error });
    return NextResponse.json({ error: 'Failed to rewrite dispute letter' }, { status: 500 });
  }
}
