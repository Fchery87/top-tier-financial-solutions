import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { COMPLIANCE_GATE_CHECKS } from '@/lib/compliance-gate';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const adminSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  getAdminSessionUser: adminSessionMock,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-forwarded-for': '127.0.0.1' })),
}));

describe('POST /api/admin/billing payment audit trail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('logs why an invoice became payable from the qualifying services rendered event', async () => {
    const { POST } = await import('@/app/api/admin/billing/route');
    const invoiceValues = vi.fn().mockResolvedValue(undefined);
    const auditValues = vi.fn().mockResolvedValue(undefined);

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
              occurredAt: new Date('2026-01-02T00:00:00.000Z'),
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
    dbMock.insert
      .mockReturnValueOnce({ values: invoiceValues })
      .mockReturnValueOnce({ values: auditValues });

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

    expect(response.status).toBe(200);
    expect(invoiceValues).toHaveBeenCalled();
    expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({
      action: 'invoice_created',
      invoiceId: expect.any(String),
      performedById: 'admin-1',
    }));
    const auditPayload = auditValues.mock.calls[0][0] as { details: string };
    expect(JSON.parse(auditPayload.details)).toMatchObject({
      readiness_reason: 'qualifying_services_rendered_event',
      service_engagement_id: 'engagement-1',
      services_rendered_event_id: 'event-1',
      services_rendered_event_type: 'first_dispute_package_submitted',
    });
  }, 30000);
});
