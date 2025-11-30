import { sql } from 'drizzle-orm';
import { db } from './client';

export async function syncNeonAuthUsers() {
  try {
    await db.execute(
      sql`
        INSERT INTO users (name, email, created_at)
        SELECT name, email, created_at FROM neon_auth.users_sync
        WHERE deleted_at IS NULL
        AND email NOT IN (SELECT email FROM users)
        ON CONFLICT (email) DO NOTHING
      `
    );

    return { success: true, message: 'Users synced successfully' };
  } catch (error) {
    console.error('Error syncing Neon Auth users:', error);
    return { success: false, error: (error as Error).message };
  }
}
