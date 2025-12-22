import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis connection for rate limiting
const redis = Redis.fromEnv();

/**
 * Create rate limiters for different endpoints
 * All limiters use sliding window algorithm for precision
 */

// Public endpoints: 30 requests per minute
export const publicLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  ephemeralCache: new Map(),
  prefix: '@ratelimit/public',
});

// Authenticated user endpoints: 100 requests per minute
export const userLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  ephemeralCache: new Map(),
  prefix: '@ratelimit/user',
});

// Sensitive/admin endpoints: 10 requests per minute
export const sensitiveLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'),
  ephemeralCache: new Map(),
  prefix: '@ratelimit/sensitive',
});

// File upload endpoints: 5 requests per 5 minutes (lower rate for large files)
export const uploadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '5 m'),
  ephemeralCache: new Map(),
  prefix: '@ratelimit/upload',
});

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
