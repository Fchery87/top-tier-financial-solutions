import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';
import { logServerEvent } from '@/lib/server-logger';
import { SALES_CHANNELS, type SalesChannel } from '@/lib/billing-readiness';
import { updateEngagementBillingFacts, type BillingFactsPatch } from '@/lib/billing-store';

type RouteContext = { params: Promise<{ id: string }> };

type ParsedPatch = { ok: true; patch: BillingFactsPatch } | { ok: false; error: string };

function parseDateField(body: Record<string, unknown>, field: string): Date | null | undefined | 'invalid' {
  if (!(field in body)) return undefined;
  const value = body[field];
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return 'invalid';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'invalid' : date;
}

function parsePatch(body: Record<string, unknown>): ParsedPatch {
  const patch: BillingFactsPatch = {};

  if ('salesChannel' in body) {
    const value = body.salesChannel;
    if (value !== null && !SALES_CHANNELS.includes(value as SalesChannel)) {
      return { ok: false, error: `salesChannel must be one of ${SALES_CHANNELS.join(', ')} or null` };
    }
    patch.salesChannel = value as SalesChannel | null;
  }

  for (const field of ['servicePeriodEndsAt', 'resultsAchievedAt'] as const) {
    const parsed = parseDateField(body, field);
    if (parsed === 'invalid') return { ok: false, error: `${field} must be a date or null` };
    if (parsed !== undefined) patch[field] = parsed;
  }

  if ('resultsVerificationReportId' in body) {
    const value = body.resultsVerificationReportId;
    if (value !== null && (typeof value !== 'string' || !value)) {
      return { ok: false, error: 'resultsVerificationReportId must be a report id or null' };
    }
    patch.resultsVerificationReportId = value as string | null;
  }

  return { ok: true, patch };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const adminUser = await requireCapability('billing:client');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parsePatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const outcome = await updateEngagementBillingFacts({
      engagementId: id,
      patch: parsed.patch,
      actorUserId: adminUser.id,
      now: new Date(),
    });
    if (outcome.result === 'not_found') {
      return NextResponse.json({ error: 'Service engagement not found' }, { status: 404 });
    }
    if (outcome.result === 'rejected') {
      return NextResponse.json({ error: outcome.error }, { status: 400 });
    }
    return NextResponse.json({ updated: true });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.workspace.service.engagements.id.billing.facts.error', error });
    return NextResponse.json({ error: 'Failed to update billing facts' }, { status: 500 });
  }
}
