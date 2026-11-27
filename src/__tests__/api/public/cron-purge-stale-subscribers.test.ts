// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const cleanupMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/newsletter-pending-cleanup', () => ({ cleanUpStalePendingSubscribers: cleanupMock }));
vi.mock('@/lib/server-logger', () => ({ logServerEvent: vi.fn() }));

function post(authorization?: string) {
  return new NextRequest('http://localhost/api/cron/purge-stale-subscribers', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });
}

describe('POST /api/cron/purge-stale-subscribers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('CRON_SECRET', 'cron-secret-for-tests');
    cleanupMock.mockResolvedValue({ deleted: 3, restoredToUnsubscribed: 1 });
  });

  it('rejects requests without the cron secret, and when none is configured', async () => {
    const { POST } = await import('@/app/api/cron/purge-stale-subscribers/route');
    expect((await POST(post())).status).toBe(401);
    expect((await POST(post('Bearer wrong'))).status).toBe(401);
    vi.stubEnv('CRON_SECRET', '');
    expect((await POST(post('Bearer '))).status).toBe(401);
    expect(cleanupMock).not.toHaveBeenCalled();
  });

  it('runs the cleanup and reports counts for an authorized request', async () => {
    const { POST } = await import('@/app/api/cron/purge-stale-subscribers/route');
    const response = await POST(post('Bearer cron-secret-for-tests'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, deleted: 3, restored_to_unsubscribed: 1 });
  });

  it('returns 500 without leaking details when the cleanup fails', async () => {
    cleanupMock.mockRejectedValue(new Error('connection string leaked here'));
    const { POST } = await import('@/app/api/cron/purge-stale-subscribers/route');
    const response = await POST(post('Bearer cron-secret-for-tests'));

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('leaked');
  });
});
