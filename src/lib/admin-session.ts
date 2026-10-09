import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole, type UserRole } from '@/lib/admin-auth';
import { can, type Capability } from '@/lib/capabilities';
import { decideMfaRequirement } from '@/lib/mfa';
import { getTwoFactorEnabled } from '@/lib/mfa-status';
import { recordMfaEnrollmentDenial } from '@/lib/capability-denial';

export interface AdminSessionUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * Authorizes the current request for `capability`. Returns the user, or null
 * for any refusal: no session, a role without the capability, or a team
 * member who has not enrolled in MFA. Role and MFA status are read from the
 * database on every call, never from the session cookie cache.
 *
 * Callers return their usual denial wrapped in `capabilityDeniedResponse()`
 * so the MFA refusal surfaces as 403 `{ code: 'MFA_ENROLLMENT_REQUIRED' }`.
 */
export async function requireCapability(
  capability: Capability
): Promise<AdminSessionUser | null> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user?.email || !session.user.id) return null;

  const role = await getUserRole(session.user.email);
  if (!can(role, capability)) return null;

  const twoFactorEnabled = await getTwoFactorEnabled(session.user.id);
  if (decideMfaRequirement({ role, twoFactorEnabled }) === 'enrollment_required') {
    recordMfaEnrollmentDenial(requestHeaders);
    return null;
  }

  return { id: session.user.id, email: session.user.email, role: role! };
}
