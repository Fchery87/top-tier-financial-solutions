import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getSessionMock = vi.hoisted(() => vi.fn());
const uploadLimiterLimitMock = vi.hoisted(() => vi.fn());
const uploadToR2Mock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: getSessionMock } },
}));
vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock('@/lib/r2-storage', () => ({ uploadToR2: uploadToR2Mock }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  uploadLimiter: { limit: uploadLimiterLimitMock },
}));

describe('POST /api/portal/documents/upload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSessionMock.mockResolvedValue(null);
    uploadLimiterLimitMock.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 1_800_000_000,
    });
  });

  it('rate-limits a portal document upload before authentication and storage work', async () => {
    const { POST } = await import('@/app/api/portal/documents/upload/route');
    const response = await POST(new NextRequest('http://localhost/api/portal/documents/upload', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.19' },
    }));

    expect(response.status).toBe(401);
    expect(uploadLimiterLimitMock).toHaveBeenCalledWith('ip:203.0.113.19');
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });
});
