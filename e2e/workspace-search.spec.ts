import { expect, test } from '@playwright/test';

import { authState } from './fixtures/auth';

test.use({ storageState: authState('staff') });

test.describe('workspace command-palette record search', () => {
  test('searches clients and disputes and navigates to the selected record', async ({ page }) => {
    await page.route('**/api/admin/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'fixture',
          results: [
            {
              kind: 'client',
              id: 'e2e-client-record',
              label: 'Portal Fixture',
              description: 'portal-fixture@example.test · Active',
              href: '/workspace/clients/e2e-client-record',
            },
            {
              kind: 'dispute',
              id: 'e2e-dispute-record',
              label: 'Portal Fixture — Fixture Card Services',
              description: 'Transunion · Round 1 · Draft',
              href: '/workspace/disputes?dispute=e2e-dispute-record',
            },
          ],
        }),
      });
    });
    await page.route('**/api/admin/clients/e2e-client-record', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          client: {
            id: 'e2e-client-record',
            user_id: null,
            lead_id: null,
            first_name: 'Portal',
            last_name: 'Fixture',
            email: 'portal-fixture@example.test',
            phone: null,
            status: 'active',
            notes: null,
            converted_at: '2026-01-01T00:00:00.000Z',
            created_at: '2026-01-01T00:00:00.000Z',
            user_name: null,
          },
          credit_reports: [],
          latest_analysis: null,
          credit_accounts: [],
          negative_items: [],
          negative_items_count: 0,
          disputes: [],
          score_history: [],
          readiness: null,
        }),
      });
    });

    await page.goto('/workspace', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Search (open command palette)' }).click();

    const input = page.getByRole('textbox', { name: 'Workspace record search' });
    await input.fill('fixture');
    await expect(page.getByRole('link', { name: /Portal Fixture, portal-fixture@example.test/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Portal Fixture — Fixture Card Services/ })).toBeVisible();

    await page.getByRole('link', { name: /Portal Fixture, portal-fixture@example.test/ }).click();
    await expect(page).toHaveURL(/\/workspace\/clients\/e2e-client-record$/);

    await page.goto('/workspace', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Search (open command palette)' }).click();
    await page.getByRole('textbox', { name: 'Workspace record search' }).fill('fixture');
    await page.getByRole('link', { name: /Portal Fixture — Fixture Card Services/ }).click();
    await expect(page).toHaveURL(/\/workspace\/disputes\?dispute=e2e-dispute-record$/);
  });
});
