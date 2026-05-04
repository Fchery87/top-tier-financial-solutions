import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '@/lib/safe-html';

describe('sanitizeHtml', () => {
  it('removes executable HTML while preserving simple formatting', () => {
    const sanitized = sanitizeHtml('<p onclick="alert(1)">Hello <strong>client</strong></p><script>alert(1)</script><img src=x onerror="alert(1)">');

    expect(sanitized).toContain('<p>Hello <strong>client</strong></p>');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('<img');
  });
});
