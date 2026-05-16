import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('proxy security headers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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
});
