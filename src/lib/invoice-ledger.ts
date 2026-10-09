import type { Blocker, PayableDecision } from '@/lib/billing-readiness';

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'void' | 'refunded';
export type LedgerEntryKind = 'payment' | 'refund';
export type PaymentMethod = 'zelle' | 'check' | 'bank_ach' | 'card_external' | 'other';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['zelle', 'check', 'bank_ach', 'card_external', 'other'];

export type LedgerInvoice = {
  amountCents: number;
  status: InvoiceStatus;
};

export type LedgerEntry = {
  kind: LedgerEntryKind;
  amountCents: number;
  receivedAt: Date;
};

export type InvoiceSummary = {
  paidCents: number;
  refundedCents: number;
  netPaidCents: number;
  balanceCents: number;
  status: InvoiceStatus;
};

export function summarizeInvoice(invoice: LedgerInvoice, entries: LedgerEntry[]): InvoiceSummary {
  const paidCents = entries
    .filter((entry) => entry.kind === 'payment')
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const refundedCents = entries
    .filter((entry) => entry.kind === 'refund')
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const netPaidCents = paidCents - refundedCents;
  const balanceCents = Math.max(invoice.amountCents - netPaidCents, 0);

  let status: InvoiceStatus;
  if (invoice.status === 'void') {
    status = 'void';
  } else if (netPaidCents === 0 && refundedCents > 0) {
    status = 'refunded';
  } else if (netPaidCents >= invoice.amountCents) {
    status = 'paid';
  } else {
    status = invoice.status === 'draft' ? 'draft' : 'pending';
  }

  return { paidCents, refundedCents, netPaidCents, balanceCents, status };
}

export type LedgerState = {
  invoice: LedgerInvoice;
  entries: LedgerEntry[];
  payable: PayableDecision;
  now: Date;
};

export type LedgerEntryInput = {
  method: PaymentMethod;
  amountCents: number;
  receivedAt: Date;
  reference: string | null;
  notes: string | null;
};

export type LedgerCommand =
  | ({ type: 'record_payment' } & LedgerEntryInput)
  | ({ type: 'record_refund' } & LedgerEntryInput)
  | { type: 'void'; reason: string };

export type LedgerRejectionCode =
  | 'INVOICE_VOID'
  | 'INVOICE_NOT_PENDING'
  | 'INVOICE_NOT_PAYABLE'
  | 'AMOUNT_INVALID'
  | 'RECEIVED_AT_IN_FUTURE'
  | 'AMOUNT_EXCEEDS_BALANCE'
  | 'REFUND_EXCEEDS_NET_PAID'
  | 'VOID_REQUIRES_ZERO_NET_PAID'
  | 'VOID_REASON_REQUIRED';

export type LedgerDecision =
  | {
      ok: true;
      entry: ({ kind: LedgerEntryKind } & LedgerEntryInput) | null;
      next: InvoiceSummary;
    }
  | { ok: false; code: LedgerRejectionCode; reason: string; blockers?: Blocker[] };

function reject(code: LedgerRejectionCode, reason: string, blockers?: Blocker[]): LedgerDecision {
  return blockers ? { ok: false, code, reason, blockers } : { ok: false, code, reason };
}

function validateEntry(input: LedgerEntryInput, now: Date): LedgerDecision | null {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return reject('AMOUNT_INVALID', 'Amount must be a positive whole number of cents');
  }
  if (input.receivedAt.getTime() > now.getTime()) {
    return reject('RECEIVED_AT_IN_FUTURE', 'The received date cannot be in the future');
  }
  return null;
}

export function decideLedgerCommand(state: LedgerState, command: LedgerCommand): LedgerDecision {
  const current = summarizeInvoice(state.invoice, state.entries);

  if (current.status === 'void') {
    return reject('INVOICE_VOID', 'This invoice is void');
  }

  if (command.type === 'void') {
    if (!command.reason.trim()) {
      return reject('VOID_REASON_REQUIRED', 'A reason is required to void an invoice');
    }
    if (current.netPaidCents !== 0) {
      return reject('VOID_REQUIRES_ZERO_NET_PAID', 'Refund every payment before voiding this invoice');
    }
    return {
      ok: true,
      entry: null,
      next: summarizeInvoice({ ...state.invoice, status: 'void' }, state.entries),
    };
  }

  const { type, ...input } = command;
  const invalid = validateEntry(input, state.now);
  if (invalid) return invalid;

  if (type === 'record_payment') {
    if (current.status !== 'pending') {
      return reject('INVOICE_NOT_PENDING', 'Payments can only be recorded on a pending invoice');
    }
    if (!state.payable.payable) {
      return reject('INVOICE_NOT_PAYABLE', 'This invoice is not payable yet', state.payable.blockers);
    }
    if (input.amountCents > current.balanceCents) {
      return reject('AMOUNT_EXCEEDS_BALANCE', 'Payment is larger than the remaining balance');
    }
  } else if (input.amountCents > current.netPaidCents) {
    return reject('REFUND_EXCEEDS_NET_PAID', 'Refund is larger than the amount paid');
  }

  const entry = { kind: type === 'record_payment' ? 'payment' as const : 'refund' as const, ...input };
  return {
    ok: true,
    entry,
    next: summarizeInvoice(state.invoice, [...state.entries, entry]),
  };
}
