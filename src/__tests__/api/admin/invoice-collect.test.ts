import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { COMPLIANCE_GATE_CHECKS } from '@/lib/compliance-gate';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

const headersMock = vi.hoisted(() => vi.fn());
const requireCapabilityMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  requireCapability: requireCapabilityMock,
}));

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

const now = new Date('2026-06-01T00:00:00.000Z');

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invoice-1',
    clientId: 'client-1',
    amount: 15000,
    status: 'pending',
    ...overrides,
  };
}

function authorizationRow() {
  return {
    id: 'auth-1',
    clientId: 'client-1',
    status: 'active',
    bankName: 'First Bank',
    accountLast4: '6789',
    accountType: 'checking',
    maximumAmountCents: 20000,
    signedAt: now,
    revokedAt: null,
    expiresAt: null,
  };
}

function selectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe('POST /api/workspace/billing/invoices/[id]/collect', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'staff-1', email: 'staff@example.com', role: 'staff' });
    headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '127.0.0.1' }));
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  function mockFacts(options: {
    engagementStatus: string | null;
    closedAt: Date | null;
    gatePassed: boolean;
  }) {
    const engagementId = 'engagement-1';
    dbMock.select
      .mockReturnValueOnce(selectChain([invoiceRow()]))
      .mockReturnValueOnce(selectChain([authorizationRow()]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([{
              details: JSON.stringify({ service_engagement_id: engagementId }),
              createdAt: now,
            }]),
          }),
        }),
      })
      .mockReturnValueOnce(selectChain(options.engagementStatus === null ? [] : [{
        status: options.engagementStatus,
        closedAt: options.closedAt,
      }]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            options.gatePassed
              ? COMPLIANCE_GATE_CHECKS.map((check) => ({
                checkKey: check.key,
                passed: true,
                checkedAt: now,
                notes: null,
              }))
              : [],
          ),
        }),
      })
      .mockReturnValueOnce(selectChain([{ id: 'event-1' }]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ feeModel: 'flat_fee' }]),
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce(selectChain([{ clientId: 'client-1' }]));
  }

  it('refuses an open engagement and writes an audit row without updating the invoice', async () => {
    const { POST } = await import('@/app/api/workspace/billing/invoices/[id]/collect/route');
    mockFacts({ engagementStatus: 'active', closedAt: null, gatePassed: true });

    const response = await POST(
      new NextRequest('http://localhost/api/workspace/billing/invoices/invoice-1/collect', { method: 'POST' }),
      { params: Promise.resolve({ id: 'invoice-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ outcome: 'blocked_services_not_complete' });
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    const auditValues = dbMock.insert.mock.results[0]?.value.values;
    expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({
      action: 'collection_refused',
      invoiceId: 'invoice-1',
    }));
    expect(JSON.parse(auditValues.mock.calls[0][0].details).outcome).toBe('blocked_services_not_complete');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('refuses the instrument after the engagement is closed and writes no invoice update', async () => {
    const { POST } = await import('@/app/api/workspace/billing/invoices/[id]/collect/route');
    mockFacts({ engagementStatus: 'closed', closedAt: now, gatePassed: true });

    const response = await POST(
      new NextRequest('http://localhost/api/workspace/billing/invoices/invoice-1/collect', { method: 'POST' }),
      { params: Promise.resolve({ id: 'invoice-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ outcome: 'blocked_instrument' });
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});
