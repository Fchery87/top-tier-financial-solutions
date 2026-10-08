import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requireCapability } from '@/lib/admin-session';
import { decideChargeRefusal } from '@/lib/payment-authorization/decide';
import { loadChargeFacts, recordCollectionRefusal } from '@/lib/payment-authorization/store';
import type { ChargeRefusal } from '@/lib/payment-authorization/types';

function refusalBody(refusal: ChargeRefusal) {
  const body: {
    outcome: ChargeRefusal['outcome'];
    blocking_checks?: string[];
    invoice_amount_cents?: number;
    maximum_amount_cents?: number;
  } = { outcome: refusal.outcome };

  if (refusal.outcome === 'blocked_compliance_gate') {
    body.blocking_checks = refusal.blockingChecks;
  }
  if (refusal.outcome === 'blocked_above_cap') {
    body.invoice_amount_cents = refusal.invoiceAmountCents;
    body.maximum_amount_cents = refusal.maximumAmountCents;
  }
  return body;
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const adminUser = await requireCapability('billing:client');
    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const now = new Date();
    const loaded = await loadChargeFacts({ invoiceId: id, now });
    if (!loaded.found) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (loaded.facts.invoiceStatus !== 'pending') {
      return NextResponse.json(
        { error: 'Only a pending invoice can be submitted for collection' },
        { status: 409 },
      );
    }

    const refusal = decideChargeRefusal(loaded.facts);
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null;

    await recordCollectionRefusal({
      invoiceId: id,
      outcome: refusal,
      authorizationId: loaded.facts.authorization?.id ?? null,
      performedById: adminUser.id,
      ipAddress,
      now,
    });

    return NextResponse.json(refusalBody(refusal), { status: 409 });
  } catch (error) {
    console.error('Error refusing collection:', error);
    return NextResponse.json({ error: 'Failed to submit invoice for collection' }, { status: 500 });
  }
}
