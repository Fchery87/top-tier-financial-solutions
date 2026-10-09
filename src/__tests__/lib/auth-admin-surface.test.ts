import { describe, expect, it } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { buildAuthOptions } from '@/lib/auth-options';

const BASE = 'http://localhost:3000/api/auth';

function createTestAuth() {
  const store: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const auth = betterAuth({
    ...buildAuthOptions(),
    secret: 'test-secret-test-secret-test-secret-123',
    baseURL: 'http://localhost:3000',
    database: memoryAdapter(store),
  });
  return { auth, store };
}

function jsonRequest(path: string, body: unknown, cookie?: string) {
  return new Request(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function signUp(auth: ReturnType<typeof createTestAuth>['auth'], body: Record<string, unknown>) {
  const response = await auth.handler(jsonRequest('/sign-up/email', body));
  const cookie = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  return { response, cookie };
}

describe('auth admin surface', () => {
  it('never lets sign-up choose a role', async () => {
    const { auth, store } = createTestAuth();

    await signUp(auth, {
      email: 'attacker@example.com',
      password: 'correct-horse-battery',
      name: 'Attacker',
      role: 'super_admin',
    });

    expect(store.user.map((user) => user.role)).toEqual(['user']);
  });

  it.each([
    '/admin/set-user-password',
    '/admin/impersonate-user',
    '/admin/remove-user',
    '/admin/set-role',
    '/admin/ban-user',
    '/admin/create-user',
  ])('does not serve the better-auth admin endpoint %s', async (path) => {
    const { auth, store } = createTestAuth();
    const { cookie } = await signUp(auth, {
      email: 'admin@example.com',
      password: 'correct-horse-battery',
      name: 'Admin',
    });
    store.user[0].role = 'admin';
    const userId = String(store.user[0].id);

    const response = await auth.handler(jsonRequest(path, { userId, email: 'new@example.com', password: 'correct-horse-battery', name: 'New', newPassword: 'pwned-password-1', role: 'super_admin' }, cookie));

    expect(response.status).toBe(404);
  });
});
