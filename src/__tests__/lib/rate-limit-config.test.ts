import { afterEach, describe, expect, it, vi } from 'vitest';

describe('rate limit production configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('rejects missing Upstash configuration in production without an explicit override', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('RATE_LIMIT_DISABLED', '');

    await expect(import('@/lib/rate-limit')).rejects.toThrow(
      /Rate limiting is not configured/,
    );
  });

  it('permits an explicit production override when Upstash is unavailable', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('RATE_LIMIT_DISABLED', 'true');

    await expect(import('@/lib/rate-limit')).resolves.toBeTruthy();
  });

  it('permits the Next production build phase without runtime rate-limit configuration', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('RATE_LIMIT_DISABLED', '');

    await expect(import('@/lib/rate-limit')).resolves.toBeTruthy();
  });
});
