import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

function hasValidUpstashConfig(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const hasUpstashConfig = hasValidUpstashConfig();

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending?: Promise<unknown>;
};

function createNoopLimiter(): Ratelimit {
  return {
    limit: async (): Promise<RateLimitResult> => ({
      success: true,
      limit: Number.MAX_SAFE_INTEGER,
      remaining: Number.MAX_SAFE_INTEGER,
      reset: Math.floor(Date.now() / 1000) + 60,
    }),
  } as unknown as Ratelimit;
}

// Initialize Redis connection for rate limiting only when configured
const redis = hasUpstashConfig ? Redis.fromEnv() : null;

/**
 * Create rate limiters for different endpoints
 * All limiters use sliding window algorithm for precision
 */

// Public endpoints: 30 requests per minute
export const publicLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      ephemeralCache: new Map(),
      prefix: '@ratelimit/public',
    })
  : createNoopLimiter();

// Authenticated user endpoints: 100 requests per minute
export const userLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '60 s'),
      ephemeralCache: new Map(),
      prefix: '@ratelimit/user',
    })
  : createNoopLimiter();

// Sensitive/admin endpoints: 10 requests per minute
export const sensitiveLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      ephemeralCache: new Map(),
      prefix: '@ratelimit/sensitive',
    })
  : createNoopLimiter();

// File upload endpoints: 5 requests per 5 minutes (lower rate for large files)
export const uploadLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '5 m'),
      ephemeralCache: new Map(),
      prefix: '@ratelimit/upload',
    })
  : createNoopLimiter();

/**
 * Get rate limit identifier from request
 * Prioritizes authenticated user ID, falls back to IP address
 */
export function getRateLimitKey(
  request: Request,
  userId?: string
): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Extract client IP from request headers
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  return `ip:${ip}`;
}

/**
 * Format rate limit response headers
 */
export function formatRateLimitHeaders(
  limit: number,
  remaining: number,
  reset: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, remaining).toString(),
    'X-RateLimit-Reset': new Date(reset * 1000).toISOString(),
  };
}
