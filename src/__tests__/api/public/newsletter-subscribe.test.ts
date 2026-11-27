// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn(), update: vi.fn() }));
const publicLimiterLimitMock = vi.hoisted(() => vi.fn());
const sendConfirmationMock = vi.hoisted(() => vi.fn());
const afterCallbacks = vi.hoisted(() => [] as Array<() => unknown>);

// `after()` only works inside a real request, so collect the callbacks and run them by hand.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => unknown) => { afterCallbacks.push(callback); },
}));
vi.mock('@/lib/newsletter-confirmation-email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/newsletter-confirmation-email')>()),
  sendNewsletterConfirmationEmail: sendConfirmationMock,
}));

async function flushAfter() {
  while (afterCallbacks.length) await afterCallbacks.shift()!();
}

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  publicLimiter: { limit: publicLimiterLimitMock },
}));

describe('POST /api/newsletter/subscribe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    afterCallbacks.length = 0;
    sendConfirmationMock.mockResolvedValue(undefined);
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

  describe('double opt-in', () => {
    const MINUTE = 60 * 1000;

    type Existing = { id: string; status: string; updatedAt?: Date };

    function setUpdate() {
      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      dbMock.update.mockReturnValue({ set: setMock });
      return setMock;
    }

    async function subscribe(existing: Existing[]) {
      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(existing) }),
        }),
      });
      const { POST } = await import('@/app/api/newsletter/subscribe/route');
      const response = await POST(new NextRequest('http://localhost/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.30' },
        body: JSON.stringify({ email: 'Subscriber@Example.com' }),
      }));
      await flushAfter();
      return { status: response.status, body: await response.json() };
    }

    it('stores a new address as pending (never active) and emails a confirmation link', async () => {
      const values = vi.fn().mockResolvedValue(undefined);
      dbMock.insert.mockReturnValue({ values });

      const { status } = await subscribe([]);

      expect(status).toBe(201);
      const row = values.mock.calls[0][0];
      expect(row.status).toBe('pending');
      expect(row.email).toBe('subscriber@example.com');
      expect(sendConfirmationMock).toHaveBeenCalledWith(row.id, 'subscriber@example.com');
    });

    it('does not send the confirmation inside the request, only after the response', async () => {
      dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
      const { POST } = await import('@/app/api/newsletter/subscribe/route');
      await POST(new NextRequest('http://localhost/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.31' },
        body: JSON.stringify({ email: 'late@example.com' }),
      }));
      expect(sendConfirmationMock).not.toHaveBeenCalled();
      await flushAfter();
      expect(sendConfirmationMock).toHaveBeenCalledTimes(1);
    });

    it('answers identically for new, pending, active, unsubscribed and bounced addresses', async () => {
      dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
      setUpdate();
      const old = new Date(Date.now() - 60 * MINUTE);

      const fresh = await subscribe([]);
      for (const status of ['pending', 'active', 'unsubscribed', 'bounced']) {
        expect(await subscribe([{ id: 'x', status, updatedAt: old }])).toEqual(fresh);
      }
      expect(fresh.status).toBe(201);
    });

    it('moves an unsubscribed address back to pending, not active, and asks it to confirm', async () => {
      const setMock = setUpdate();
      await subscribe([{ id: 'sub-1', status: 'unsubscribed', updatedAt: new Date(0) }]);

      expect(setMock).toHaveBeenCalledTimes(1);
      expect(setMock.mock.calls[0][0].status).toBe('pending');
      expect(dbMock.insert).not.toHaveBeenCalled();
      expect(sendConfirmationMock).toHaveBeenCalledWith('sub-1', 'subscriber@example.com');
    });

    it('resends to a pending address only after the cooldown', async () => {
      const setMock = setUpdate();

      await subscribe([{ id: 'sub-2', status: 'pending', updatedAt: new Date(Date.now() - 1 * MINUTE) }]);
      expect(sendConfirmationMock).not.toHaveBeenCalled();
      expect(setMock).not.toHaveBeenCalled();

      await subscribe([{ id: 'sub-2', status: 'pending', updatedAt: new Date(Date.now() - 11 * MINUTE) }]);
      expect(sendConfirmationMock).toHaveBeenCalledWith('sub-2', 'subscriber@example.com');
      expect(setMock).toHaveBeenCalledTimes(1);
    });

    it('does nothing for an active address', async () => {
      const setMock = setUpdate();
      await subscribe([{ id: 'sub-3', status: 'active', updatedAt: new Date(0) }]);

      expect(setMock).not.toHaveBeenCalled();
      expect(dbMock.insert).not.toHaveBeenCalled();
      expect(sendConfirmationMock).not.toHaveBeenCalled();
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
