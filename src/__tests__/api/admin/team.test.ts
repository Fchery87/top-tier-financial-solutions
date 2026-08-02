import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({ execute: vi.fn() }));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const changeUserRoleMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/team-role-management', () => ({ changeUserRole: changeUserRoleMock }));

describe('/api/admin/team', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 403 when the requester lacks team:manage', async () => {
    requireCapabilityMock.mockResolvedValue(null);
    const { GET } = await import('@/app/api/admin/team/route');

    const response = await GET();

    expect(response.status).toBe(403);
    expect(dbMock.execute).not.toHaveBeenCalled();
  });

  it('lists team-role members with their most recent session activity', async () => {
    requireCapabilityMock.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', role: 'super_admin' });
    dbMock.execute
      .mockResolvedValueOnce({
        rows: [{
        id: 'member-1',
        email: 'member@example.com',
        name: 'Member One',
        role: 'super_admin',
        last_active_at: '2026-08-02T12:00:00.000Z',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'activity-1',
          action: 'user_role.changed',
          subject_type: 'user_role',
          subject_id: 'member-1',
          actor_name: 'Owner One',
          created_at: '2026-08-02T12:15:00.000Z',
        }],
      });
    const { GET } = await import('@/app/api/admin/team/route');

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      members: [{
        id: 'member-1',
        email: 'member@example.com',
        name: 'Member One',
        role: 'super_admin',
        last_active_at: '2026-08-02T12:00:00.000Z',
        is_last_super_admin: true,
      }],
      recent_activity: [{
        id: 'activity-1',
        action: 'user_role.changed',
        subject_type: 'user_role',
        subject_id: 'member-1',
        actor_name: 'Owner One',
        created_at: '2026-08-02T12:15:00.000Z',
      }],
    });
  });

  it('updates a member role through the role-management seam', async () => {
    requireCapabilityMock.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', role: 'super_admin' });
    changeUserRoleMock.mockResolvedValue({
      ok: true,
      userId: 'member-1',
      email: 'member@example.com',
      previousRole: 'staff',
      role: 'admin',
    });
    const { PATCH } = await import('@/app/api/admin/team/route');

    const response = await PATCH(new NextRequest('http://localhost/api/admin/team', {
      method: 'PATCH',
      body: JSON.stringify({ user_id: 'member-1', role: 'admin' }),
    }));

    expect(response.status).toBe(200);
    expect(changeUserRoleMock).toHaveBeenCalledWith({
      actorUserId: 'owner-1',
      targetUserId: 'member-1',
      role: 'admin',
    });
  });

  it.each([
    ['not_found', 404],
    ['last_super_admin', 409],
    ['invalid_role', 400],
  ])('maps %s role-change results to the correct HTTP status', async (code, status) => {
    requireCapabilityMock.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', role: 'super_admin' });
    changeUserRoleMock.mockResolvedValue({ ok: false, code });
    const { PATCH } = await import('@/app/api/admin/team/route');

    const response = await PATCH(new NextRequest('http://localhost/api/admin/team', {
      method: 'PATCH',
      body: JSON.stringify({ user_id: 'member-1', role: 'admin' }),
    }));

    expect(response.status).toBe(status);
  });
});
