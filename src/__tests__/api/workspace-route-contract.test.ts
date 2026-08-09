import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.hoisted(() => ({ api: { getSession: vi.fn() } }));
const dbMock = vi.hoisted(() => ({ execute: vi.fn() }));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const changeUserRoleMock = vi.hoisted(() => vi.fn());
const uploadLimiterLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/auth', () => ({ auth: authMock }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/team-role-management', () => ({ changeUserRole: changeUserRoleMock }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  uploadLimiter: { limit: uploadLimiterLimitMock },
}));
vi.mock('@/lib/r2-storage', () => ({ uploadToR2: vi.fn() }));

describe('workspace API route contract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    uploadLimiterLimitMock.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 1_800_000_000,
    });
  });

  it('serves a representative canonical GET route', async () => {
    const { GET } = await import('@/app/api/workspace/credit-report-pulls/route');
    const request = workspaceRequest('/credit-report-pulls');

    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Service engagement ID is required' });
  });

  it('serves an authenticated canonical write route', async () => {
    authMock.api.getSession.mockResolvedValue({ user: { id: 'owner-1', email: 'owner@example.com' } });
    dbMock.execute
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'owner-1', email: 'owner@example.com', role: 'user' }] });
    changeUserRoleMock.mockResolvedValue({ ok: true, role: 'super_admin' });
    const { POST } = await import('@/app/api/workspace/set-role/route');

    const response = await POST(workspaceRequest('/set-role', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', role: 'super_admin' }),
    }));

    expect(response.status).toBe(200);
    expect(changeUserRoleMock).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'owner-1',
      targetUserId: 'owner-1',
      role: 'super_admin',
    }));
  });

  it('serves the canonical upload-adjacent route before storage work', async () => {
    requireCapabilityMock.mockResolvedValue(null);
    const { POST } = await import('@/app/api/workspace/disputes/evidence/upload/route');

    const response = await POST(workspaceRequest('/disputes/evidence/upload', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.18' },
    }));

    expect(response.status).toBe(403);
    expect(uploadLimiterLimitMock).toHaveBeenCalledWith('ip:203.0.113.18');
  });

  it('serves a canonical dynamic id route', async () => {
    const { GET } = await import('@/app/api/workspace/disputes/[id]/cfpb-eligibility/route');
    const request = workspaceRequest('/disputes/dispute-1/cfpb-eligibility?clientId=client-1');

    const response = await GET(request, { params: Promise.resolve({ id: 'dispute-1' }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'clientId and negativeItemId are required' });
  });
});

function workspaceRequest(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  const request = new NextRequest(`http://localhost/api/workspace${path}`, init);
  expect(request.nextUrl.pathname).toMatch(/^\/api\/workspace\//);
  return request;
}
