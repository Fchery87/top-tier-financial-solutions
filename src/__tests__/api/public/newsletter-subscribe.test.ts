// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn(), update: vi.fn() }));
const publicLimiterLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  publicLimiter: { limit: publicLimiterLimitMock },
}));

describe('POST /api/newsletter/subscribe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    publicLimiterLimitMock.mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: 1_800_000_000,
    });
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  it('rate-limits a valid newsletter subscription before persisting it', async () => {
    const { POST } = await import('@/app/api/newsletter/subscribe/route');
    const response = await POST(new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.21' },
      body: JSON.stringify({ email: 'subscriber@example.com' }),
    }));

    expect(response.status).toBe(201);
    expect(publicLimiterLimitMock).toHaveBeenCalledWith('ip:203.0.113.21');
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
  });

  it('rejects an oversized email before querying or writing subscribers', async () => {
    const { POST } = await import('@/app/api/newsletter/subscribe/route');
    const response = await POST(new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: `${'a'.repeat(243)}@example.com` }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Email must be 254 characters or fewer',
    });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it.each([
    { payload: { email: 'subscriber@example.com', first_name: 'f'.repeat(101) }, error: 'First name must be 100 characters or fewer' },
    { payload: { email: 'subscriber@example.com', last_name: 'l'.repeat(101) }, error: 'Last name must be 100 characters or fewer' },
    { payload: { email: 'subscriber@example.com', source: 's'.repeat(121) }, error: 'Source must be 120 characters or fewer' },
  ])('rejects oversized newsletter metadata before querying or writing subscribers', async ({ payload, error }) => {
    const { POST } = await import('@/app/api/newsletter/subscribe/route');
    const response = await POST(new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
