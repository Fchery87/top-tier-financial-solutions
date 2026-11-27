import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed, expiring double opt-in confirmation tokens.
 *
 * Format: `<base64url(subscriberId)>.<expiresAtMs>.<base64url(HMAC-SHA256)>`.
 * The HMAC covers the id and expiry under a domain prefix, so a confirmation token
 * can never be replayed as an unsubscribe token (or the reverse) and the expiry
 * can't be extended without the secret.
 */
const TOKEN_DOMAIN = 'newsletter-confirm:v1:';
const MAX_TOKEN_LENGTH = 512;

export const CONFIRM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSigningSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required to sign newsletter confirmation tokens');
  }
  return secret;
}

function sign(subscriberId: string, expiresAt: number): Buffer {
  return createHmac('sha256', getSigningSecret())
    .update(`${TOKEN_DOMAIN}${subscriberId}.${expiresAt}`)
    .digest();
}

export function createConfirmToken(subscriberId: string, now: number = Date.now()): string {
  const expiresAt = now + CONFIRM_TOKEN_TTL_MS;
  const id = Buffer.from(subscriberId, 'utf8').toString('base64url');
  return `${id}.${expiresAt}.${sign(subscriberId, expiresAt).toString('base64url')}`;
}

/** Returns the subscriber id when the token is authentic and unexpired, otherwise null. */
export function verifyConfirmToken(token: string, now: number = Date.now()): string | null {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;

  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  if (!/^\d{1,16}$/.test(parts[1])) return null;

  const subscriberId = Buffer.from(parts[0], 'base64url').toString('utf8');
  if (!subscriberId) return null;
  const expiresAt = Number(parts[1]);

  const provided = Buffer.from(parts[2], 'base64url');
  const expected = sign(subscriberId, expiresAt);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  if (now > expiresAt) return null;
  return subscriberId;
}

export function buildConfirmUrl(subscriberId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/newsletter/confirm?token=${encodeURIComponent(createConfirmToken(subscriberId))}`;
}
