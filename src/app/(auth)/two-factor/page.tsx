'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { twoFactor } from '@/lib/auth-client';
import { describeTwoFactorError } from '@/lib/two-factor-messages';
import { resolvePostSignInLanding } from '@/lib/post-sign-in-landing';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { Loader2, KeyRound, ShieldCheck, ArrowLeft } from 'lucide-react';

type Method = 'totp' | 'backup';

export default function TwoFactorChallengePage() {
  const [method, setMethod] = useState<Method>('totp');
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const switchMethod = () => {
    setMethod((current) => (current === 'totp' ? 'backup' : 'totp'));
    setCode('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const trimmed = code.trim();
      const result =
        method === 'totp'
          ? await twoFactor.verifyTotp({ code: trimmed.replace(/\s+/g, ''), trustDevice })
          : await twoFactor.verifyBackupCode({ code: trimmed, trustDevice });

      if (result.error) {
        setError(describeTwoFactorError(result.error));
        return;
      }

      const next = new URLSearchParams(window.location.search).get('next');
      router.push(await resolvePostSignInLanding(next));
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isTotp = method === 'totp';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Two-step verification</h1>
          <p className="text-muted-foreground mt-2">
            {isTotp
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Enter one of the backup codes you saved when you set up two-step verification.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-foreground mb-2">
              {isTotp ? 'Authentication code' : 'Backup code'}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 flex items-center pointer-events-none">
                {isTotp ? (
                  <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <KeyRound className="w-5 h-5 text-muted-foreground" />
                )}
              </span>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode={isTotp ? 'numeric' : 'text'}
                pattern={isTotp ? '[0-9 ]{6,7}' : undefined}
                maxLength={isTotp ? 7 : 32}
                className="w-full h-12 pl-11 pr-4 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all text-foreground placeholder:text-muted-foreground tracking-widest"
                placeholder={isTotp ? '123456' : 'xxxxx-xxxxx'}
              />
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <span>
              Trust this device for 30 days
              <span className="block text-muted-foreground">
                Only on a private device you use yourself. You will still need your password.
              </span>
            </span>
          </label>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>
        </form>

        <div className="text-center space-y-4">
          <button
            type="button"
            onClick={switchMethod}
            className="text-secondary hover:underline font-medium"
          >
            {isTotp ? 'Use a backup code instead' : 'Use my authenticator app instead'}
          </button>
          <div>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
