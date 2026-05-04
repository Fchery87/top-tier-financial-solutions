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

describe('GET /api/admin/client-outcome-analytics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
    adminAuthMock.isSuperAdmin.mockResolvedValue(true);
  });

  it('returns client outcome metrics without operator workload fields', async () => {
    const { GET } = await import('@/app/api/admin/client-outcome-analytics/route');

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([
        { outcome: 'deleted', bureau: 'experian', scoreImpact: 12 },
        { outcome: 'updated', bureau: 'transunion', scoreImpact: null },
        { outcome: 'verified', bureau: 'equifax', scoreImpact: -2 },
      ]) })
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([
        { bureau: 'experian' },
        { bureau: 'transunion' },
      ]) });

    const response = await GET(new NextRequest('http://localhost/api/admin/client-outcome-analytics'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.client_outcome_analytics).toEqual({
      outcomes: {
        deleted: 1,
        updated: 1,
        verified: 1,
      },
      score_movement: {
        total: 10,
      },
      new_negatives: {
        count: 2,
      },
      bureau_progress: {
        experian: { deleted: 1, updated: 0, verified: 0, new_negatives: 1 },
        transunion: { deleted: 0, updated: 1, verified: 0, new_negatives: 1 },
        equifax: { deleted: 0, updated: 0, verified: 1, new_negatives: 0 },
      },
    });
    expect(JSON.stringify(body)).not.toContain('open_tasks');
    expect(JSON.stringify(body)).not.toContain('overdue');
  }, 30000);
});
