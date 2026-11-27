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

  describe('does not reveal whether an address is already on the list', () => {
    async function subscribe(existing: Array<{ status: string }>) {
      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(existing) }),
        }),
      });
      dbMock.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      const { POST } = await import('@/app/api/newsletter/subscribe/route');
      const response = await POST(new NextRequest('http://localhost/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.30' },
        body: JSON.stringify({ email: 'subscriber@example.com' }),
      }));
      return { status: response.status, body: await response.json() };
    }

    it('answers identically for new, already-active and previously-unsubscribed addresses', async () => {
      const fresh = await subscribe([]);
      const active = await subscribe([{ status: 'active' }]);
      const unsubscribed = await subscribe([{ status: 'unsubscribed' }]);

      expect(active).toEqual(fresh);
      expect(unsubscribed).toEqual(fresh);
      expect(fresh.status).toBe(201);
    });

    it('still reactivates a previously-unsubscribed address and does not insert a duplicate', async () => {
      await subscribe([{ status: 'unsubscribed' }]);
      expect(dbMock.update).toHaveBeenCalledTimes(1);
      expect(dbMock.insert).not.toHaveBeenCalled();
    });

    it('does not write anything for an already-active address', async () => {
      await subscribe([{ status: 'active' }]);
      expect(dbMock.update).not.toHaveBeenCalled();
      expect(dbMock.insert).not.toHaveBeenCalled();
    });
  });

  it('rejects malformed JSON after rate limiting and before querying subscribers', async () => {
    const { POST } = await import('@/app/api/newsletter/subscribe/route');
    const response = await POST(new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.24' },
      body: '{',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
    expect(publicLimiterLimitMock).toHaveBeenCalledWith('ip:203.0.113.24');
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('rejects schema-invalid subscriptions after rate limiting and before querying', async () => {
    const { POST } = await import('@/app/api/newsletter/subscribe/route');
    const response = await POST(new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.25' },
      body: JSON.stringify(['not', 'a', 'subscription']),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request payload' });
    expect(publicLimiterLimitMock).toHaveBeenCalledWith('ip:203.0.113.25');
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('rejects non-text optional subscription fields before querying subscribers', async () => {
    const { POST } = await import('@/app/api/newsletter/subscribe/route');
    const response = await POST(new NextRequest('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        email: 'subscriber@example.com',
        first_name: { unexpected: 'object' },
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request payload' });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
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
