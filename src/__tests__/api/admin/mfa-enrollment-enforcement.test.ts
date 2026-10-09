import { describe, it, expect, vi, beforeEach } from 'vitest';

let requestHeaders = new Headers();
vi.mock('next/headers', () => ({ headers: vi.fn(async () => requestHeaders) }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/admin-auth', () => ({ getUserRole: vi.fn() }));
vi.mock('@/lib/mfa-status', () => ({ getTwoFactorEnabled: vi.fn() }));
vi.mock('@/db/client', () => ({
  db: { select: vi.fn(() => ({ from: vi.fn(async () => []) })) },
}));

import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { getTwoFactorEnabled } from '@/lib/mfa-status';
import { GET as creditorStrategies } from '@/app/api/workspace/disputes/insights/creditor-strategies/route';
import { GET as search } from '@/app/api/workspace/search/route';
import { NextRequest } from 'next/server';

beforeEach(() => {
  vi.resetAllMocks();
  requestHeaders = new Headers();
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'staff-1', email: 'staff@example.com' } } as never);
  vi.mocked(getUserRole).mockResolvedValue('staff');
});

describe('workspace API MFA enforcement (real requireCapability + route)', () => {
  it('answers 403 MFA_ENROLLMENT_REQUIRED for a staff member without two-factor', async () => {
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(false);

    const response = await creditorStrategies();

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'MFA_ENROLLMENT_REQUIRED' });
  });

  it('serves the same staff member once two-factor is on', async () => {
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(true);

    const response = await creditorStrategies();

    expect(response.status).toBe(200);
  });

  it('keeps the route’s own denial for a portal client', async () => {
    vi.mocked(getUserRole).mockResolvedValue('user');

    const response = await creditorStrategies();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('applies to routes that combine two capability checks', async () => {
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(false);

    const response = await search(new NextRequest('http://localhost/api/workspace/search?q=smith'));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'MFA_ENROLLMENT_REQUIRED' });
  });
});
