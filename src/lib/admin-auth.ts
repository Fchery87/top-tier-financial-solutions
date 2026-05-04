import { db } from '@/db/client';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type UserRole = 'user' | 'admin' | 'super_admin';
export type AdminPermission = 'tasks:read' | 'tasks:create';

export async function getUserRole(email: string): Promise<UserRole | null> {
  try {
    const result = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.email, email))
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

const rolePermissions: Record<UserRole, AdminPermission[]> = {
  user: [],
  admin: ['tasks:read', 'tasks:create'],
  super_admin: ['tasks:read', 'tasks:create'],
};

export function roleHasPermission(role: UserRole, permission: AdminPermission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}
