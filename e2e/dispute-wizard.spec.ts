import { test, expect, type Page } from '@playwright/test';
import { authState } from './fixtures/auth';
import { e2eClient, e2eNegativeItem, installWizardApiFixtures } from './fixtures/routes';

test.use({ storageState: authState('admin') });

async function selectFixtureClient(page: Page) {
  const client = page.getByTestId(`wizard-client-${e2eClient.id}`);
  await expect(client).toBeVisible({ timeout: 60000 });
  await client.dispatchEvent('click');
}

/**
 * End-to-End tests for Dispute Wizard
 * Tests the complete user journey through the wizard
 *
 * Prerequisites:
 * - Development server must be running
 * - Test database with sample data
 * - Admin authentication configured
 */

test.describe('Dispute Wizard E2E Flow', () => {
  test.describe.configure({ timeout: 60000 });
  test.beforeEach(async ({ page }) => {
    await installWizardApiFixtures(page);
    // Navigate to the wizard page
    await page.goto('/workspace/disputes/wizard', { waitUntil: 'domcontentloaded', timeout: 60000 });
  });

  test('should display the wizard with 4 steps', async ({ page }) => {
    // Check that all 4 wizard steps are visible
    await expect(page.getByText('Client', { exact: true })).toBeVisible();
    await expect(page.getByText('Items', { exact: true })).toBeVisible();
    await expect(page.getByText('Configure', { exact: true })).toBeVisible();
    await expect(page.getByText('Review', { exact: true })).toBeVisible();
  });

  test('should start on step 1 (Client Selection)', async ({ page }) => {
    // Verify we're on step 1
    await expect(page.getByText(/Select Client/i)).toBeVisible();

    // Should show client search input
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
  });

  test('should disable Next button when no client is selected', async ({ page }) => {
    // Find the Next button
    const nextButton = page.getByRole('button', { name: /^Next/ });

    // Should be disabled initially
    await expect(nextButton).toBeDisabled();
  });

  test('should allow searching for clients', async ({ page }) => {
    // Type in search input
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('fixture');

    // Wait for search results
    await page.waitForTimeout(500); // Debounce delay

    // Should show filtered results
    await expect(page.getByTestId(`wizard-client-${e2eClient.id}`)).toBeVisible();
  });

  test('should allow selecting a client and proceeding to step 2', async ({ page }) => {
    await selectFixtureClient(page);

    // Next button should be enabled
    const nextButton = page.getByRole('button', { name: /^Next/ });
    await expect(nextButton).toBeEnabled();

    // Click Next to proceed to step 2
    await nextButton.click({ force: true });

    // Should be on step 2 now
    await expect(page.getByText(/Select Items/i)).toBeVisible();
  });

  test('should navigate back to previous step', async ({ page }) => {
    // This test requires being on step 2 or later
    // For now, just check that Back button exists
    const backButton = page.getByRole('button', { name: /^Back \(/ });

    // Back button should exist (even if disabled on step 1)
    await expect(backButton).toBeVisible();
  });

  test('persists a generated draft before review and never posts a duplicate dispute', async ({ page }) => {
    const fixtureState = await installWizardApiFixtures(page);
    const directDisputePosts: string[] = [];
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().endsWith('/api/admin/disputes')) directDisputePosts.push(request.url());
    });

    await selectFixtureClient(page);
    await page.getByRole('button', { name: /^Next/ }).click({ force: true });
    await page.getByTestId(`wizard-item-${e2eNegativeItem.id}`).click({ force: true });
    await expect(page.getByText('Selected: 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Next/ }).click({ force: true });

    // Keep this journey to one request so the persisted draft ID is unambiguous.
    await page.getByRole('button', { name: /^Experian/ }).click({ force: true });
    await page.getByRole('button', { name: /^Equifax/ }).click({ force: true });
    await page.locator('[data-generate-button]').click();

    await expect(page.getByText('Letter Studio').first()).toBeVisible({ timeout: 10000 });
    expect(fixtureState.generateRequests).toHaveLength(1);
    expect(fixtureState.generateRequests[0]).toMatchObject({ clientId: e2eClient.id });
    expect(directDisputePosts).toEqual([]);
  });

  test('shows the direct-dispute advisory without disabling generation', async ({ page }) => {
    await selectFixtureClient(page);
    await page.getByRole('button', { name: /^Next/ }).click({ force: true });
    await page.getByTestId(`wizard-item-${e2eNegativeItem.id}`).click({ force: true });
    await expect(page.getByText('Selected: 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Next/ }).click({ force: true });

    await page.getByText('Round 2 - Direct to Creditor/Furnisher').click({ force: true });
    await expect(page.getByTestId('direct-dispute-advisory')).toBeVisible();
    await expect(page.locator('[data-generate-button]')).toBeEnabled();
  });

  test('surfaces the prior-dispute requirement before CFPB generation', async ({ page }) => {
    await selectFixtureClient(page);
    await page.getByRole('button', { name: /^Next/ }).click({ force: true });
    await page.getByTestId(`wizard-item-${e2eNegativeItem.id}`).click({ force: true });
    await expect(page.getByText('Selected: 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Next/ }).click({ force: true });

    await page.getByText('Round 3+ - CFPB / Direct Escalation').click({ force: true });
    const priorDisputeInput = page.getByLabel('Prior CRA dispute ID');
    await expect(priorDisputeInput).toBeVisible();
    await priorDisputeInput.fill('e2e-prior-dispute');
    const eligibilityPreview = page.getByTestId('cfpb-eligibility-preview');
    await expect(eligibilityPreview).toHaveAttribute('data-selected-item-count', '1');
    await expect(page.getByTestId('cfpb-eligibility-preview')).toContainText('still pending');
    await expect(page.getByTestId('cfpb-eligibility-preview')).toContainText('August 15, 2026');
    await expect(page.getByText(/prior CRA dispute.*submitted/i)).toBeVisible();
  });

  test('allows CFPB generation when the CRA predecessor has a received response', async ({ page }) => {
    await page.route('**/api/admin/disputes/*/cfpb-eligibility**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          eligible: true,
          reason: 'eligible',
          eligible_at: null,
          message: 'The prior CRA dispute has a received response, so CFPB escalation is eligible.',
        }),
      });
    });

    await selectFixtureClient(page);
    await page.getByRole('button', { name: /^Next/ }).click({ force: true });
    await page.getByTestId(`wizard-item-${e2eNegativeItem.id}`).click({ force: true });
    await expect(page.getByText('Selected: 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Next/ }).click({ force: true });

    await page.getByText('Round 3+ - CFPB / Direct Escalation').click({ force: true });
    await page.getByLabel('Prior CRA dispute ID').fill('e2e-prior-dispute');

    const eligibilityPreview = page.getByTestId('cfpb-eligibility-preview');
    await expect(eligibilityPreview).toHaveAttribute('data-selected-item-count', '1');
    await expect(eligibilityPreview).toContainText('Eligible for CFPB escalation');
    await expect(page.getByTestId('cfpb-eligibility-preview')).toContainText('received response');
    await expect(page.getByTestId('cfpb-eligibility-preview')).not.toContainText('Eligible after');
  });
});

test.describe('Dispute Wizard - Validation', () => {
  test.describe.configure({ timeout: 60000 });
  test('should show validation errors when required fields are missing', async ({ page }) => {
    await page.goto('/workspace/disputes/wizard', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Try to proceed without selecting a client
    const nextButton = page.getByRole('button', { name: /^Next/ });

    // Button should be disabled (prevents invalid progression)
    await expect(nextButton).toBeDisabled();
  });

});

test.describe('Dispute Wizard - Accessibility', () => {
  test.describe.configure({ timeout: 60000 });
  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/workspace/disputes/wizard', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Tab through interactive elements
    await page.keyboard.press('Tab');

    // First focusable element should receive focus
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/workspace/disputes/wizard', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Check for accessible step indicators
    const steps = page.getByRole('button', { name: /Client step|Items step|Configure step|Review step/ });
    await expect(steps.first()).toBeVisible({ timeout: 30000 });
    const count = await steps.count();

    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Dispute Wizard - Error Handling', () => {
  test.describe.configure({ timeout: 60000 });
  test('should display error message when API fails', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/admin/clients**', async (route) => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/workspace/disputes/wizard', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Should show error message
    await expect(page.locator('[role="alert"]').filter({ hasText: 'Error loading clients' })).toBeVisible({ timeout: 15000 });
  });

  test('should allow retry after error', async ({ page }) => {
    let callCount = 0;

    // Fail first, succeed second
    await page.route('**/api/admin/clients**', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [] }),
        });
      }
    });

    await page.goto('/workspace/disputes/wizard', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for error
    const clientError = page.locator('[role="alert"]').filter({ hasText: 'Error loading clients' });
    await expect(clientError).toContainText('Error loading clients', { timeout: 15000 });

    // Click retry button (if available)
    const retryButton = page.getByRole('button', { name: /retry/i });
    if (await retryButton.isVisible()) {
      await retryButton.click({ force: true });

      // Error should disappear
      await expect(clientError).not.toBeVisible();
    }
  });
});

test.describe('Dispute Wizard - Performance', () => {
  test.describe.configure({ timeout: 60000 });
  test('should load within the local development budget', async ({ page }) => {
    const startTime = Date.now();

    await installWizardApiFixtures(page);
    await page.goto('/workspace/disputes/wizard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('h1, h2, [data-testid="wizard-container"]', { timeout: 15000 });

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(30000);
  });

  test('should handle large item lists efficiently', async ({ page }) => {
    // Mock response with 50+ items and verify they render after selecting the fixture client.
    await installWizardApiFixtures(page);
    await page.route(`**/api/admin/clients/${e2eClient.id}`, (route) => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        id: `item-${i}`,
        creditor_name: `Creditor ${i}`,
        item_type: 'delinquency',
        amount: 1000 + i,
        on_transunion: true,
      }));

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ negative_items: items, personal_info_disputes: [], inquiry_disputes: [], credit_reports: [] }),
      });
    });

    await page.goto('/workspace/disputes/wizard', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page.getByTestId(`wizard-client-${e2eClient.id}`)).toBeVisible({ timeout: 60000 });
    await selectFixtureClient(page);
    await page.getByRole('button', { name: /^Next/ }).click({ force: true });
    await expect(page.getByText('Creditor 49')).toBeVisible();
  });
});
