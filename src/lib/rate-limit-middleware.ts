import { NextRequest, NextResponse } from 'next/server';
import type { Ratelimit } from '@upstash/ratelimit';
import { getRateLimitKey, formatRateLimitHeaders } from './rate-limit';

/**
 * Applies rate limiting to an API route handler
 * Returns 429 (Too Many Requests) when limit exceeded
 */
export async function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  limiter: Ratelimit,
  options?: {
    keyExtractor?: (request: NextRequest) => string;
    userId?: string;
    onLimitExceeded?: (request: NextRequest) => NextResponse;
  }
): Promise<(request: NextRequest) => Promise<NextResponse>> {
  return async (request: NextRequest) => {
    try {
      // Get the rate limit key (user ID or IP)
      const key = options?.keyExtractor
        ? options.keyExtractor(request)
        : getRateLimitKey(request, options?.userId);

      // Check rate limit
      const { success, limit, remaining, reset, pending } = await limiter.limit(
        key
      );

      // Wait for analytics to be processed (Upstash feature)
      if (pending) await pending;

      // If rate limited, return 429 response
      if (!success) {
        const headers = formatRateLimitHeaders(limit, 0, reset);
        const response =
          options?.onLimitExceeded?.(request) ||
          NextResponse.json(
            {
              error: 'Rate limit exceeded',
              retryAfter: new Date(reset * 1000).toISOString(),
            },
            { status: 429, headers }
          );
        return response;
      }

      // Call the actual handler
      const response = await handler(request);

      // Add rate limit headers to response
      const headers = formatRateLimitHeaders(limit, remaining, reset);
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      // If rate limiting fails, allow request to proceed (graceful degradation)
      console.error('[Rate Limit Error]', error);
      return handler(request);
    }
  };
}

/**
 * HOF to wrap an individual route handler with rate limiting
 * Usage:
 *   export const POST = rateLimited(sensitiveLimiter)(async (req) => {...})
 */
export function rateLimited(
  limiter: Ratelimit,
  options?: {
    keyExtractor?: (request: NextRequest) => string;
  }
) {
  return (
    handler: (request: NextRequest) => Promise<NextResponse>
  ): ((request: NextRequest) => Promise<NextResponse>) => {
    return async (request: NextRequest): Promise<NextResponse> => {
      try {
        const key = options?.keyExtractor
          ? options.keyExtractor(request)
          : getRateLimitKey(request);

        const { success, limit, remaining, reset, pending } = await limiter.limit(
          key
        );

        if (pending) await pending;

        if (!success) {
          const headers = formatRateLimitHeaders(limit, 0, reset);
          return NextResponse.json(
            {
              error: 'Rate limit exceeded',
              retryAfter: new Date(reset * 1000).toISOString(),
            },
            { status: 429, headers }
          );
        }

        const response = await handler(request);
        const responseHeaders = formatRateLimitHeaders(limit, remaining, reset);
        Object.entries(responseHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        return response;
      } catch (error) {
        console.error('[Rate Limit Error]', error);
        return handler(request);
      }
    };
  };
}
