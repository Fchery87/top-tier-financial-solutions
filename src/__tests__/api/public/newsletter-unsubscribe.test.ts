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

function post(body: unknown, ip = '203.0.113.50') {
  return new NextRequest('http://localhost/api/newsletter/unsubscribe', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('newsletter unsubscribe tokens', () => {
  beforeEach(() => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-with-at-least-32-characters!!');
  });

  it('round-trips a subscriber id', async () => {
    const { createUnsubscribeToken, verifyUnsubscribeToken } = await import('@/lib/newsletter-unsubscribe-token');
    expect(verifyUnsubscribeToken(createUnsubscribeToken('sub-123'))).toBe('sub-123');
  });

  it('rejects tampered, swapped, malformed and oversized tokens', async () => {
    const { createUnsubscribeToken, verifyUnsubscribeToken } = await import('@/lib/newsletter-unsubscribe-token');
    const [, sigA] = createUnsubscribeToken('sub-a').split('.');
    const idB = Buffer.from('sub-b').toString('base64url');

    expect(verifyUnsubscribeToken(`${idB}.${sigA}`)).toBeNull();
    expect(verifyUnsubscribeToken('sub-a')).toBeNull();
    expect(verifyUnsubscribeToken('.')).toBeNull();
    expect(verifyUnsubscribeToken('a.b.c')).toBeNull();
    expect(verifyUnsubscribeToken('')).toBeNull();
    expect(verifyUnsubscribeToken('x'.repeat(600))).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const { createUnsubscribeToken, verifyUnsubscribeToken } = await import('@/lib/newsletter-unsubscribe-token');
    const token = createUnsubscribeToken('sub-123');
    vi.stubEnv('BETTER_AUTH_SECRET', 'a-completely-different-secret-value-123');
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });
});

describe('POST /api/newsletter/unsubscribe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-with-at-least-32-characters!!');
    publicLimiterLimitMock.mockResolvedValue({ success: true, limit: 30, remaining: 29, reset: 1_800_000_000 });
    whereMock.mockResolvedValue(undefined);
    setMock.mockReturnValue({ where: whereMock });
    dbMock.update.mockReturnValue({ set: setMock });
  });

  it('unsubscribes with a valid token without ever reading by email', async () => {
    const { createUnsubscribeToken } = await import('@/lib/newsletter-unsubscribe-token');
    const { POST } = await import('@/app/api/newsletter/unsubscribe/route');
    const response = await POST(post({ token: createUnsubscribeToken('sub-123') }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, message: 'You have been unsubscribed.' });
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'unsubscribed' }));
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('refuses a bare email address (the old, unauthenticated contract)', async () => {
    const { POST } = await import('@/app/api/newsletter/unsubscribe/route');
    const response = await POST(post({ email: 'victim@example.com' }));

    expect(response.status).toBe(400);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('refuses forged, empty and malformed requests without touching the database', async () => {
    const { POST } = await import('@/app/api/newsletter/unsubscribe/route');
    for (const body of [{ token: 'forged.token' }, { token: '' }, '{', ['x']]) {
      const response = await POST(post(body));
      expect(response.status).toBe(400);
    }
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('returns the identical response whether or not the subscriber exists', async () => {
    const { createUnsubscribeToken } = await import('@/lib/newsletter-unsubscribe-token');
    const { POST } = await import('@/app/api/newsletter/unsubscribe/route');
    const a = await POST(post({ token: createUnsubscribeToken('exists') }));
    const b = await POST(post({ token: createUnsubscribeToken('does-not-exist') }));

    expect(a.status).toBe(b.status);
    expect(await a.json()).toEqual(await b.json());
  });

  it('is rate limited by client IP', async () => {
    publicLimiterLimitMock.mockResolvedValue({ success: false, limit: 30, remaining: 0, reset: 1_800_000_000 });
    const { POST } = await import('@/app/api/newsletter/unsubscribe/route');
    const response = await POST(post({ token: 'whatever' }, '203.0.113.99'));

    expect(response.status).toBe(429);
    expect(publicLimiterLimitMock).toHaveBeenCalledWith('ip:203.0.113.99');
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});
