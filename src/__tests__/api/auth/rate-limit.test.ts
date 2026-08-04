import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const authPostMock = vi.hoisted(() => vi.fn());
const authGetMock = vi.hoisted(() => vi.fn());
const authLimiterLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({ auth: {} }));
vi.mock('better-auth/next-js', () => ({
  toNextJsHandler: () => ({ GET: authGetMock, POST: authPostMock }),
}));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  authLimiter: { limit: authLimiterLimitMock },
}));

describe('POST /api/auth/[...all]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authPostMock.mockResolvedValue(NextResponse.json({ ok: true }));
    authGetMock.mockResolvedValue(NextResponse.json({ ok: true }));
    authLimiterLimitMock.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 1_800_000_000,
    });
  });

  it('rate-limits authentication POSTs by requester IP', async () => {
    const { POST } = await import('@/app/api/auth/[...all]/route');
    const response = await POST(new NextRequest('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.12' },
      body: JSON.stringify({ email: 'client@example.com', password: 'incorrect' }),
    }));

    expect(response.status).toBe(200);
    expect(authLimiterLimitMock).toHaveBeenCalledWith('ip:203.0.113.12');
    expect(authPostMock).toHaveBeenCalledTimes(1);
  });
});
