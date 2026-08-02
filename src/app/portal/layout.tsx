import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { isTeamRole } from '@/lib/capabilities';
import PortalHeader from '@/components/portal/PortalHeader';
import PortalNav from '@/components/portal/PortalNav';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in?next=/portal');
  const role = await getUserRole(session.user.email);
  if (isTeamRole(role)) redirect('/workspace');

  const name = session.user.name?.trim() || session.user.email?.split('@')[0] || 'Client';
  return (
    <div className="portal-shell min-h-screen">
      <PortalHeader userName={name.split(' ')[0] || 'Client'} />
      <PortalNav />
      {children}
    </div>
  );
}
