import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getBlockingComplianceGateChecks } from '@/lib/compliance-gate';
import type { PayableFacts } from '@/lib/billing-readiness';
import type { FeePlan, LoadedPayableFacts } from '@/lib/billing-facts';
import { READY_GATE_FACTS, gateRecordsFor, queryChain } from '@/__tests__/fixtures/compliance-gate';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
}));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const loadPayableFactsMock = vi.hoisted(() => vi.fn());
const headersMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('next/headers', () => ({ headers: headersMock }));
vi.mock('@/lib/billing-facts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/billing-facts')>()),
  loadPayableFacts: loadPayableFactsMock,
}));

const now = new Date('2026-03-10T12:00:00.000Z');
const event = { id: 'event-1', eventType: 'first_dispute_package_submitted', occurredAt: new Date('2026-03-08T00:00:00.000Z') };

const flatFeePlan: FeePlan = {
  billingProfileId: 'profile-1',
  feeConfigId: 'fee-1',
  name: 'Flat restoration',
  feeModel: 'flat_fee',
  amountCents: 9900,
  frequency: 'one_time',
  setupFeeCents: 0,
};

function loaded(options: {
  gateRecords?: ReturnType<typeof gateRecordsFor>;
  feePlan?: FeePlan | null;
  engagement?: Partial<PayableFacts['engagement']>;
} = {}): LoadedPayableFacts {
  const gateRecords = options.gateRecords ?? gateRecordsFor();
  const feePlan = options.feePlan === undefined ? flatFeePlan : options.feePlan;
  return {
    clientId: 'client-1',
    feePlan,
    gateRecords,
    facts: {
      blockingGateChecks: getBlockingComplianceGateChecks(gateRecords),
      hasServicesRenderedEvent: true,
      feeModel: feePlan?.feeModel ?? null,
      engagement: {
        status: 'active',
        salesChannel: 'online',
        servicePeriodEndsAt: null,
        resultsAchievedAt: null,
        resultsVerificationReportDate: null,
        resultsVerifiedAt: null,
        ...options.engagement,
      },
      now,
    },
  };
}

function queueLookups(options: { events?: unknown[]; invoiced?: unknown[] } = {}) {
  dbMock.select
    .mockReturnValueOnce(queryChain([{ id: 'engagement-1', serviceType: 'credit_restoration' }]))
    .mockReturnValueOnce(queryChain(options.events ?? [event]))
    .mockReturnValueOnce(queryChain(options.invoiced ?? []));
}

function captureTransaction() {
  const tx = { insert: vi.fn() };
  const invoiceInsert = queryChain(undefined);
  const auditInsert = queryChain(undefined);
  tx.insert.mockReturnValueOnce(invoiceInsert).mockReturnValueOnce(auditInsert);
  dbMock.transaction.mockImplementationOnce(async (callback: (executor: typeof tx) => Promise<void>) => callback(tx));
  return { invoiceInsert, auditInsert };
}

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/workspace/billing', {
    method: 'POST',
    body: JSON.stringify({ type: 'invoice', clientId: 'client-1', serviceEngagementId: 'engagement-1', ...body }),
  });
}

describe('POST /api/workspace/billing invoice creation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    requireCapabilityMock.mockResolvedValue({ id: 'staff-1', email: 'staff@example.com', role: 'staff' });
    headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '127.0.0.1' }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks invoice creation without a qualifying services rendered event', async () => {
    const { POST } = await import('@/app/api/workspace/billing/route');
    queueLookups({ events: [] });

    const response = await POST(createRequest({ amount: 15000 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: 'SERVICES_RENDERED_EVENT_REQUIRED',
      error: 'A qualifying Services Rendered event is required before an invoice can become payable',
    });
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('blocks invoice creation while derived gate checks fail', async () => {
    const { POST } = await import('@/app/api/workspace/billing/route');
    queueLookups();
    loadPayableFactsMock.mockResolvedValue(loaded({
      gateRecords: gateRecordsFor({ ...READY_GATE_FACTS, signedAgreement: { ...READY_GATE_FACTS.signedAgreement!, feeTermsSnapshot: null } }),
    }));

    const response = await POST(createRequest({ amount: 15000 }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      code: 'INVOICE_NOT_PAYABLE',
      error: 'This engagement cannot be invoiced yet',
      blockers: [{ kind: 'compliance_gate', message: 'The compliance gate has open checks: fee_terms_disclosed.' }],
    });
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('ignores resultVerified and feeModel in the body for a pay-per-delete plan', async () => {
    const { POST } = await import('@/app/api/workspace/billing/route');
    queueLookups();
    loadPayableFactsMock.mockResolvedValue(loaded({ feePlan: { ...flatFeePlan, feeModel: 'pay_per_delete' } }));

    const response = await POST(createRequest({ amount: 15000, feeModel: 'flat_fee', resultVerified: true }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(loadPayableFactsMock).toHaveBeenCalledWith('engagement-1', now);
    expect(body.blockers).toEqual([{
      kind: 'pay_per_delete_results_unverified',
      message: 'Pay-per-delete fees stay locked until a credit report verifying the result is recorded.',
    }]);
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('ignores resultVerified in the body for a telemarketing sale', async () => {
    const { POST } = await import('@/app/api/workspace/billing/route');
    queueLookups();
    loadPayableFactsMock.mockResolvedValue(loaded({ engagement: { salesChannel: 'telemarketing' } }));

    const response = await POST(createRequest({ amount: 15000, resultVerified: true }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.blockers.map((blocker: { kind: string }) => blocker.kind)).toEqual(['telemarketing_results_unverified']);
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('refuses a second invoice for the same services-rendered event', async () => {
    const { POST } = await import('@/app/api/workspace/billing/route');
    queueLookups({ invoiced: [{ eventId: 'event-1' }] });

    const response = await POST(createRequest({ servicesRenderedEventId: 'event-1', amount: 15000 }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('SERVICES_RENDERED_EVENT_ALREADY_INVOICED');
    expect(loadPayableFactsMock).not.toHaveBeenCalled();
  });

  it('maps a concurrent unique violation on the event index to 409', async () => {
    const { POST } = await import('@/app/api/workspace/billing/route');
    queueLookups();
    loadPayableFactsMock.mockResolvedValue(loaded());
    dbMock.transaction.mockRejectedValueOnce({ cause: { code: '23505', constraint: 'invoices_one_open_per_services_rendered_event' } });

    const response = await POST(createRequest({}));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('SERVICES_RENDERED_EVENT_ALREADY_INVOICED');
  });

  it('defaults the amount from the fee plan and links the engagement and event', async () => {
    const { POST } = await import('@/app/api/workspace/billing/route');
    queueLookups();
    loadPayableFactsMock.mockResolvedValue(loaded());
    const { invoiceInsert, auditInsert } = captureTransaction();

    const response = await POST(createRequest({ description: 'First round' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.amount).toBe(9900);
    expect(invoiceInsert.values).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-1',
      billingProfileId: 'profile-1',
      serviceEngagementId: 'engagement-1',
      servicesRenderedEventId: 'event-1',
      amount: 9900,
      status: 'pending',
      description: 'First round',
    }));
    const audit = auditInsert.values.mock.calls[0][0] as { action: string; performedById: string; ipAddress: string; details: string };
    expect(audit).toMatchObject({ action: 'invoice_created', performedById: 'staff-1', ipAddress: '127.0.0.1' });
    expect(JSON.parse(audit.details)).toEqual({
      invoice_number: body.invoiceNumber,
      amount: 9900,
      amount_source: 'fee_plan',
      fee_config_id: 'fee-1',
      readiness_reason: 'payable_decision',
      service_engagement_id: 'engagement-1',
      services_rendered_event_id: 'event-1',
      services_rendered_event_type: 'first_dispute_package_submitted',
      services_rendered_event_occurred_at: '2026-03-08T00:00:00.000Z',
    });
  });

  it('rejects a non-positive or fractional amount', async () => {
    const { POST } = await import('@/app/api/workspace/billing/route');

    for (const amount of [0, -500, 99.5, '9900']) {
      queueLookups();
      loadPayableFactsMock.mockResolvedValue(loaded());
      const response = await POST(createRequest({ amount }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe('AMOUNT_INVALID');
    }
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('asks for an amount when the client has no fee plan', async () => {
    const { POST } = await import('@/app/api/workspace/billing/route');
    queueLookups();
    loadPayableFactsMock.mockResolvedValue(loaded({ feePlan: null }));

    const response = await POST(createRequest({}));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('AMOUNT_REQUIRED');
  });

  it('retries with a new invoice number after an invoice number collision', async () => {
    const { POST } = await import('@/app/api/workspace/billing/route');
    queueLookups();
    loadPayableFactsMock.mockResolvedValue(loaded());
    dbMock.transaction.mockRejectedValueOnce({ code: '23505', constraint: 'invoices_invoice_number_unique' });
    const { invoiceInsert } = captureTransaction();

    const response = await POST(createRequest({ amount: 12000 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(dbMock.transaction).toHaveBeenCalledTimes(2);
    expect(body.invoiceNumber).toMatch(/^INV-2603-[0-9A-F]{10}$/);
    expect(invoiceInsert.values).toHaveBeenCalledWith(expect.objectContaining({ amount: 12000, invoiceNumber: body.invoiceNumber }));
  });
});
