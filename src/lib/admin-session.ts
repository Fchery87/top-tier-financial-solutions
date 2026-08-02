import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole, type UserRole } from '@/lib/admin-auth';
import { can, type Capability } from '@/lib/capabilities';

export interface AdminSessionUser {
  id: string;
  email: string;
  role: UserRole;
}

export async function requireCapability(
  capability: Capability
): Promise<AdminSessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email || !session.user.id) return null;

  const role = await getUserRole(session.user.email);
  if (!can(role, capability)) return null;

  return { id: session.user.id, email: session.user.email, role: role! };
}
