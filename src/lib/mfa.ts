import { isTeamRole } from '@/lib/capabilities';

/**
 * Multi-factor authentication policy, shared by page layouts, API capability
 * checks, and the better-auth hooks. Pure: callers pass the role and the
 * `twoFactorEnabled` flag they read from the database.
 *
 * Policy (operator decision): two-factor authentication is OPTIONAL for everyone,
 * team and clients alike, and strongly advised: users who have not enrolled see a
 * persistent banner (see `MfaAdviceBanner`) pointing at the enrollment page.
 *
 * The enforcement machinery stays in place behind one switch. Setting the
 * environment variable `MFA_REQUIRED_FOR_TEAM=true` makes it mandatory for every
 * team role again (staff, admin, super_admin): the workspace and admin layouts
 * redirect unenrolled team members to enrollment, APIs answer 403
 * `MFA_ENROLLMENT_REQUIRED`, and team members can't turn it off.
 */
export type MfaRequirement = 'not_required' | 'enrolled' | 'enrollment_required';

/** Where a user enrolls in, or manages, two-factor authentication. */
export const MFA_ENROLLMENT_PATH = '/settings/security';

/** Body code returned by APIs when a team member has not enrolled yet. */
export const MFA_ENROLLMENT_REQUIRED_CODE = 'MFA_ENROLLMENT_REQUIRED';

export function isMfaRequiredForRole(role: unknown): boolean {
  return isTeamRole(role) && process.env.MFA_REQUIRED_FOR_TEAM === 'true';
}

/** Anyone who has not enrolled is advised to, whatever their role. */
export function shouldAdviseMfa(twoFactorEnabled: boolean | null | undefined): boolean {
  return twoFactorEnabled !== true;
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
