import { test, expect } from '@playwright/test';
import { authState } from './fixtures/auth';
import { installPortalApiFixtures } from './fixtures/routes';

test.use({ storageState: authState('client') });

test.describe('client portal shell', () => {
  test.beforeEach(async ({ page }) => {
    await installPortalApiFixtures(page);
  });

  test('keeps the portal tabs and pending approvals visible across all portal pages', async ({ page }) => {
    for (const path of ['/portal', '/portal/audit-report', '/portal/agreement']) {
      await page.goto(path);
      const navigation = page.getByRole('navigation');
      await expect(navigation).toBeVisible();
      await expect(navigation.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(navigation.getByRole('link', { name: 'Audit Report' })).toBeVisible();
      await expect(navigation.getByRole('link', { name: 'Agreement' })).toBeVisible();
      await expect(page.getByRole('link', { name: /pricing|services/i })).not.toBeVisible();
    }
  });

  test('places pending letter approvals above the dashboard content', async ({ page }) => {
    await page.goto('/portal');
    const approvalNotice = page.getByText('1 letter need your approval');
    await expect(approvalNotice).toBeVisible();
    await expect(approvalNotice).toBeInViewport();
  });

  test('exposes My Portal in the signed-in public user menu', async ({ page }) => {
    await page.goto('/about');
    await page.locator('button[aria-haspopup="menu"]').click();
    await expect(page.getByRole('menuitem', { name: 'My Portal' })).toHaveAttribute('href', '/portal');
    await expect(page.getByRole('menuitem', { name: 'Workspace' })).not.toBeVisible();
  });
});
