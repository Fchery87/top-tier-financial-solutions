import { NextRequest, NextResponse } from 'next/server';
import { buildComplianceGateStatus, isAttestedCheckKey } from '@/lib/compliance-gate';
import { attestComplianceGateCheck, syncComplianceGate } from '@/lib/compliance-gate-sync';
import { requireCapability } from '@/lib/admin-session';
import { logServerEvent } from '@/lib/server-logger';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const adminUser = await requireCapability('agreements:read');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const records = await syncComplianceGate(id);
    if (!records) {
      return NextResponse.json({ error: 'Service engagement not found' }, { status: 404 });
    }

    return NextResponse.json({
      engagement_id: id,
      ...buildComplianceGateStatus(records),
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.service.engagements.id.compliance.gate.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch compliance gate status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const adminUser = await requireCapability('agreements:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  let body: { checkKey?: unknown; passed?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { checkKey, passed, notes } = body;
  if (typeof checkKey !== 'string' || !isAttestedCheckKey(checkKey)) {
    return NextResponse.json({
      error: 'Only staff-attested checks can be set here; the rest are derived from records',
      code: 'CHECK_NOT_ATTESTABLE',
    }, { status: 400 });
  }
  if (typeof passed !== 'boolean') {
    return NextResponse.json({ error: 'passed must be true or false' }, { status: 400 });
  }
  if (typeof notes !== 'string' || !notes.trim()) {
    return NextResponse.json({ error: 'A note is required for an attestation' }, { status: 400 });
  }

  try {
    const now = new Date();
    const existing = await syncComplianceGate(id, now);
    if (!existing) {
      return NextResponse.json({ error: 'Service engagement not found' }, { status: 404 });
    }

    await attestComplianceGateCheck({
      engagementId: id,
      checkKey,
      passed,
      notes: notes.trim(),
      actorUserId: adminUser.id,
      now,
    });

    const records = await syncComplianceGate(id, now);
    return NextResponse.json({
      engagement_id: id,
      ...buildComplianceGateStatus(records ?? []),
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.workspace.service.engagements.id.compliance.gate.attest.error', error });
    return NextResponse.json({ error: 'Failed to update compliance gate check' }, { status: 500 });
  }
}
