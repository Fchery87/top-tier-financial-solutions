// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireCapabilityMock = vi.hoisted(() => vi.fn());
const uploadLimiterLimitMock = vi.hoisted(() => vi.fn());
const uploadToR2Mock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/r2-storage', () => ({ uploadToR2: uploadToR2Mock }));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  uploadLimiter: { limit: uploadLimiterLimitMock },
}));

describe('POST /api/workspace/credit-reports/upload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    uploadLimiterLimitMock.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: 1_800_000_000,
    });
  });

  it('rejects an exhausted upload limit before capability and storage work', async () => {
    const { POST } = await import('@/app/api/workspace/credit-reports/upload/route');
    const response = await POST(new NextRequest('http://localhost/api/workspace/credit-reports/upload', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.20' },
    }));

    expect(response.status).toBe(429);
    expect(uploadLimiterLimitMock).toHaveBeenCalledWith('ip:203.0.113.20');
    expect(requireCapabilityMock).not.toHaveBeenCalled();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });
});
