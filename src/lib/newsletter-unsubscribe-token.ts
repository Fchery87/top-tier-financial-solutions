import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed, per-subscriber unsubscribe tokens.
 *
 * Format: `<base64url(subscriberId)>.<base64url(HMAC-SHA256)>`.
 * Tokens intentionally never expire: unsubscribe links in old emails must keep working.
 * The HMAC input is domain-separated so it can't be replayed for any other purpose.
 */
const TOKEN_DOMAIN = 'newsletter-unsubscribe:v1:';
const MAX_TOKEN_LENGTH = 512;

function getSigningSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required to sign newsletter unsubscribe tokens');
  }
  return secret;
}

function sign(subscriberId: string): Buffer {
  return createHmac('sha256', getSigningSecret()).update(TOKEN_DOMAIN + subscriberId).digest();
}

export function createUnsubscribeToken(subscriberId: string): string {
  const id = Buffer.from(subscriberId, 'utf8').toString('base64url');
  return `${id}.${sign(subscriberId).toString('base64url')}`;
}

/** Returns the subscriber id when the token is authentic, otherwise null. */
export function verifyUnsubscribeToken(token: string): string | null {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const subscriberId = Buffer.from(parts[0], 'base64url').toString('utf8');
  if (!subscriberId) return null;

  const provided = Buffer.from(parts[1], 'base64url');
  const expected = sign(subscriberId);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  return subscriberId;
}

export function buildUnsubscribeUrl(subscriberId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(subscriberId))}`;
}
