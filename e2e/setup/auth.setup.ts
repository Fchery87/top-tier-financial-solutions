import { mkdirSync } from 'node:fs';
import { request as playwrightRequest, test as setup } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

const authDirectory = 'e2e/.auth';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const password = process.env.E2E_PASSWORD;
const authorityEmail = process.env.E2E_AUTHORITY_EMAIL;
const authorityPassword = process.env.E2E_AUTHORITY_PASSWORD;

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

async function signIn(context: Awaited<ReturnType<typeof playwrightRequest.newContext>>, email: string, userPassword: string) {
  const response = await context.post('/api/auth/sign-in/email', { data: { email, password: userPassword } });
  await assertResponse(response, `signing in ${email}`);
}

async function signUpOrSignIn(context: Awaited<ReturnType<typeof playwrightRequest.newContext>>, email: string, userPassword: string) {
  const signUp = await context.post('/api/auth/sign-up/email', { data: { name: email.split('@')[0], email, password: userPassword } });
  if (!signUp.ok() && signUp.status() !== 400 && signUp.status() !== 409) await assertResponse(signUp, `creating ${email}`);
  if (!signUp.ok()) await signIn(context, email, userPassword);
}

setup('create deterministic role-authenticated storage states', async () => {
  setup.setTimeout(120_000);
  if (!password) throw new Error('E2E_PASSWORD must be set; refusing to run authenticated browser tests without deterministic credentials.');
  mkdirSync(authDirectory, { recursive: true });

  const superContext = await playwrightRequest.newContext({ baseURL, timeout: 60_000 });
  await signUpOrSignIn(superContext, users[0].email, password);
  const bootstrap = await superContext.post('/api/workspace/set-role', { data: { email: users[0].email, role: 'super_admin' } });
  let roleManagerContext = superContext;
  let authorityContext: Awaited<ReturnType<typeof playwrightRequest.newContext>> | null = null;
  if (!bootstrap.ok() && bootstrap.status() === 403) {
    if (!authorityEmail || !authorityPassword) {
      throw new Error('An existing super admin was found. Set E2E_AUTHORITY_EMAIL and E2E_AUTHORITY_PASSWORD to a disposable development super-admin account so E2E setup can assign roles through the protected API.');
    }
    authorityContext = await playwrightRequest.newContext({ baseURL, timeout: 60_000 });
    await signIn(authorityContext, authorityEmail, authorityPassword);
    const roleResponse = await authorityContext.post('/api/workspace/set-role', { data: { email: users[0].email, role: 'super_admin' } });
    await assertResponse(roleResponse, `assigning super_admin to ${users[0].email} through the existing authority`);
    roleManagerContext = authorityContext;
  } else {
    await assertResponse(bootstrap, 'bootstrapping the first super admin');
  }
  await superContext.storageState({ path: users[0].stateFile });

  for (const user of users.slice(1)) {
    const context = await playwrightRequest.newContext({ baseURL, timeout: 60_000 });
    await signUpOrSignIn(context, user.email, password);
    if (user.role !== 'user') {
      const roleResponse = await roleManagerContext.post('/api/workspace/set-role', { data: { email: user.email, role: user.role } });
      await assertResponse(roleResponse, `assigning ${user.role} to ${user.email}`);
    }
    await context.storageState({ path: user.stateFile });
    await context.dispose();
  }

  await authorityContext?.dispose();
  await superContext.dispose();
});
