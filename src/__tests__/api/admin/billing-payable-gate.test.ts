import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  api: {
    getSession: vi.fn(),
  },
}));

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-forwarded-for': '127.0.0.1' })),
}));

describe('POST /api/admin/billing payable invoice gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', role: 'super_admin' } });
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
});
