import { db } from '@/db/client';
import { emailSubscribers } from '@/db/schema';
import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm';

/**
 * A confirmation link lives 7 days, so a signup still unconfirmed after this long
 * is abandoned. Kept well past the link lifetime so a late click on an expired
 * link still lets the person sign up again without hitting a stale row.
 */
export const STALE_PENDING_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export interface PendingCleanupResult {
  deleted: number;
  restoredToUnsubscribed: number;
}

/**
 * Cleans up signups that never confirmed.
 *
 * - Never-subscribed rows (no `unsubscribedAt`) are deleted: nothing was ever
 *   agreed to, and the address shouldn't be kept.
 * - Rows that were previously unsubscribed and then went back to `pending` are
 *   returned to `unsubscribed`, never deleted, so the opt-out record survives.
 *
 * Only rows whose last activity (signup or last confirmation email) is older
 * than the cutoff are touched.
 */
export async function cleanUpStalePendingSubscribers(now: Date = new Date()): Promise<PendingCleanupResult> {
  const cutoff = new Date(now.getTime() - STALE_PENDING_AFTER_MS);

  const deleted = await db
    .delete(emailSubscribers)
    .where(and(
      eq(emailSubscribers.status, 'pending'),
      isNull(emailSubscribers.unsubscribedAt),
      lt(emailSubscribers.updatedAt, cutoff),
    ))
    .returning({ id: emailSubscribers.id });

  const restored = await db
    .update(emailSubscribers)
    .set({ status: 'unsubscribed', updatedAt: now })
    .where(and(
      eq(emailSubscribers.status, 'pending'),
      isNotNull(emailSubscribers.unsubscribedAt),
      lt(emailSubscribers.updatedAt, cutoff),
    ))
    .returning({ id: emailSubscribers.id });

  return { deleted: deleted.length, restoredToUnsubscribed: restored.length };
}
