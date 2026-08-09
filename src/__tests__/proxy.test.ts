import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('proxy security headers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('rewrites legacy admin API requests to the workspace namespace with deprecation metadata', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T12:00:00.000Z'));

    const response = proxy(new NextRequest('https://example.com/api/admin/clients?limit=10'));

    expect(response.headers.get('x-middleware-rewrite')).toBe('https://example.com/api/workspace/clients?limit=10');
    expect(response.headers.get('Deprecation')).toBe('true');
    expect(response.headers.get('Sunset')).toBe('Fri, 07 Nov 2026 00:00:00 GMT');
    expect(response.headers.get('Link')).toBe('</api/workspace/clients?limit=10>; rel="successor-version"');
    expect(response.headers.get('x-middleware-request-x-api-namespace')).toBe('legacy-admin');
  });

  it('does not add deprecation metadata to canonical workspace API requests', () => {
    const response = proxy(new NextRequest('https://example.com/api/workspace/clients?limit=10'));

    expect(response.headers.get('Deprecation')).toBeNull();
    expect(response.headers.get('Sunset')).toBeNull();
    expect(response.headers.get('Link')).toBeNull();
  });

  it('returns a generic 410 response for legacy API requests after the sunset', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T00:00:00.000Z'));

    const response = proxy(new NextRequest('https://example.com/api/admin/clients'));

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ error: 'API endpoint retired' });
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('allows Next development runtime connections', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const response = proxy(new NextRequest('http://localhost/admin/messages'));
    const csp = response.headers.get('Content-Security-Policy') ?? '';

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain('ws:');
    expect(csp).toContain('http://localhost:*');
    expect(csp).toContain('http://127.0.0.1:*');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('keeps production CSP strict', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = proxy(new NextRequest('https://example.com/admin/messages'));
    const csp = response.headers.get('Content-Security-Policy') ?? '';

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('http://localhost:*');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('generates and forwards a request identifier instead of trusting client input', () => {
    const response = proxy(new NextRequest('https://example.com/admin/messages', {
      headers: { 'x-request-id': 'client-controlled-id' },
    }));
    const requestId = response.headers.get('x-request-id');

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(requestId).not.toBe('client-controlled-id');
    expect(response.headers.get('x-middleware-request-x-request-id')).toBe(requestId);
    expect(response.headers.get('x-middleware-override-headers')).toContain('x-request-id');
  });
});
