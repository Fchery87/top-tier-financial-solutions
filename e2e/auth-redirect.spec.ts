import { test, expect } from '@playwright/test';
import { authState } from './fixtures/auth';

test.describe('role-aware authentication redirects', () => {
  test.use({ storageState: undefined });

  test('sends an anonymous portal visitor to sign-in with a safe next path', async ({ page }) => {
    await page.goto('/portal');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fportal|\/sign-in\?next=\/portal/);
  });

  test('does not accept an external next host', async ({ request }) => {
    const response = await request.get('/api/auth/landing?next=%2F%2Fevil.example');
    expect(response.status()).toBe(401);
  });
});

test.describe('authenticated role landing', () => {
  test.use({ storageState: authState('client') });

  test('keeps a client out of the workspace', async ({ page }) => {
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/portal/);
  });
});

test.describe('team role portal isolation', () => {
  test.use({ storageState: authState('staff') });

  test('keeps a staff member out of the client portal', async ({ page }) => {
    await page.goto('/portal');
    await expect(page).toHaveURL(/\/workspace/);
  });
});
