import { describe, expect, it } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { base32 } from '@better-auth/utils/base32';
import { createOTP } from '@better-auth/utils/otp';
import { buildAuthOptions, TWO_FACTOR_ISSUER } from '@/lib/auth-options';

const BASE = 'http://localhost:3000/api/auth';
const PASSWORD = 'correct-horse-battery';

type Store = Record<string, Record<string, unknown>[]>;

function createTestAuth() {
  const store: Store = {
    user: [],
    session: [],
    account: [],
    verification: [],
    twoFactor: [],
  };
  const auth = betterAuth({
    ...buildAuthOptions(),
    secret: 'test-secret-test-secret-test-secret-123',
    baseURL: 'http://localhost:3000',
    database: memoryAdapter(store),
  });
  return { auth, store };
}

type TestAuth = ReturnType<typeof createTestAuth>['auth'];

/** Minimal cookie jar: applies Set-Cookie headers, drops expired cookies. */
class CookieJar {
  private cookies = new Map<string, string>();

  apply(response: Response) {
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attributes] = header.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attributes.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === '';
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  has(fragment: string) {
    return [...this.cookies.keys()].some((name) => name.includes(fragment));
  }

  header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

async function post(auth: TestAuth, jar: CookieJar, path: string, body: unknown = {}) {
  const cookie = jar.header();
  const response = await auth.handler(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
  jar.apply(response);
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { response, data };
}

async function getSession(auth: TestAuth, jar: CookieJar) {
  const cookie = jar.header();
  const response = await auth.handler(
    new Request(`${BASE}/get-session`, { headers: cookie ? { cookie } : {} }),
  );
  return (await response.json()) as { user: { id: string; twoFactorEnabled?: boolean } } | null;
}

/** The plugin hands out the secret base32-encoded inside the otpauth URI. */
function totpFromUri(totpURI: string) {
  const encoded = new URL(totpURI).searchParams.get('secret')!;
  const rawSecret = new TextDecoder().decode(base32.decode(encoded));
  return createOTP(rawSecret).totp();
}

async function enrolledUser(email = 'client@example.com') {
  const { auth, store } = createTestAuth();
  const jar = new CookieJar();
  await post(auth, jar, '/sign-up/email', { email, password: PASSWORD, name: 'Test User' });

  const enable = await post(auth, jar, '/two-factor/enable', { password: PASSWORD });
  expect(enable.response.status).toBe(200);
  const totpURI = String(enable.data?.totpURI);
  const backupCodes = enable.data?.backupCodes as string[];

  const verify = await post(auth, jar, '/two-factor/verify-totp', { code: await totpFromUri(totpURI) });
  expect(verify.response.status).toBe(200);

  await post(auth, jar, '/sign-out');
  expect(jar.has('session_token')).toBe(false);

  return { auth, store, email, totpURI, backupCodes };
}

async function signInExpectingChallenge(auth: TestAuth, email: string) {
  const jar = new CookieJar();
  const signIn = await post(auth, jar, '/sign-in/email', { email, password: PASSWORD });
  return { jar, signIn };
}

describe('two-factor authentication flow (real better-auth handler)', () => {
  it('enrolls with an encrypted secret and encrypted backup codes', async () => {
    const { store, totpURI, backupCodes } = await enrolledUser();

    expect(totpURI.startsWith('otpauth://totp/')).toBe(true);
    expect(new URL(totpURI).searchParams.get('issuer')).toBe(TWO_FACTOR_ISSUER);
    expect(backupCodes).toHaveLength(10);
    expect(store.user[0].twoFactorEnabled).toBe(true);

    const row = store.twoFactor[0];
    const encoded = new URL(totpURI).searchParams.get('secret')!;
    const rawSecret = new TextDecoder().decode(base32.decode(encoded));
    expect(row.verified).toBe(true);
    expect(String(row.secret)).not.toContain(rawSecret);
    for (const code of backupCodes) expect(String(row.backupCodes)).not.toContain(code);
  });

  it('challenges sign-in for the second factor without issuing a session', async () => {
    const { auth, store, email } = await enrolledUser();
    const sessionsBefore = store.session.length;

    const { jar, signIn } = await signInExpectingChallenge(auth, email);

    expect(signIn.response.status).toBe(200);
    expect(signIn.data).toEqual({ twoFactorRedirect: true, twoFactorMethods: ['totp'] });
    expect(jar.has('session_token')).toBe(false);
    expect(jar.has('two_factor')).toBe(true);
    expect(store.session.length).toBe(sessionsBefore);
    expect(await getSession(auth, jar)).toBeNull();
  });

  it('issues a session after a valid TOTP code', async () => {
    const { auth, email, totpURI } = await enrolledUser();
    const { jar } = await signInExpectingChallenge(auth, email);

    const verify = await post(auth, jar, '/two-factor/verify-totp', { code: await totpFromUri(totpURI) });

    expect(verify.response.status).toBe(200);
    expect(jar.has('session_token')).toBe(true);
    const session = await getSession(auth, jar);
    expect(session?.user.twoFactorEnabled).toBe(true);
  });

  it('issues a session after a backup code, and refuses the same backup code a second time', async () => {
    const { auth, email, backupCodes } = await enrolledUser();
    const [code] = backupCodes;

    const first = await signInExpectingChallenge(auth, email);
    const used = await post(auth, first.jar, '/two-factor/verify-backup-code', { code });
    expect(used.response.status).toBe(200);
    expect(first.jar.has('session_token')).toBe(true);
    expect(await getSession(auth, first.jar)).not.toBeNull();

    const second = await signInExpectingChallenge(auth, email);
    const reused = await post(auth, second.jar, '/two-factor/verify-backup-code', { code });
    expect(reused.response.status).toBe(401);
    expect(reused.data?.code).toBe('INVALID_BACKUP_CODE');
    expect(second.jar.has('session_token')).toBe(false);
  });

  it.each(['verify-totp', 'verify-backup-code'])(
    'never trusts a device after %s, even when the client asks for it',
    async (endpoint) => {
      const { auth, email, totpURI, backupCodes } = await enrolledUser();
      const { jar } = await signInExpectingChallenge(auth, email);
      const code = endpoint === 'verify-totp' ? await totpFromUri(totpURI) : backupCodes[0];

      const verify = await post(auth, jar, `/two-factor/${endpoint}`, { code, trustDevice: true });

      expect(verify.response.status).toBe(200);
      expect(jar.has('session_token')).toBe(true);
      expect(jar.has('trust_device')).toBe(false);

      await post(auth, jar, '/sign-out');
      const again = await signInExpectingChallenge(auth, email);
      expect(again.signIn.data).toEqual({ twoFactorRedirect: true, twoFactorMethods: ['totp'] });
    },
  );

  it('refuses a wrong TOTP code', async () => {
    const { auth, email, totpURI } = await enrolledUser();
    const { jar } = await signInExpectingChallenge(auth, email);
    const valid = await totpFromUri(totpURI);
    const wrong = valid === '000000' ? '111111' : '000000';

    const verify = await post(auth, jar, '/two-factor/verify-totp', { code: wrong });

    expect(verify.response.status).toBe(401);
    expect(verify.data?.code).toBe('INVALID_CODE');
    expect(jar.has('session_token')).toBe(false);
  });

  it('does not enable two-factor until a TOTP code confirms enrollment', async () => {
    const { auth, store } = createTestAuth();
    const jar = new CookieJar();
    await post(auth, jar, '/sign-up/email', { email: 'pending@example.com', password: PASSWORD, name: 'Pending' });

    await post(auth, jar, '/two-factor/enable', { password: PASSWORD });

    expect(store.user[0].twoFactorEnabled).toBe(false);
    expect(store.twoFactor[0].verified).toBe(false);
  });

  it('requires the password to start enrollment', async () => {
    const { auth, store } = createTestAuth();
    const jar = new CookieJar();
    await post(auth, jar, '/sign-up/email', { email: 'nopass@example.com', password: PASSWORD, name: 'No Pass' });

    const enable = await post(auth, jar, '/two-factor/enable', { password: 'wrong-password-123' });

    expect(enable.response.status).toBe(400);
    expect(store.twoFactor).toHaveLength(0);
  });

  it.each(['staff', 'admin', 'super_admin'])('refuses to disable two-factor for the %s role', async (role) => {
    const { auth, store, email, totpURI } = await enrolledUser('team@example.com');
    const { jar } = await signInExpectingChallenge(auth, email);
    await post(auth, jar, '/two-factor/verify-totp', { code: await totpFromUri(totpURI) });
    store.user[0].role = role;

    const disable = await post(auth, jar, '/two-factor/disable', { password: PASSWORD });

    expect(disable.response.status).toBe(403);
    expect(disable.data?.code).toBe('MFA_REQUIRED_FOR_ROLE');
    expect(store.user[0].twoFactorEnabled).toBe(true);
    expect(store.twoFactor).toHaveLength(1);
  });

  it('lets a portal client disable two-factor', async () => {
    const { auth, store, email, totpURI } = await enrolledUser();
    const { jar } = await signInExpectingChallenge(auth, email);
    await post(auth, jar, '/two-factor/verify-totp', { code: await totpFromUri(totpURI) });

    const disable = await post(auth, jar, '/two-factor/disable', { password: PASSWORD });

    expect(disable.response.status).toBe(200);
    expect(store.user[0].twoFactorEnabled).toBe(false);
    expect(store.twoFactor).toHaveLength(0);
  });

  it('never lets update-user set twoFactorEnabled', async () => {
    const { auth, store } = createTestAuth();
    const jar = new CookieJar();
    await post(auth, jar, '/sign-up/email', { email: 'sneaky@example.com', password: PASSWORD, name: 'Sneaky' });

    await post(auth, jar, '/update-user', { twoFactorEnabled: true });

    expect(store.user[0].twoFactorEnabled).toBe(false);
  });
});
