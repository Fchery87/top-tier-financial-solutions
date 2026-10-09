/**
 * Plain-language messages for better-auth two-factor errors. Pure, so the
 * sign-in challenge and the enrollment page say the same thing.
 */
export interface AuthErrorLike {
  code?: string | null;
  status?: number | null;
  message?: string | null;
}

const MESSAGES: Record<string, string> = {
  INVALID_CODE: "That code didn't work. Check your authenticator app and enter the current 6-digit code.",
  INVALID_BACKUP_CODE: "That backup code isn't valid, or it has already been used. Each backup code works once.",
  INVALID_TWO_FACTOR_COOKIE: 'Your sign-in attempt expired. Please sign in again.',
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: 'Too many wrong codes. Please sign in again to get a fresh attempt.',
  ACCOUNT_TEMPORARILY_LOCKED: 'Too many failed attempts. Two-factor sign-in is locked for 15 minutes. Please try again later.',
  INVALID_PASSWORD: "That password isn't correct.",
  TOTP_NOT_ENABLED: 'Two-factor setup was not started. Please start again.',
  TWO_FACTOR_NOT_ENABLED: 'Two-factor authentication is not turned on for this account.',
  MFA_REQUIRED_FOR_ROLE: 'Team accounts must keep two-factor authentication turned on.',
};

export function describeTwoFactorError(error: AuthErrorLike | null | undefined): string {
  if (error?.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error?.status === 429) return 'Too many tries in a short time. Wait a few seconds and try again.';
  if (error?.status === 401) return 'Please sign in again.';
  return 'Something went wrong. Please try again.';
}
