import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { getTwoFactorEnabled } from '@/lib/mfa-status';
import { decideMfaRequirement, isMfaRequiredForRole, MFA_ENROLLMENT_PATH } from '@/lib/mfa';
import { isTeamRole } from '@/lib/capabilities';
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings';

export const metadata: Metadata = {
  title: 'Security settings',
  robots: { index: false, follow: false },
};

// This page is the MFA enrollment exemption: staff without MFA are sent here
// by the workspace and admin layouts, so it must never itself require MFA.
export default async function SecuritySettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) redirect(`/sign-in?next=${MFA_ENROLLMENT_PATH}`);

  const [role, twoFactorEnabled] = await Promise.all([
    getUserRole(session.user.email),
    getTwoFactorEnabled(session.user.id),
  ]);
  const requirement = decideMfaRequirement({ role, twoFactorEnabled });

  return (
    <main className="min-h-screen bg-background pt-28 pb-16 md:pt-36">
      <div className="container mx-auto max-w-2xl px-4 md:px-6">
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">Security</h1>
        <p className="mt-2 text-muted-foreground">
          Protect your account with two-step verification.
        </p>
        <div className="mt-8">
          <TwoFactorSettings
            enabled={twoFactorEnabled === true}
            required={isMfaRequiredForRole(role)}
            enrollmentRequired={requirement === 'enrollment_required'}
            continueHref={isTeamRole(role) ? '/workspace' : '/portal'}
          />
        </div>
      </div>
    </main>
  );
}
