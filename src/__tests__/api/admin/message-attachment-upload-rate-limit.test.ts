// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getSessionMock = vi.hoisted(() => vi.fn());
const uploadLimiterLimitMock = vi.hoisted(() => vi.fn());
const uploadToR2Mock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: getSessionMock } },
}));
vi.mock('@/lib/r2-storage', () => ({ uploadToR2: uploadToR2Mock }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  uploadLimiter: { limit: uploadLimiterLimitMock },
}));

describe('POST /api/admin/messages/attachments', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    uploadLimiterLimitMock.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: 1_800_000_000,
    });
  });

  it('rejects an exhausted upload limit before authentication and storage work', async () => {
    const { POST } = await import('@/app/api/workspace/messages/attachments/route');
    const response = await POST(new NextRequest('http://localhost/api/admin/messages/attachments', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.21' },
    }));

    expect(response.status).toBe(429);
    expect(uploadLimiterLimitMock).toHaveBeenCalledWith('ip:203.0.113.21');
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });
});
