import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { isTeamRole } from '@/lib/capabilities';
import PortalHeader from '@/components/portal/PortalHeader';
import PortalNav from '@/components/portal/PortalNav';
import { getTwoFactorEnabled } from '@/lib/mfa-status';
import { shouldAdviseMfa } from '@/lib/mfa';
import { MfaAdviceBanner } from '@/components/security/MfaAdviceBanner';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in?next=/portal');
  const role = await getUserRole(session.user.email);
  if (isTeamRole(role)) redirect('/workspace');

  // Optional but strongly advised. Read from the database: the session cache can lag.
  const twoFactorEnabled = await getTwoFactorEnabled(session.user.id);

  const name = session.user.name?.trim() || session.user.email?.split('@')[0] || 'Client';
  return (
    <div className="portal-shell min-h-screen">
      <PortalHeader userName={name.split(' ')[0] || 'Client'} />
      <PortalNav />
      {shouldAdviseMfa(twoFactorEnabled) && <MfaAdviceBanner audience="client" />}
      {children}
    </div>
  );
}
