import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { MFA_ENROLLMENT_PATH } from '@/lib/mfa';

/**
 * Persistent advice for anyone who has not turned on two-factor authentication.
 * Two-factor is optional, so this is the nudge: it stays on every page until the
 * user enrolls. It is deliberately not dismissible.
 */
export function MfaAdviceBanner({ audience }: { audience: 'team' | 'client' }) {
  const message = audience === 'team'
    ? 'Your account can open client credit files and personal data. Two-factor authentication keeps it safe even if your password is stolen. We strongly recommend turning it on.'
    : 'Your account holds your credit and personal information. Two-factor authentication keeps it safe even if your password is stolen. We strongly recommend turning it on.';

  return (
    <div
      role="region"
      aria-label="Security recommendation"
      className="flex flex-col gap-3 border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between md:px-6"
    >
      <p className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <span>
          <strong className="font-semibold">Turn on two-factor authentication.</strong> {message}
        </span>
      </p>
      <Link
        href={MFA_ENROLLMENT_PATH}
        className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Set up now
      </Link>
    </div>
  );
}
