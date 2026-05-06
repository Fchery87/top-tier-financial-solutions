import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

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

describe('POST /api/admin/billing credit audit engagement billing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('requires credit audit invoices to use a separate credit audit engagement', async () => {
    const { POST } = await import('@/app/api/admin/billing/route');

    dbMock.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'engagement-1', serviceType: 'credit_restoration' }]),
        }),
      }),
    });

    const response = await POST(new NextRequest('http://localhost/api/admin/billing', {
      method: 'POST',
      body: JSON.stringify({
        type: 'invoice',
        clientId: 'client-1',
        serviceEngagementId: 'engagement-1',
        invoiceServiceType: 'credit_audit',
        amount: 15000,
        servicesRendered: [{ event_type: 'credit_audit_report_reviewed' }],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'CREDIT_AUDIT_ENGAGEMENT_REQUIRED',
      error: 'Credit Audit invoices require a separate Credit Audit engagement',
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);
});
