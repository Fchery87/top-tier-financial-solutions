import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  api: {
    getSession: vi.fn(),
  },
}));

const adminAuthMock = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
}));

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/admin-auth', () => adminAuthMock);

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('GET /api/admin/operator-analytics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
    adminAuthMock.isSuperAdmin.mockResolvedValue(true);
  });

  it('returns internal operator metrics without client outcome claims', async () => {
    const { GET } = await import('@/app/api/admin/operator-analytics/route');

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 2 }]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 3 }]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 4 }]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 5 }]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 6 }]) }) });

    const response = await GET(new NextRequest('http://localhost/api/admin/operator-analytics'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.operator_analytics).toEqual({
      import_success: {
        pending_or_failed_reports: 2,
      },
      response_aging: {
        due_soon: 1,
        overdue: 3,
      },
      cycle_throughput: {
        active_cycles: 4,
      },
      billing_readiness: {
        services_rendered_events: 5,
      },
      workload: {
        open_tasks: 6,
      },
    });
    expect(JSON.stringify(body)).not.toContain('deleted_items');
    expect(JSON.stringify(body)).not.toContain('score_movement');
  }, 30000);
});
