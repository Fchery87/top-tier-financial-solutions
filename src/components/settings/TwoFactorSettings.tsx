'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, ShieldCheck, ShieldAlert, Copy, Download, Check } from 'lucide-react';
import { twoFactor } from '@/lib/auth-client';
import { describeTwoFactorError } from '@/lib/two-factor-messages';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

interface TwoFactorSettingsProps {
  /** `user.twoFactorEnabled`, read from the database by the server page. */
  enabled: boolean;
  /** True for team roles: MFA is mandatory and cannot be turned off. */
  required: boolean;
  /** True when a team member still has to enroll before using the workspace. */
  enrollmentRequired: boolean;
  /** Where to go once enrollment is done. */
  continueHref: string;
}

type Step =
  | { kind: 'idle' }
  | { kind: 'password'; action: 'enable' | 'regenerate' | 'disable' }
  | { kind: 'scan'; totpURI: string; backupCodes: string[] }
  | { kind: 'codes'; backupCodes: string[]; justEnabled: boolean };

const inputClass =
  'w-full h-11 px-4 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent text-foreground placeholder:text-muted-foreground';

export function secretFromTotpUri(totpURI: string): string {
  try {
    return new URL(totpURI).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

export function TwoFactorSettings({ enabled, required, enrollmentRequired, continueHref }: TwoFactorSettingsProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>({ kind: 'idle' });
  const [password, setPassword] = React.useState('');
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setStep({ kind: 'idle' });
    setPassword('');
    setCode('');
    setError('');
  };

  const submitPassword = async (e: React.FormEvent, action: 'enable' | 'regenerate' | 'disable') => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (action === 'enable') {
        const result = await twoFactor.enable({ password });
        if (result.error || !result.data) return setError(describeTwoFactorError(result.error));
        setStep({ kind: 'scan', totpURI: result.data.totpURI, backupCodes: result.data.backupCodes });
      } else if (action === 'regenerate') {
        const result = await twoFactor.generateBackupCodes({ password });
        if (result.error || !result.data) return setError(describeTwoFactorError(result.error));
        setStep({ kind: 'codes', backupCodes: result.data.backupCodes, justEnabled: false });
      } else {
        const result = await twoFactor.disable({ password });
        if (result.error) return setError(describeTwoFactorError(result.error));
        reset();
        router.refresh();
      }
      setPassword('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (e: React.FormEvent, backupCodes: string[]) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await twoFactor.verifyTotp({ code: code.replace(/\s+/g, '') });
      if (result.error) return setError(describeTwoFactorError(result.error));
      setCode('');
      setStep({ kind: 'codes', backupCodes, justEnabled: true });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const finishCodes = () => {
    reset();
    router.refresh();
  };

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <CardTitle className="font-sans text-xl flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="w-5 h-5 text-success" aria-hidden />
          ) : (
            <ShieldAlert className="w-5 h-5 text-secondary" aria-hidden />
          )}
          Two-factor authentication
        </CardTitle>
        <CardDescription>
          {enabled
            ? 'On. Signing in needs your password and a code from your authenticator app.'
            : 'Off. Add a code from an authenticator app (such as Google Authenticator, 1Password, or Authy) to your sign-in.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {enrollmentRequired && step.kind !== 'codes' && (
          <div role="status" className="rounded-lg border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-foreground">
            Team accounts must use two-factor authentication. Set it up here to continue to the workspace.
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step.kind === 'idle' && (
          <div className="flex flex-wrap gap-3">
            {!enabled && (
              <Button onClick={() => setStep({ kind: 'password', action: 'enable' })}>Set up two-factor authentication</Button>
            )}
            {enabled && (
              <Button variant="outline" onClick={() => setStep({ kind: 'password', action: 'regenerate' })}>
                Get new backup codes
              </Button>
            )}
            {enabled && !required && (
              <Button variant="destructive" onClick={() => setStep({ kind: 'password', action: 'disable' })}>
                Turn off
              </Button>
            )}
            {enabled && required && (
              <p className="w-full text-sm text-muted-foreground">
                Two-factor authentication is required for team accounts, so it can&apos;t be turned off.
              </p>
            )}
          </div>
        )}

        {step.kind === 'password' && (
          <form onSubmit={(e) => submitPassword(e, step.action)} className="space-y-4">
            <div>
              <label htmlFor="mfa-password" className="block text-sm font-medium text-foreground mb-2">
                Enter your password to continue
              </label>
              <input
                id="mfa-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className={inputClass}
              />
            </div>
            {step.action === 'regenerate' && (
              <p className="text-sm text-muted-foreground">Your old backup codes will stop working.</p>
            )}
            {step.action === 'disable' && (
              <p className="text-sm text-muted-foreground">Your account will be protected by your password only.</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={busy} variant={step.action === 'disable' ? 'destructive' : 'primary'}>
                {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {step.action === 'enable' ? 'Continue' : step.action === 'regenerate' ? 'Get new codes' : 'Turn off'}
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {step.kind === 'scan' && (
          <form onSubmit={(e) => confirmCode(e, step.backupCodes)} className="space-y-5">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
              <li>Open your authenticator app and scan this QR code.</li>
              <li>Enter the 6-digit code the app shows to finish.</li>
            </ol>
            <div className="flex justify-center rounded-lg bg-white p-4">
              <QRCodeSVG value={step.totpURI} size={192} level="M" title="Two-factor authentication QR code" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Can&apos;t scan? Enter this key in the app instead:</p>
              <code className="block break-all rounded-lg bg-muted/40 px-3 py-2 font-mono text-sm text-foreground select-all">
                {secretFromTotpUri(step.totpURI)}
              </code>
            </div>
            <div>
              <label htmlFor="mfa-code" className="block text-sm font-medium text-foreground mb-2">
                6-digit code
              </label>
              <input
                id="mfa-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                placeholder="123456"
                className={`${inputClass} tracking-widest`}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Turn on
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {step.kind === 'codes' && (
          <BackupCodes
            codes={step.backupCodes}
            justEnabled={step.justEnabled}
            onDone={finishCodes}
            continueHref={step.justEnabled && required ? continueHref : null}
          />
        )}
      </CardContent>
    </Card>
  );
}

function BackupCodes({
  codes,
  justEnabled,
  onDone,
  continueHref,
}: {
  codes: string[];
  justEnabled: boolean;
  onDone: () => void;
  continueHref: string | null;
}) {
  const [copied, setCopied] = React.useState(false);
  const text = codes.join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob(
      [`Top Tier Financial Solutions backup codes\nEach code works once.\n\n${text}\n`],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'top-tier-backup-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {justEnabled && (
        <p role="status" className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground">
          Two-factor authentication is on.
        </p>
      )}
      <div>
        <p className="font-medium text-foreground">Save your backup codes</p>
        <p className="text-sm text-muted-foreground">
          If you lose your phone, each code lets you sign in once. This is the only time they are shown.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-4 font-mono text-sm text-foreground">
        {codes.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button type="button" variant="outline" onClick={download}>
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        {continueHref ? (
          <Button asChild>
            <Link href={continueHref}>I saved my codes, continue</Link>
          </Button>
        ) : (
          <Button type="button" onClick={onDone}>
            I saved my codes
          </Button>
        )}
      </div>
    </div>
  );
}
