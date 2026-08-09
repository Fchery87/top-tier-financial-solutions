import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({ execute: vi.fn() }));
const authMock = vi.hoisted(() => ({ api: { getSession: vi.fn() } }));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const changeUserRoleMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/auth', () => ({ auth: authMock }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/team-role-management', () => ({ changeUserRole: changeUserRoleMock }));

describe('POST /api/admin/set-role bootstrap compatibility', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lets the signed-in user self-promote only when no super admin exists', async () => {
    authMock.api.getSession.mockResolvedValue({ user: { id: 'owner-1', email: 'owner@example.com' } });
    dbMock.execute
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'owner-1', email: 'owner@example.com', role: 'user' }] });
    changeUserRoleMock.mockResolvedValue({
      ok: true,
      userId: 'owner-1',
      email: 'owner@example.com',
      previousRole: 'user',
      role: 'super_admin',
    });
    const { POST } = await import('@/app/api/admin/set-role/route');

    const response = await POST(new NextRequest('http://localhost/api/admin/set-role', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@example.com', role: 'super_admin' }),
    }));

    expect(response.status).toBe(200);
    expect(changeUserRoleMock).toHaveBeenCalledWith({
      actorUserId: 'owner-1',
      targetUserId: 'owner-1',
      role: 'super_admin',
    });
  });

  it('rejects a bootstrap request that attempts to promote another account', async () => {
    authMock.api.getSession.mockResolvedValue({ user: { id: 'owner-1', email: 'owner@example.com' } });
    dbMock.execute.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    const { POST } = await import('@/app/api/admin/set-role/route');

    const response = await POST(new NextRequest('http://localhost/api/admin/set-role', {
      method: 'POST',
      body: JSON.stringify({ email: 'other@example.com', role: 'super_admin' }),
    }));

    expect(response.status).toBe(403);
    expect(changeUserRoleMock).not.toHaveBeenCalled();
  });

  it('rejects malformed, oversized, and unknown role payloads before database work', async () => {
    authMock.api.getSession.mockResolvedValue({ user: { id: 'owner-1', email: 'owner@example.com' } });
    const { POST } = await import('@/app/api/admin/set-role/route');
    const invalidPayloads = [
      [],
      { email: 'not-an-email', role: 'staff' },
      { email: `${'a'.repeat(310)}@example.com`, role: 'staff' },
      { email: 'owner@example.com', role: 'owner' },
      { email: 'owner@example.com', role: ['staff'] },
    ];

    for (const payload of invalidPayloads) {
      const response = await POST(new NextRequest('http://localhost/api/admin/set-role', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'content-type': 'application/json' },
      }));
      expect(response.status).toBe(400);
    }

    expect(dbMock.execute).not.toHaveBeenCalled();
    expect(changeUserRoleMock).not.toHaveBeenCalled();
  });
});
