// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const dbMock = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn(), update: vi.fn() }));
const publicLimiterLimitMock = vi.hoisted(() => vi.fn());
const setMock = vi.hoisted(() => vi.fn());
const whereMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  publicLimiter: { limit: publicLimiterLimitMock },
}));

function post(body: unknown, ip = '203.0.113.60') {
  return new NextRequest('http://localhost/api/newsletter/confirm', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Collects every bound parameter value inside a drizzle SQL expression. */
function paramValues(node: unknown, out: unknown[] = []): unknown[] {
  if (node && typeof node === 'object') {
    const n = node as { value?: unknown; queryChunks?: unknown[] };
    if (Array.isArray(n.queryChunks)) n.queryChunks.forEach((c) => paramValues(c, out));
    else if ('value' in n && !Array.isArray(n.value)) out.push(n.value);
  }
  return out;
}

describe('POST /api/newsletter/confirm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-with-at-least-32-characters!!');
    publicLimiterLimitMock.mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: 1_800_000_000 });
    whereMock.mockResolvedValue(undefined);
    setMock.mockReturnValue({ where: whereMock });
    dbMock.update.mockReturnValue({ set: setMock });
  });

  it('activates a subscriber from a valid token, only if they are still pending', async () => {
    const { createConfirmToken } = await import('@/lib/newsletter-confirm-token');
    const { POST } = await import('@/app/api/newsletter/confirm/route');
    const response = await POST(post({ token: createConfirmToken('sub-1') }));

    expect(response.status).toBe(200);
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    const params = paramValues(whereMock.mock.calls[0][0]);
    expect(params).toContain('sub-1');
    expect(params).toContain('pending');
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('rejects an expired token without touching the database', async () => {
    const { createConfirmToken, CONFIRM_TOKEN_TTL_MS } = await import('@/lib/newsletter-confirm-token');
    const { POST } = await import('@/app/api/newsletter/confirm/route');
    const old = createConfirmToken('sub-1', Date.now() - CONFIRM_TOKEN_TTL_MS - 60_000);
    const response = await POST(post({ token: old }));

    expect(response.status).toBe(400);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('refuses an unsubscribe token, forged, empty and malformed requests', async () => {
    const { createUnsubscribeToken } = await import('@/lib/newsletter-unsubscribe-token');
    const { POST } = await import('@/app/api/newsletter/confirm/route');
    for (const body of [{ token: createUnsubscribeToken('sub-1') }, { token: 'forged.1.token' }, { token: '' }, { email: 'a@b.co' }, '{', ['x']]) {
      expect((await POST(post(body))).status).toBe(400);
    }
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('returns the identical response whether or not the subscriber exists', async () => {
    const { createConfirmToken } = await import('@/lib/newsletter-confirm-token');
    const { POST } = await import('@/app/api/newsletter/confirm/route');
    const a = await POST(post({ token: createConfirmToken('exists') }));
    const b = await POST(post({ token: createConfirmToken('does-not-exist') }));

    expect(a.status).toBe(b.status);
    expect(await a.json()).toEqual(await b.json());
  });

  it('is rate limited by client IP', async () => {
    publicLimiterLimitMock.mockResolvedValue({ success: false, limit: 30, remaining: 0, reset: 1_800_000_000 });
    const { POST } = await import('@/app/api/newsletter/confirm/route');
    const response = await POST(post({ token: 'whatever' }, '203.0.113.99'));

    expect(response.status).toBe(429);
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});
