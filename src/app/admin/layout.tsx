import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { getTwoFactorEnabled } from '@/lib/mfa-status';
import { decideMfaRequirement, MFA_ENROLLMENT_PATH } from '@/lib/mfa';
import { isTeamRole, can } from '@/lib/capabilities';
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) redirect('/sign-in?next=/admin');

  // Re-query the role from the database rather than trust session.user.role:
  // the session's cookieCache (see auth.ts) can serve a role for up to 5
  // minutes without hitting the DB, which would let a role that was just
  // revoked (demotion/ban) stay effective past that window if trusted here.
  const role = await getUserRole(session.user.email);
  if (!isTeamRole(role)) redirect('/portal');

  // MFA is required for team roles. Read the flag from the database for the
  // same reason as the role. The enrollment page lives outside this layout.
  const twoFactorEnabled = await getTwoFactorEnabled(session.user.id);
  if (decideMfaRequirement({ role, twoFactorEnabled }) === 'enrollment_required') {
    redirect(MFA_ENROLLMENT_PATH);
  }
  if (!can(role, 'content:write')) redirect('/workspace');

  return (
    <WorkspaceShell role={role} userId={session.user.id} userEmail={session.user.email}>
      {children}
    </WorkspaceShell>
  );
}
