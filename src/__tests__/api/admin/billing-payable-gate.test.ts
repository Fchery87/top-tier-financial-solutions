import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { COMPLIANCE_GATE_CHECKS } from '@/lib/compliance-gate';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const headersMock = vi.hoisted(() => vi.fn());
const adminSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  getAdminSessionUser: adminSessionMock,
}));

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

describe('POST /api/admin/billing payable invoice gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
    headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '127.0.0.1' }));
  });

  it('blocks payable invoice creation without a qualifying services rendered event', async () => {
    const { POST } = await import('@/app/api/admin/billing/route');

    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'engagement-1', serviceType: 'credit_restoration' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

    const response = await POST(new NextRequest('http://localhost/api/admin/billing', {
      method: 'POST',
      body: JSON.stringify({
        type: 'invoice',
        clientId: 'client-1',
        serviceEngagementId: 'engagement-1',
        amount: 15000,
        servicesRendered: [{ event_type: 'first_dispute_package_submitted' }],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'SERVICES_RENDERED_EVENT_REQUIRED',
      error: 'A qualifying Services Rendered event is required before an invoice can become payable',
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);

  it('blocks payable invoice creation when the Compliance Gate has blockers', async () => {
    const { POST } = await import('@/app/api/admin/billing/route');

    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'engagement-1', serviceType: 'credit_restoration' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'event-1',
              eventType: 'first_dispute_package_submitted',
              occurredAt: new Date('2026-01-01T00:00:00.000Z'),
            }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            COMPLIANCE_GATE_CHECKS
              .filter((check) => check.key !== 'fee_terms_disclosed')
              .map((check) => ({
                checkKey: check.key,
                passed: true,
                checkedAt: new Date('2026-01-01T00:00:00.000Z'),
                notes: null,
              })),
          ),
        }),
      });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const response = await POST(new NextRequest('http://localhost/api/admin/billing', {
      method: 'POST',
      body: JSON.stringify({
        type: 'invoice',
        clientId: 'client-1',
        serviceEngagementId: 'engagement-1',
        amount: 15000,
        servicesRendered: [{ event_type: 'first_dispute_package_submitted' }],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: 'COMPLIANCE_GATE_BLOCKED',
      error: 'Compliance Gate must pass before creating a payable invoice',
    });
    expect(body.blocking_checks).toEqual(['fee_terms_disclosed']);
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);

  it('blocks pay-per-delete invoices until the result is verified', async () => {
    const { POST } = await import('@/app/api/admin/billing/route');

    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'engagement-1', serviceType: 'credit_restoration' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'event-1',
              eventType: 'first_dispute_package_submitted',
              occurredAt: new Date('2026-01-01T00:00:00.000Z'),
            }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(COMPLIANCE_GATE_CHECKS.map((check) => ({
            checkKey: check.key,
            passed: true,
            checkedAt: new Date('2026-01-01T00:00:00.000Z'),
            notes: null,
          }))),
        }),
      });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const response = await POST(new NextRequest('http://localhost/api/admin/billing', {
      method: 'POST',
      body: JSON.stringify({
        type: 'invoice',
        clientId: 'client-1',
        serviceEngagementId: 'engagement-1',
        amount: 15000,
        feeModel: 'pay_per_delete',
        servicesRendered: [{ event_type: 'first_dispute_package_submitted' }],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      code: 'RESULTS_VERIFIED_BILLING_LOCK',
      error: 'Result-based fees require verified result documentation before an invoice can become payable',
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);
});
