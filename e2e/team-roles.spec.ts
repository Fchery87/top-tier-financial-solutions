import { test, expect } from '@playwright/test';
import { authState } from './fixtures/auth';

const teamPayload = {
  members: [
    { id: 'fixture-owner', email: 'owner@example.test', name: 'Fixture Owner', role: 'super_admin', last_active_at: '2026-08-02T12:00:00.000Z', is_last_super_admin: true },
    { id: 'fixture-member', email: 'member@example.test', name: 'Fixture Member', role: 'staff', last_active_at: null, is_last_super_admin: false },
  ],
  recent_activity: [{ id: 'fixture-activity', action: 'user_role.changed', subject_type: 'user_role', subject_id: 'fixture-member', actor_name: 'Fixture Owner', created_at: '2026-08-02T12:15:00.000Z' }],
};

test.describe('team role controls', () => {
  test.use({ storageState: authState('admin') });

  test('admin cannot open team role management', async ({ page }) => {
    await page.goto('/admin/team');
    await expect(page).toHaveURL(/\/admin$|\/workspace/);
  });
});

test.describe('super admin team controls', () => {
  test.use({ storageState: authState('super-admin') });

  test('super admin can change a role and sees the activity row while retaining final-owner protection', async ({ page }) => {
    let currentRole = 'staff';
    let patchCount = 0;
    await page.route('**/api/admin/team', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchCount += 1;
        currentRole = 'admin';
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ member: { id: 'fixture-member', role: currentRole } }) });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...teamPayload, members: teamPayload.members.map(member => member.id === 'fixture-member' ? { ...member, role: currentRole } : member) }),
      });
    });

    await page.goto('/admin/team');
    await expect(page.getByText('Recent activity')).toBeVisible();
    await expect(page.getByLabel('Role for Fixture Owner')).toBeDisabled();
    await expect(page.getByText('Final super admin — assign another owner first.')).toBeVisible();

    await page.getByLabel('Role for Fixture Member').selectOption('admin');
    await expect.poll(() => patchCount).toBe(1);
    await expect(page.getByLabel('Role for Fixture Member')).toHaveValue('admin');
    await expect(page.getByText('user_role changed')).toBeVisible();
  });
});
