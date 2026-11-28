import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// One headers object per simulated request, as Next.js gives within a request.
let requestHeaders = new Headers();
vi.mock('next/headers', () => ({ headers: vi.fn(async () => requestHeaders) }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock('@/lib/admin-auth', () => ({ getUserRole: vi.fn() }));
vi.mock('@/lib/mfa-status', () => ({ getTwoFactorEnabled: vi.fn() }));

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { getTwoFactorEnabled } from '@/lib/mfa-status';
import { requireCapability } from '@/lib/admin-session';
import { capabilityDeniedResponse } from '@/lib/capability-denial';

const session = { user: { id: 'u1', email: 'a@b.com' } };

beforeEach(() => {
  vi.resetAllMocks();
  requestHeaders = new Headers();
});

async function deniedBody() {
  const response = await capabilityDeniedResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 403 }));
  return { status: response.status, body: await response.json() };
}

// These tests cover the mandatory-MFA mode, which is opt-in (see src/lib/mfa.ts).
vi.stubEnv('MFA_REQUIRED_FOR_TEAM', 'true');

describe('requireCapability', () => {
  it('returns the user when the role holds the capability and MFA is enrolled', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(true);

    const user = await requireCapability('disputes:write');
    expect(user).toEqual({ id: 'u1', email: 'a@b.com', role: 'staff' });
    expect(getTwoFactorEnabled).toHaveBeenCalledWith('u1');
  });

  it('returns null when the role lacks the capability', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(true);

    expect(await requireCapability('templates:write')).toBeNull();
    expect(await deniedBody()).toEqual({ status: 403, body: { error: 'Unauthorized' } });
  });

  it('returns null when there is no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
    expect(await requireCapability('disputes:read')).toBeNull();
    expect(await deniedBody()).toEqual({ status: 403, body: { error: 'Unauthorized' } });
  });

  it.each(['staff', 'admin', 'super_admin'] as const)(
    'refuses a %s without MFA with 403 MFA_ENROLLMENT_REQUIRED',
    async (role) => {
      vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
      vi.mocked(getUserRole).mockResolvedValue(role);
      vi.mocked(getTwoFactorEnabled).mockResolvedValue(false);

      expect(await requireCapability('disputes:read')).toBeNull();
      const { status, body } = await deniedBody();
      expect(status).toBe(403);
      expect(body.code).toBe('MFA_ENROLLMENT_REQUIRED');
      expect(body.enrollUrl).toBe('/settings/security');
    },
  );

  it('fails closed when the MFA flag cannot be read', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('admin');
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(null);

    expect(await requireCapability('disputes:read')).toBeNull();
    expect((await deniedBody()).body.code).toBe('MFA_ENROLLMENT_REQUIRED');
  });

  it('passes the same staff user once MFA is enrolled', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');
    vi.mocked(getTwoFactorEnabled).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    expect(await requireCapability('disputes:read')).toBeNull();
    requestHeaders = new Headers(); // next request
    expect(await requireCapability('disputes:read')).toEqual({ id: 'u1', email: 'a@b.com', role: 'staff' });
    expect(await deniedBody()).toEqual({ status: 403, body: { error: 'Unauthorized' } });
  });

  it('does not leak an MFA refusal into another request', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(false);
    await requireCapability('disputes:read');

    requestHeaders = new Headers();
    expect((await deniedBody()).body).toEqual({ error: 'Unauthorized' });
  });

  it('does not read the MFA flag for a role without the capability', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('user');

    expect(await requireCapability('disputes:read')).toBeNull();
    expect(getTwoFactorEnabled).not.toHaveBeenCalled();
  });
});

describe('requireCapability when two-factor is optional (the default)', () => {
  beforeEach(() => { vi.stubEnv('MFA_REQUIRED_FOR_TEAM', ''); });
  afterEach(() => { vi.stubEnv('MFA_REQUIRED_FOR_TEAM', 'true'); });

  it.each([false, null])('lets a team member without two-factor (flag %s) use the API', async (flag) => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(flag);

    expect(await requireCapability('disputes:write')).toEqual({ id: 'u1', email: 'a@b.com', role: 'staff' });
  });

  it('still enforces the role capability', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');
    vi.mocked(getTwoFactorEnabled).mockResolvedValue(false);

    expect(await requireCapability('templates:write')).toBeNull();
    expect(await deniedBody()).toEqual({ status: 403, body: { error: 'Unauthorized' } });
  });
});
