import { mkdirSync } from 'node:fs';
import { request as playwrightRequest, test as setup } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

const authDirectory = 'e2e/.auth';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const password = process.env.E2E_PASSWORD;

interface AuthUser {
  email: string;
  role: 'super_admin' | 'admin' | 'staff' | 'user';
  stateFile: string;
}

const users: AuthUser[] = [
  { email: process.env.E2E_SUPER_ADMIN_EMAIL || `e2e-super-${process.pid}@example.test`, role: 'super_admin', stateFile: `${authDirectory}/super-admin.json` },
  { email: process.env.E2E_ADMIN_EMAIL || `e2e-admin-${process.pid}@example.test`, role: 'admin', stateFile: `${authDirectory}/admin.json` },
  { email: process.env.E2E_STAFF_EMAIL || `e2e-staff-${process.pid}@example.test`, role: 'staff', stateFile: `${authDirectory}/staff.json` },
  { email: process.env.E2E_CLIENT_EMAIL || `e2e-client-${process.pid}@example.test`, role: 'user', stateFile: `${authDirectory}/client.json` },
];

async function assertResponse(response: { ok(): boolean; status(): number; text(): Promise<string> }, action: string) {
  if (!response.ok()) throw new Error(`E2E auth setup failed while ${action}: HTTP ${response.status()} ${await response.text()}`);
}

async function signUpOrSignIn(context: Awaited<ReturnType<typeof playwrightRequest.newContext>>, email: string) {
  const signUp = await context.post('/api/auth/sign-up/email', { data: { name: email.split('@')[0], email, password } });
  if (!signUp.ok() && signUp.status() !== 400 && signUp.status() !== 409) await assertResponse(signUp, `creating ${email}`);
  if (!signUp.ok()) {
    const signIn = await context.post('/api/auth/sign-in/email', { data: { email, password } });
    await assertResponse(signIn, `signing in ${email}`);
  }
}

setup('create deterministic role-authenticated storage states', async () => {
  if (!password) throw new Error('E2E_PASSWORD must be set; refusing to run authenticated browser tests without deterministic credentials.');
  mkdirSync(authDirectory, { recursive: true });

  const superContext = await playwrightRequest.newContext({ baseURL });
  await signUpOrSignIn(superContext, users[0].email);
  const bootstrap = await superContext.post('/api/admin/set-role', { data: { email: users[0].email, role: 'super_admin' } });
  await assertResponse(bootstrap, 'bootstrapping the first super admin');
  await superContext.storageState({ path: users[0].stateFile });

  for (const user of users.slice(1)) {
    const context = await playwrightRequest.newContext({ baseURL });
    await signUpOrSignIn(context, user.email);
    if (user.role !== 'user') {
      const roleResponse = await superContext.post('/api/admin/set-role', { data: { email: user.email, role: user.role } });
      await assertResponse(roleResponse, `assigning ${user.role} to ${user.email}`);
    }
    await context.storageState({ path: user.stateFile });
    await context.dispose();
  }

  await superContext.dispose();
});
