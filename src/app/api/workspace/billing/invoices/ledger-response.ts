import { NextResponse } from 'next/server';
import { describeBlocker } from '@/lib/billing-readiness';
import type { ApplyLedgerResult } from '@/lib/billing-store';
import type { LedgerRejectionCode } from '@/lib/invoice-ledger';

const BAD_INPUT: ReadonlySet<LedgerRejectionCode> = new Set([
  'AMOUNT_INVALID',
  'RECEIVED_AT_IN_FUTURE',
  'VOID_REASON_REQUIRED',
]);

export function ledgerResponse(outcome: ApplyLedgerResult) {
  if (outcome.result === 'not_found') {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }
  if (outcome.result === 'rejected') {
    const { code, reason, blockers } = outcome.decision;
    return NextResponse.json({
      error: reason,
      code,
      ...(blockers ? { blockers: blockers.map((blocker) => ({ kind: blocker.kind, message: describeBlocker(blocker) })) } : {}),
    }, { status: BAD_INPUT.has(code) ? 400 : 409 });
  }
  const { summary } = outcome;
  return NextResponse.json({
    entry_id: outcome.entryId,
    status: summary.status,
    paid_cents: summary.paidCents,
    refunded_cents: summary.refundedCents,
    net_paid_cents: summary.netPaidCents,
    balance_cents: summary.balanceCents,
  });
}

export function requestIp(headers: Headers): string | null {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}
