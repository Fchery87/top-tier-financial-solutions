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

  const role = await getUserRole(session.user.email);
  if (!isTeamRole(role)) redirect('/portal');

  return (
    <WorkspaceShell role={role} userId={session.user.id} userEmail={session.user.email}>
      {children}
    </WorkspaceShell>
  );
}
