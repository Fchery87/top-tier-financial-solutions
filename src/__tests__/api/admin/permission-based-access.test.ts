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
  getUserRole: vi.fn(),
  roleHasPermission: vi.fn((role: string) => role === 'admin' || role === 'super_admin'),
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

describe('permission-based admin access', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('allows a non-super-admin with task read permission to list admin tasks', async () => {
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
    adminAuthMock.getUserRole.mockResolvedValue('admin');
    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 0 }]) }) });

    const { GET } = await import('@/app/api/admin/tasks/route');
    const response = await GET(new NextRequest('http://localhost/api/admin/tasks'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  }, 30000);

  it('returns forbidden for an authenticated user without the task read permission', async () => {
    authMock.api.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'client@example.com' } });
    adminAuthMock.getUserRole.mockResolvedValue('user');

    const { GET } = await import('@/app/api/admin/tasks/route');
    const response = await GET(new NextRequest('http://localhost/api/admin/tasks'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  }, 30000);
});
