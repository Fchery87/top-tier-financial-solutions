import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { user } from '@/db/schema';
import { logServerEvent } from '@/lib/server-logger';

/**
 * Reads `user.twoFactorEnabled` straight from the database, the same way
 * `getUserRole` reads the role: the session cookie cache can be up to five
 * minutes stale, so it is never trusted for MFA decisions.
 *
 * Returns null when the user is missing or the read fails. Callers treat null
 * as "not enrolled", so a failed read fails closed for team roles.
 */
export async function getTwoFactorEnabled(userId: string): Promise<boolean | null> {
  try {
    const rows = await db
      .select({ twoFactorEnabled: user.twoFactorEnabled })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (rows.length === 0) return null;
    return rows[0].twoFactorEnabled === true;
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.lib.mfa.status.error', error });
    return null;
  }
}
