'use client';

import Link from 'next/link';
import { ShieldCheck, ShieldPlus } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MFA_ENROLLMENT_PATH } from '@/lib/mfa';

/**
 * Optional two-factor prompt for portal clients. Never forced: it only links
 * to the shared enrollment page. The status comes from the session, which can
 * lag a few minutes behind a change; that is fine for a display hint, and the
 * enrollment page reads the authoritative value from the database.
 */
export default function PortalTwoFactorCard() {
  const { data } = useSession();
  const enabled = data?.user?.twoFactorEnabled === true;

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="font-display text-xl flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="w-5 h-5 text-success" aria-hidden />
          ) : (
            <ShieldPlus className="w-5 h-5 text-secondary" aria-hidden />
          )}
          Two-factor authentication
        </CardTitle>
        <CardDescription>
          {enabled
            ? 'On. Your sign-in also needs a code from your authenticator app.'
            : 'Optional. Add a code from an authenticator app to your sign-in for extra protection.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href={MFA_ENROLLMENT_PATH}>{enabled ? 'Manage two-factor' : 'Set up two-factor'}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
