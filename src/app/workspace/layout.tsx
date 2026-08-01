import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { isTeamRole } from '@/lib/capabilities';
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) redirect('/sign-in?next=/workspace');

  // Re-query the role from the database rather than trust session.user.role:
  // the session's cookieCache (see auth.ts) can serve a role for up to 5
  // minutes without hitting the DB, which would let a role that was just
  // revoked (demotion/ban) stay effective past that window if trusted here.
  const role = await getUserRole(session.user.email);
  if (!isTeamRole(role)) redirect('/portal');

  return (
    <WorkspaceShell role={role} userId={session.user.id} userEmail={session.user.email}>
      {children}
    </WorkspaceShell>
  );
}
