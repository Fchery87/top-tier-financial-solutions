import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';
import { logServerEvent } from '@/lib/server-logger';
import { applyLedgerCommand } from '@/lib/billing-store';
import { ledgerResponse, requestIp } from '../../ledger-response';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const adminUser = await requireCapability('billing:client');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  let body: { reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const outcome = await applyLedgerCommand({
      invoiceId: id,
      command: { type: 'void', reason: typeof body.reason === 'string' ? body.reason.trim() : '' },
      actorUserId: adminUser.id,
      ipAddress: requestIp(request.headers),
      now: new Date(),
    });
    return ledgerResponse(outcome);
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.workspace.billing.invoices.void.error', error });
    return NextResponse.json({ error: 'Failed to void invoice' }, { status: 500 });
  }
}
