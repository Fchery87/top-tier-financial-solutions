import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole, type UserRole } from '@/lib/admin-auth';

export interface AdminSessionUser {
  id: string;
  email: string;
  role: UserRole;
}

export async function getAdminSessionUser(
  minimumRole: 'admin' | 'super_admin' = 'super_admin'
): Promise<AdminSessionUser | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.email || !session.user.id) {
    return null;
  }

  const role = await getUserRole(session.user.email);
  if (!role) {
    return null;
  }

  const allowed =
    minimumRole === 'admin'
      ? role === 'admin' || role === 'super_admin'
      : role === 'super_admin';

  if (!allowed) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role,
  };
}
