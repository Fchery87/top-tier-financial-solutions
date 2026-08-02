import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.hoisted(() => ({ api: { getSession: vi.fn() } }));
const getUserRoleMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({ auth: authMock }));
vi.mock('@/lib/admin-auth', () => ({ getUserRole: getUserRoleMock }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

import { GET } from '@/app/api/auth/landing/route';

describe('GET /api/auth/landing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { email: 'person@example.com' } });
  });

  it('preserves a safe internal destination for team roles', async () => {
    getUserRoleMock.mockResolvedValue('staff');

    const response = await GET(new NextRequest('http://localhost/api/auth/landing?next=/workspace/disputes'));

    expect(await response.json()).toEqual({ landing: '/workspace/disputes' });
  });

  it('rejects protocol-relative destinations for team roles', async () => {
    getUserRoleMock.mockResolvedValue('admin');

    const response = await GET(new NextRequest('http://localhost/api/auth/landing?next=//evil.example'));

    expect(await response.json()).toEqual({ landing: '/workspace' });
  });

  it('always sends clients to the portal, including when workspace is requested', async () => {
    getUserRoleMock.mockResolvedValue('user');

    const response = await GET(new NextRequest('http://localhost/api/auth/landing?next=/workspace'));

    expect(await response.json()).toEqual({ landing: '/portal' });
  });

  it('returns sign-in for an unauthenticated request', async () => {
    authMock.api.getSession.mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost/api/auth/landing'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ landing: '/sign-in' });
  });
});
