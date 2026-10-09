import { isTeamRole } from '@/lib/capabilities';

/**
 * Multi-factor authentication policy, shared by page layouts, API capability
 * checks, and the better-auth hooks. Pure: callers pass the role and the
 * `twoFactorEnabled` flag they read from the database.
 *
 * Policy (operator decision): MFA is required for every team role
 * (staff, admin, super_admin) and optional for portal clients.
 */
export type MfaRequirement = 'not_required' | 'enrolled' | 'enrollment_required';

/** Where a user enrolls in, or manages, two-factor authentication. */
export const MFA_ENROLLMENT_PATH = '/settings/security';

/** Body code returned by APIs when a team member has not enrolled yet. */
export const MFA_ENROLLMENT_REQUIRED_CODE = 'MFA_ENROLLMENT_REQUIRED';

export function isMfaRequiredForRole(role: unknown): boolean {
  return isTeamRole(role);
}

export function decideMfaRequirement({
  role,
  twoFactorEnabled,
}: {
  role: unknown;
  twoFactorEnabled: boolean | null | undefined;
}): MfaRequirement {
  if (twoFactorEnabled === true) return 'enrolled';
  return isMfaRequiredForRole(role) ? 'enrollment_required' : 'not_required';
}
