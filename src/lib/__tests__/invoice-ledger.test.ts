import { describe, expect, it } from 'vitest';
import {
  decideLedgerCommand,
  summarizeInvoice,
  type LedgerEntry,
  type LedgerState,
} from '@/lib/invoice-ledger';

const now = new Date('2026-05-01T12:00:00.000Z');
const day = new Date('2026-04-20T00:00:00.000Z');

const payment = (amountCents: number): LedgerEntry => ({ kind: 'payment', amountCents, receivedAt: day });
const refund = (amountCents: number): LedgerEntry => ({ kind: 'refund', amountCents, receivedAt: day });

function state(overrides: Partial<LedgerState> = {}): LedgerState {
  return {
    invoice: { amountCents: 10000, status: 'pending' },
    entries: [],
    payable: { payable: true },
    now,
    ...overrides,
  };
}

const entryInput = { method: 'zelle' as const, receivedAt: day, reference: 'ZL-1', notes: null };

describe('summarizeInvoice', () => {
  it('reports a full balance on a pending invoice with no entries', () => {
    expect(summarizeInvoice({ amountCents: 10000, status: 'pending' }, [])).toEqual({
      paidCents: 0, refundedCents: 0, netPaidCents: 0, balanceCents: 10000, status: 'pending',
    });
  });

  it('keeps a partially paid invoice pending', () => {
    expect(summarizeInvoice({ amountCents: 10000, status: 'pending' }, [payment(4000)])).toEqual({
      paidCents: 4000, refundedCents: 0, netPaidCents: 4000, balanceCents: 6000, status: 'pending',
    });
  });

  it('marks an invoice paid when net paid reaches the amount', () => {
    expect(summarizeInvoice({ amountCents: 10000, status: 'pending' }, [payment(4000), payment(6000)])).toEqual({
      paidCents: 10000, refundedCents: 0, netPaidCents: 10000, balanceCents: 0, status: 'paid',
    });
  });

  it('marks an invoice refunded when every payment was returned', () => {
    expect(summarizeInvoice({ amountCents: 10000, status: 'paid' }, [payment(10000), refund(10000)])).toEqual({
      paidCents: 10000, refundedCents: 10000, netPaidCents: 0, balanceCents: 10000, status: 'refunded',
    });
  });

  it('returns a partially refunded paid invoice to pending', () => {
    expect(summarizeInvoice({ amountCents: 10000, status: 'paid' }, [payment(10000), refund(2500)])).toEqual({
      paidCents: 10000, refundedCents: 2500, netPaidCents: 7500, balanceCents: 2500, status: 'pending',
    });
  });

  it('keeps void terminal and draft as draft', () => {
    expect(summarizeInvoice({ amountCents: 10000, status: 'void' }, []).status).toBe('void');
    expect(summarizeInvoice({ amountCents: 10000, status: 'draft' }, []).status).toBe('draft');
  });
});

describe('decideLedgerCommand', () => {
  it('accepts a payment up to the balance and returns the next summary', () => {
    expect(decideLedgerCommand(state({ entries: [payment(4000)] }), { type: 'record_payment', amountCents: 6000, ...entryInput }))
      .toEqual({
        ok: true,
        entry: { kind: 'payment', amountCents: 6000, ...entryInput },
        next: { paidCents: 10000, refundedCents: 0, netPaidCents: 10000, balanceCents: 0, status: 'paid' },
      });
  });

  it('rejects a payment above the balance', () => {
    expect(decideLedgerCommand(state({ entries: [payment(4000)] }), { type: 'record_payment', amountCents: 6001, ...entryInput }))
      .toEqual({ ok: false, code: 'AMOUNT_EXCEEDS_BALANCE', reason: 'Payment is larger than the remaining balance' });
  });

  it('rejects a payment on an invoice that is not pending', () => {
    expect(decideLedgerCommand(state({ invoice: { amountCents: 10000, status: 'draft' } }), { type: 'record_payment', amountCents: 100, ...entryInput }))
      .toMatchObject({ ok: false, code: 'INVOICE_NOT_PENDING' });
    expect(decideLedgerCommand(state({ invoice: { amountCents: 10000, status: 'paid' }, entries: [payment(10000)] }), { type: 'record_payment', amountCents: 100, ...entryInput }))
      .toMatchObject({ ok: false, code: 'INVOICE_NOT_PENDING' });
  });

  it('rejects a payment while the invoice is not payable and carries the blockers', () => {
    expect(decideLedgerCommand(
      state({ payable: { payable: false, blockers: [{ kind: 'sales_channel_unknown' }] } }),
      { type: 'record_payment', amountCents: 100, ...entryInput },
    )).toEqual({
      ok: false,
      code: 'INVOICE_NOT_PAYABLE',
      reason: 'This invoice is not payable yet',
      blockers: [{ kind: 'sales_channel_unknown' }],
    });
  });

  it('rejects zero, negative and fractional amounts', () => {
    for (const amountCents of [0, -100, 10.5]) {
      expect(decideLedgerCommand(state(), { type: 'record_payment', amountCents, ...entryInput }))
        .toMatchObject({ ok: false, code: 'AMOUNT_INVALID' });
    }
  });

  it('rejects a received date in the future', () => {
    expect(decideLedgerCommand(state(), {
      type: 'record_payment', amountCents: 100, ...entryInput, receivedAt: new Date('2026-05-01T12:00:01.000Z'),
    })).toMatchObject({ ok: false, code: 'RECEIVED_AT_IN_FUTURE' });
  });

  it('accepts a refund up to net paid, even while the invoice is not payable', () => {
    expect(decideLedgerCommand(
      state({ invoice: { amountCents: 10000, status: 'paid' }, entries: [payment(10000)], payable: { payable: false, blockers: [{ kind: 'no_services_rendered' }] } }),
      { type: 'record_refund', amountCents: 10000, ...entryInput },
    )).toEqual({
      ok: true,
      entry: { kind: 'refund', amountCents: 10000, ...entryInput },
      next: { paidCents: 10000, refundedCents: 10000, netPaidCents: 0, balanceCents: 10000, status: 'refunded' },
    });
  });

  it('rejects a refund above net paid', () => {
    expect(decideLedgerCommand(state({ entries: [payment(3000), refund(1000)] }), { type: 'record_refund', amountCents: 2001, ...entryInput }))
      .toEqual({ ok: false, code: 'REFUND_EXCEEDS_NET_PAID', reason: 'Refund is larger than the amount paid' });
  });

  it('voids an invoice with nothing net paid', () => {
    expect(decideLedgerCommand(state({ entries: [payment(3000), refund(3000)] }), { type: 'void', reason: 'Wrong amount' })).toEqual({
      ok: true,
      entry: null,
      next: { paidCents: 3000, refundedCents: 3000, netPaidCents: 0, balanceCents: 10000, status: 'void' },
    });
  });

  it('refuses to void an invoice with money still held', () => {
    expect(decideLedgerCommand(state({ entries: [payment(3000)] }), { type: 'void', reason: 'Wrong amount' }))
      .toEqual({ ok: false, code: 'VOID_REQUIRES_ZERO_NET_PAID', reason: 'Refund every payment before voiding this invoice' });
  });

  it('requires a void reason and treats void as terminal', () => {
    expect(decideLedgerCommand(state(), { type: 'void', reason: '  ' }))
      .toMatchObject({ ok: false, code: 'VOID_REASON_REQUIRED' });
    expect(decideLedgerCommand(state({ invoice: { amountCents: 10000, status: 'void' } }), { type: 'record_refund', amountCents: 1, ...entryInput }))
      .toEqual({ ok: false, code: 'INVOICE_VOID', reason: 'This invoice is void' });
  });
});
