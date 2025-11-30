import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type UserRole = 'user' | 'admin' | 'super_admin';

export async function getUserRole(email: string): Promise<UserRole | null> {
  try {
    const result = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return (result[0].role as UserRole) || 'user';
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
}

export async function isSuperAdmin(email: string): Promise<boolean> {
  const role = await getUserRole(email);
  return role === 'super_admin';
}

export async function isAdmin(email: string): Promise<boolean> {
  const role = await getUserRole(email);
  return role === 'admin' || role === 'super_admin';
}
