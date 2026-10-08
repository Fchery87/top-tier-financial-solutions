import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { LoadedPayableFacts } from '@/lib/billing-facts';
import { gateRecordsFor, queryChain } from '@/__tests__/fixtures/compliance-gate';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(),
}));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const loadPayableFactsMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/billing-facts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/billing-facts')>()),
  loadPayableFacts: loadPayableFactsMock,
}));

const now = new Date('2026-04-01T12:00:00.000Z');
const context = { params: Promise.resolve({ id: 'invoice-1' }) };

const storedInvoice = {
  id: 'invoice-1',
  clientId: 'client-1',
  amount: 10000,
  status: 'pending',
  paidAt: null,
  paymentMethod: null,
  refundedAt: null,
  refundReason: null,
};

function payableFacts(salesChannel: 'online' | null): LoadedPayableFacts {
  const gateRecords = gateRecordsFor();
  return {
    clientId: 'client-1',
    feePlan: null,
    gateRecords,
    facts: {
      blockingGateChecks: [],
      hasServicesRenderedEvent: true,
      feeModel: 'flat_fee',
      engagement: {
        status: 'active',
        salesChannel,
        servicePeriodEndsAt: null,
        resultsAchievedAt: null,
        resultsVerificationReportDate: null,
        resultsVerifiedAt: null,
      },
      now,
    },
  };
}

function setupLedger(options: { invoice?: Record<string, unknown>; entries?: unknown[] } = {}) {
  const invoice = { ...storedInvoice, ...options.invoice };
  dbMock.select.mockReturnValueOnce(queryChain([{ id: invoice.id, serviceEngagementId: 'engagement-1' }]));
  const ledgerInsert = queryChain(undefined);
  const auditInsert = queryChain(undefined);
  const invoiceUpdate = queryChain(undefined);
  const tx = {
    select: vi.fn()
      .mockReturnValueOnce(queryChain([invoice]))
      .mockReturnValueOnce(queryChain(options.entries ?? [])),
    insert: vi.fn(),
    update: vi.fn().mockReturnValue(invoiceUpdate),
  };
  dbMock.transaction.mockImplementationOnce(async (callback: (executor: typeof tx) => Promise<unknown>) => callback(tx));
  return { tx, ledgerInsert, auditInsert, invoiceUpdate };
}

function postPayment(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/workspace/billing/invoices/invoice-1/payments', {
    method: 'POST',
    headers: { 'x-forwarded-for': '10.0.0.5, 10.0.0.1' },
    body: JSON.stringify(body),
  });
}

const payment = {
  kind: 'payment',
  method: 'zelle',
  amountCents: 10000,
  reference: 'ZL-778',
  receivedAt: '2026-03-30T00:00:00.000Z',
  notes: null,
};

describe('POST /api/workspace/billing/invoices/[id]/payments', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    requireCapabilityMock.mockResolvedValue({ id: 'staff-1', email: 'staff@example.com', role: 'staff' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records a full payment, marks the invoice paid and writes the audit row', async () => {
    const { POST } = await import('@/app/api/workspace/billing/invoices/[id]/payments/route');
    loadPayableFactsMock.mockResolvedValue(payableFacts('online'));
    const { tx, ledgerInsert, auditInsert, invoiceUpdate } = setupLedger();
    tx.insert.mockReturnValueOnce(ledgerInsert).mockReturnValueOnce(auditInsert);

    const response = await POST(postPayment(payment), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireCapabilityMock).toHaveBeenCalledWith('billing:client');
    expect(body).toEqual({
      entry_id: expect.any(String),
      status: 'paid',
      paid_cents: 10000,
      refunded_cents: 0,
      net_paid_cents: 10000,
      balance_cents: 0,
    });
    expect(ledgerInsert.values).toHaveBeenCalledWith(expect.objectContaining({
      id: body.entry_id,
      invoiceId: 'invoice-1',
      clientId: 'client-1',
      kind: 'payment',
      method: 'zelle',
      amountCents: 10000,
      reference: 'ZL-778',
      receivedAt: new Date('2026-03-30T00:00:00.000Z'),
      recordedById: 'staff-1',
    }));
    expect(invoiceUpdate.set).toHaveBeenCalledWith({
      status: 'paid',
      paidAt: new Date('2026-03-30T00:00:00.000Z'),
      paymentMethod: 'zelle',
      refundedAt: null,
      refundAmount: null,
      refundReason: null,
      updatedAt: now,
    });
    const audit = auditInsert.values.mock.calls[0][0] as { action: string; ipAddress: string; details: string };
    expect(audit.action).toBe('payment_recorded');
    expect(audit.ipAddress).toBe('10.0.0.5');
    expect(JSON.parse(audit.details)).toMatchObject({ previous_status: 'pending', status: 'paid', net_paid_cents: 10000 });
  });

  it('refuses a payment while the invoice is not payable and writes nothing', async () => {
    const { POST } = await import('@/app/api/workspace/billing/invoices/[id]/payments/route');
    loadPayableFactsMock.mockResolvedValue(payableFacts(null));
    const { tx } = setupLedger();

    const response = await POST(postPayment(payment), context);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'This invoice is not payable yet',
      code: 'INVOICE_NOT_PAYABLE',
      blockers: [{
        kind: 'sales_channel_unknown',
        message: 'Record how this sale was made (telemarketing, online or in person) before invoicing.',
      }],
    });
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('refuses a payment above the remaining balance', async () => {
    const { POST } = await import('@/app/api/workspace/billing/invoices/[id]/payments/route');
    loadPayableFactsMock.mockResolvedValue(payableFacts('online'));
    const { tx } = setupLedger({ entries: [{ kind: 'payment', amountCents: 6000, receivedAt: new Date('2026-03-01T00:00:00.000Z') }] });

    const response = await POST(postPayment({ ...payment, amountCents: 4001 }), context);

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('AMOUNT_EXCEEDS_BALANCE');
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('records a partial refund and returns the invoice to pending', async () => {
    const { POST } = await import('@/app/api/workspace/billing/invoices/[id]/payments/route');
    loadPayableFactsMock.mockResolvedValue(payableFacts('online'));
    const { tx, ledgerInsert, auditInsert, invoiceUpdate } = setupLedger({
      invoice: { status: 'paid', paidAt: new Date('2026-03-01T00:00:00.000Z'), paymentMethod: 'check' },
      entries: [{ kind: 'payment', amountCents: 10000, receivedAt: new Date('2026-03-01T00:00:00.000Z') }],
    });
    tx.insert.mockReturnValueOnce(ledgerInsert).mockReturnValueOnce(auditInsert);

    const response = await POST(postPayment({ ...payment, kind: 'refund', method: 'check', amountCents: 2500, notes: 'Goodwill' }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: 'pending', net_paid_cents: 7500, balance_cents: 2500, refunded_cents: 2500 });
    expect(invoiceUpdate.set).toHaveBeenCalledWith({
      status: 'pending',
      paidAt: null,
      paymentMethod: 'check',
      refundedAt: new Date('2026-03-30T00:00:00.000Z'),
      refundAmount: 2500,
      refundReason: 'Goodwill',
      updatedAt: now,
    });
    expect((auditInsert.values.mock.calls[0][0] as { action: string }).action).toBe('refund_recorded');
  });

  it('rejects an unknown method before touching the database', async () => {
    const { POST } = await import('@/app/api/workspace/billing/invoices/[id]/payments/route');

    const response = await POST(postPayment({ ...payment, method: 'demand_draft' }), context);

    expect(response.status).toBe(400);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown invoice', async () => {
    const { POST } = await import('@/app/api/workspace/billing/invoices/[id]/payments/route');
    dbMock.select.mockReturnValueOnce(queryChain([]));

    const response = await POST(postPayment(payment), context);

    expect(response.status).toBe(404);
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });
});

describe('POST /api/workspace/billing/invoices/[id]/void', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    requireCapabilityMock.mockResolvedValue({ id: 'staff-1', email: 'staff@example.com', role: 'staff' });
    loadPayableFactsMock.mockResolvedValue(payableFacts('online'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function postVoid(reason: unknown) {
    return new NextRequest('http://localhost/api/workspace/billing/invoices/invoice-1/void', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  it('voids an unpaid invoice and logs the reason', async () => {
    const { POST } = await import('@/app/api/workspace/billing/invoices/[id]/void/route');
    const { tx, auditInsert, invoiceUpdate } = setupLedger();
    tx.insert.mockReturnValueOnce(auditInsert);

    const response = await POST(postVoid('Wrong amount'), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      entry_id: null,
      status: 'void',
      paid_cents: 0,
      refunded_cents: 0,
      net_paid_cents: 0,
      balance_cents: 10000,
    });
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(invoiceUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'void', paidAt: null }));
    const audit = auditInsert.values.mock.calls[0][0] as { action: string; details: string };
    expect(audit.action).toBe('invoice_voided');
    expect(JSON.parse(audit.details).void_reason).toBe('Wrong amount');
  });

  it('refuses to void while money is still held', async () => {
    const { POST } = await import('@/app/api/workspace/billing/invoices/[id]/void/route');
    const { tx } = setupLedger({ entries: [{ kind: 'payment', amountCents: 500, receivedAt: new Date('2026-03-01T00:00:00.000Z') }] });

    const response = await POST(postVoid('Wrong amount'), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'Refund every payment before voiding this invoice',
      code: 'VOID_REQUIRES_ZERO_NET_PAID',
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('requires a reason', async () => {
    const { POST } = await import('@/app/api/workspace/billing/invoices/[id]/void/route');
    setupLedger();

    const response = await POST(postVoid(''), context);

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('VOID_REASON_REQUIRED');
  });
});
