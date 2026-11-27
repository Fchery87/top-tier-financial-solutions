// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const sendCustomEmailMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/email-service', () => ({ sendCustomEmail: sendCustomEmailMock }));
vi.mock('@/lib/server-logger', () => ({ logServerEvent: vi.fn() }));

describe('sendNewsletterConfirmationEmail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-with-at-least-32-characters!!');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.test');
  });

  it('emails a working confirmation link to the address', async () => {
    sendCustomEmailMock.mockResolvedValue({ success: true, logId: 'l' });
    const { sendNewsletterConfirmationEmail } = await import('@/lib/newsletter-confirmation-email');
    const { verifyConfirmToken } = await import('@/lib/newsletter-confirm-token');

    await sendNewsletterConfirmationEmail('sub-7', 'person@example.com');

    const [to, , html, options] = sendCustomEmailMock.mock.calls[0];
    expect(to).toBe('person@example.com');
    const href = /href="([^"]+)"/.exec(html)![1];
    const url = new URL(href);
    expect(url.origin).toBe('https://example.test');
    expect(url.pathname).toBe('/newsletter/confirm');
    expect(verifyConfirmToken(url.searchParams.get('token')!)).toBe('sub-7');
    expect(options.text).toContain(href);
  });

  it('never throws, even when delivery fails or the provider errors', async () => {
    const { sendNewsletterConfirmationEmail } = await import('@/lib/newsletter-confirmation-email');
    sendCustomEmailMock.mockResolvedValue({ success: false, logId: 'l', error: 'boom' });
    await expect(sendNewsletterConfirmationEmail('s', 'a@b.co')).resolves.toBeUndefined();
    sendCustomEmailMock.mockRejectedValue(new Error('network'));
    await expect(sendNewsletterConfirmationEmail('s', 'a@b.co')).resolves.toBeUndefined();
  });
});
