import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { MFA_ENROLLMENT_PATH, MFA_ENROLLMENT_REQUIRED_CODE } from '@/lib/mfa';

/**
 * Lets `requireCapability` explain *why* it refused, without changing its
 * `AdminSessionUser | null` contract that ~120 route handlers rely on.
 *
 * `requireCapability` returns null for every refusal, so a caller that was
 * never updated still denies (fail closed). When the refusal was "team member
 * has not enrolled in MFA", it also marks the current request here, keyed on
 * the request's own headers object (`await headers()` returns the same object
 * for the whole request, and the WeakSet entry dies with it). A caller then
 * wraps its usual denial in `capabilityDeniedResponse(...)`, which swaps in the
 * 403 `MFA_ENROLLMENT_REQUIRED` body for marked requests only.
 */
const mfaEnrollmentDenials = new WeakSet<object>();

export function recordMfaEnrollmentDenial(requestHeaders: object): void {
  mfaEnrollmentDenials.add(requestHeaders);
}

export function mfaEnrollmentRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'Set up two-factor authentication to use team tools.',
      code: MFA_ENROLLMENT_REQUIRED_CODE,
      enrollUrl: MFA_ENROLLMENT_PATH,
    },
    { status: 403 },
  );
}

/**
 * Returns the MFA enrollment response if `requireCapability` refused this
 * request for missing MFA; otherwise returns the caller's own `fallback`.
 */
export async function capabilityDeniedResponse(fallback: NextResponse): Promise<NextResponse> {
  try {
    if (mfaEnrollmentDenials.has(await headers())) return mfaEnrollmentRequiredResponse();
  } catch {
    // Outside a request scope there is nothing to look up.
  }
  return fallback;
}
