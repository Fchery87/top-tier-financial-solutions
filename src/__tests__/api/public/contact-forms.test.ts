// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({ insert: vi.fn() }));
const publicLimiterLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  publicLimiter: { limit: publicLimiterLimitMock },
}));

describe('POST /api/public/contact-forms', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    publicLimiterLimitMock.mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: 1_800_000_000,
    });
  });

  it('rate-limits a valid contact submission before creating its database record', async () => {
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    dbMock.insert.mockReturnValue({ values: insertValuesMock });
    const { POST } = await import('@/app/api/public/contact-forms/route');

    const response = await POST(new NextRequest('http://localhost/api/public/contact-forms', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.20' },
      body: JSON.stringify({
        full_name: 'Taylor Client',
        email: 'taylor@example.com',
        message: 'I would like to schedule a credit audit.',
      }),
    }));

    expect(response.status).toBe(201);
    expect(publicLimiterLimitMock).toHaveBeenCalledWith('ip:203.0.113.20');
    expect(insertValuesMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an oversized message before writing a contact submission', async () => {
    const { POST } = await import('@/app/api/public/contact-forms/route');

    const response = await POST(new NextRequest('http://localhost/api/public/contact-forms', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Taylor Client',
        email: 'taylor@example.com',
        message: 'x'.repeat(5_001),
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Message must be 5000 characters or fewer',
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('rejects an oversized full name before writing a contact submission', async () => {
    const { POST } = await import('@/app/api/public/contact-forms/route');

    const response = await POST(new NextRequest('http://localhost/api/public/contact-forms', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'x'.repeat(121),
        email: 'taylor@example.com',
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Full name must be 120 characters or fewer',
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('rejects non-string contact fields before writing a submission', async () => {
    const { POST } = await import('@/app/api/public/contact-forms/route');
    const response = await POST(new NextRequest('http://localhost/api/public/contact-forms', {
      method: 'POST',
      body: JSON.stringify({ full_name: 42, email: 'taylor@example.com' }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Full name is required' });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it.each([
    {
      payload: { full_name: 'Taylor Client', email: `${'a'.repeat(243)}@example.com` },
      error: 'Email must be 254 characters or fewer',
    },
    {
      payload: { full_name: 'Taylor Client', email: 'taylor@example.com', phone_number: '1'.repeat(51) },
      error: 'Phone number must be 50 characters or fewer',
    },
    {
      payload: { full_name: 'Taylor Client', email: 'taylor@example.com', source_page_slug: 's'.repeat(121) },
      error: 'Source page slug must be 120 characters or fewer',
    },
  ])('rejects an oversized contact field before writing a submission', async ({ payload, error }) => {
    const { POST } = await import('@/app/api/public/contact-forms/route');
    const response = await POST(new NextRequest('http://localhost/api/public/contact-forms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
