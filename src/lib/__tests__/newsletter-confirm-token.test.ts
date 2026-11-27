// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONFIRM_TOKEN_TTL_MS,
  buildConfirmUrl,
  createConfirmToken,
  verifyConfirmToken,
} from '@/lib/newsletter-confirm-token';
import { createUnsubscribeToken } from '@/lib/newsletter-unsubscribe-token';

describe('newsletter confirmation tokens', () => {
  const original = process.env.BETTER_AUTH_SECRET;
  beforeEach(() => { process.env.BETTER_AUTH_SECRET = 'test-secret-for-confirm-tokens'; });
  afterEach(() => { process.env.BETTER_AUTH_SECRET = original; });

  it('round-trips a subscriber id', () => {
    const now = 1_800_000_000_000;
    expect(verifyConfirmToken(createConfirmToken('sub-1', now), now + 1000)).toBe('sub-1');
  });

  it('rejects an expired token and accepts one at the last moment', () => {
    const now = 1_800_000_000_000;
    const token = createConfirmToken('sub-1', now);
    expect(verifyConfirmToken(token, now + CONFIRM_TOKEN_TTL_MS)).toBe('sub-1');
    expect(verifyConfirmToken(token, now + CONFIRM_TOKEN_TTL_MS + 1)).toBeNull();
  });

  it('rejects a token whose expiry was extended', () => {
    const now = 1_800_000_000_000;
    const [id, , sig] = createConfirmToken('sub-1', now).split('.');
    const forged = `${id}.${now + CONFIRM_TOKEN_TTL_MS * 10}.${sig}`;
    expect(verifyConfirmToken(forged, now + CONFIRM_TOKEN_TTL_MS + 5)).toBeNull();
  });

  it('rejects a token for a different subscriber id', () => {
    const now = 1_800_000_000_000;
    const [, exp, sig] = createConfirmToken('sub-1', now).split('.');
    const otherId = Buffer.from('sub-2').toString('base64url');
    expect(verifyConfirmToken(`${otherId}.${exp}.${sig}`, now)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = createConfirmToken('sub-1');
    process.env.BETTER_AUTH_SECRET = 'another-secret';
    expect(verifyConfirmToken(token)).toBeNull();
  });

  it('is not interchangeable with unsubscribe tokens', () => {
    expect(verifyConfirmToken(createUnsubscribeToken('sub-1'))).toBeNull();
  });

  it.each(['', 'garbage', 'a.b', 'a.b.c.d', '..', `${'x'.repeat(600)}`])('rejects malformed token %#', (t) => {
    expect(verifyConfirmToken(t)).toBeNull();
  });

  it('builds a confirmation URL carrying a verifiable token', () => {
    const url = new URL(buildConfirmUrl('sub-9'));
    expect(url.pathname).toBe('/newsletter/confirm');
    expect(verifyConfirmToken(url.searchParams.get('token') ?? '')).toBe('sub-9');
  });
});
