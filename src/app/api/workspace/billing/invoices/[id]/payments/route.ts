import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';
import { logServerEvent } from '@/lib/server-logger';
import { applyLedgerCommand } from '@/lib/billing-store';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/invoice-ledger';
import { ledgerResponse, requestIp } from '../../ledger-response';

type RouteContext = { params: Promise<{ id: string }> };

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest, context: RouteContext) {
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

  if (body.kind !== 'payment' && body.kind !== 'refund') {
    return NextResponse.json({ error: 'kind must be payment or refund' }, { status: 400 });
  }
  if (typeof body.method !== 'string' || !PAYMENT_METHODS.includes(body.method as PaymentMethod)) {
    return NextResponse.json({ error: `method must be one of ${PAYMENT_METHODS.join(', ')}` }, { status: 400 });
  }
  if (typeof body.amountCents !== 'number') {
    return NextResponse.json({ error: 'amountCents must be a number' }, { status: 400 });
  }
  const receivedAt = typeof body.receivedAt === 'string' ? new Date(body.receivedAt) : null;
  if (!receivedAt || Number.isNaN(receivedAt.getTime())) {
    return NextResponse.json({ error: 'receivedAt must be a date' }, { status: 400 });
  }

  try {
    const outcome = await applyLedgerCommand({
      invoiceId: id,
      command: {
        type: body.kind === 'payment' ? 'record_payment' : 'record_refund',
        method: body.method as PaymentMethod,
        amountCents: body.amountCents,
        receivedAt,
        reference: optionalText(body.reference),
        notes: optionalText(body.notes),
      },
      actorUserId: adminUser.id,
      ipAddress: requestIp(request.headers),
      now: new Date(),
    });
    return ledgerResponse(outcome);
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.workspace.billing.invoices.payments.error', error });
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
