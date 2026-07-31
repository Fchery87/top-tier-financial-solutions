import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock('@/lib/admin-auth', () => ({ getUserRole: vi.fn() }));

import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { requireCapability } from '@/lib/admin-session';

const session = { user: { id: 'u1', email: 'a@b.com' } };

beforeEach(() => vi.resetAllMocks());

describe('requireCapability', () => {
  it('returns the user when the role holds the capability', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');

    const user = await requireCapability('disputes:write');
    expect(user).toEqual({ id: 'u1', email: 'a@b.com', role: 'staff' });
  });

  it('returns null when the role lacks the capability', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');

    expect(await requireCapability('templates:write')).toBeNull();
  });

  it('returns null when there is no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    expect(await requireCapability('disputes:read')).toBeNull();
  });
});
