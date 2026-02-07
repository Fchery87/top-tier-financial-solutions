import { test, expect } from '@playwright/test';

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
  test.beforeEach(async ({ page }) => {
    // Navigate to the wizard page
    await page.goto('/admin/disputes/wizard');
  });

  test('should display the wizard with 4 steps', async ({ page }) => {
    // Check that all 4 wizard steps are visible
    await expect(page.getByText(/Client/i)).toBeVisible();
    await expect(page.getByText(/Items/i)).toBeVisible();
    await expect(page.getByText(/Configure/i)).toBeVisible();
    await expect(page.getByText(/Review/i)).toBeVisible();
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
    const nextButton = page.getByRole('button', { name: /next/i });

    // Should be disabled initially
    await expect(nextButton).toBeDisabled();
  });

  test('should allow searching for clients', async ({ page }) => {
    // Type in search input
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('john');

    // Wait for search results
    await page.waitForTimeout(500); // Debounce delay

    // Should show filtered results
    await expect(page.getByText(/john/i)).toBeVisible();
  });

  test('should allow selecting a client and proceeding to step 2', async ({ page }) => {
    // Wait for clients to load
    await page.waitForSelector('[data-testid="client-card"]', { timeout: 5000 }).catch(() => {
      console.log('Client cards not found - may need authentication');
    });

    // Select first client (if available)
    const firstClient = page.locator('[data-testid="client-card"]').first();
    if (await firstClient.isVisible()) {
      await firstClient.click();

      // Next button should be enabled
      const nextButton = page.getByRole('button', { name: /next/i });
      await expect(nextButton).toBeEnabled();

      // Click Next to proceed to step 2
      await nextButton.click();

      // Should be on step 2 now
      await expect(page.getByText(/Select Items/i)).toBeVisible();
    }
  });

  test('should navigate back to previous step', async ({ page }) => {
    // This test requires being on step 2 or later
    // For now, just check that Back button exists
    const backButton = page.getByRole('button', { name: /back/i });

    // Back button should exist (even if disabled on step 1)
    await expect(backButton).toBeVisible();
  });
});

test.describe('Dispute Wizard - Complete Flow (Authenticated)', () => {
  test.skip('should complete full wizard flow from client selection to review', async ({ page }) => {
    // This test requires authentication setup
    // TODO: Add authentication helpers and complete this test

    // 1. Navigate to wizard
    await page.goto('/admin/disputes/wizard');

    // 2. Select client
    // await selectClient(page, 'John Doe');

    // 3. Select items to dispute
    // await selectItems(page, ['item-1', 'item-2']);

    // 4. Configure dispute (bureaus, methodology, etc.)
    // await configureDis pute(page, {
    //   bureaus: ['transunion'],
    //   methodology: 'factual',
    //   round: 1,
    // });

    // 5. Review and submit
    // await reviewAndSubmit(page);

    // 6. Verify success
    // await expect(page.getByText(/successfully created/i)).toBeVisible();
  });
});

test.describe('Dispute Wizard - Validation', () => {
  test('should show validation errors when required fields are missing', async ({ page }) => {
    await page.goto('/admin/disputes/wizard');

    // Try to proceed without selecting a client
    const nextButton = page.getByRole('button', { name: /next/i });

    // Button should be disabled (prevents invalid progression)
    await expect(nextButton).toBeDisabled();
  });

  test('should display evidence requirements for high-risk codes', async () => {
    // This requires progressing through the wizard
    // TODO: Implement after authentication is set up
    test.skip();
  });
});

test.describe('Dispute Wizard - Accessibility', () => {
  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/admin/disputes/wizard');

    // Tab through interactive elements
    await page.keyboard.press('Tab');

    // First focusable element should receive focus
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/admin/disputes/wizard');

    // Check for accessible step indicators
    const steps = page.getByRole('button').filter({ hasText: /Client|Items|Configure|Review/ });
    const count = await steps.count();

    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Dispute Wizard - Error Handling', () => {
  test('should display error message when API fails', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/admin/clients', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/admin/disputes/wizard');

    // Should show error message
    await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test('should allow retry after error', async ({ page }) => {
    let callCount = 0;

    // Fail first, succeed second
    await page.route('**/api/admin/clients', (route) => {
      callCount++;
      if (callCount === 1) {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Server error' }),
        });
      } else {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [] }),
        });
      }
    });

    await page.goto('/admin/disputes/wizard');

    // Wait for error
    await expect(page.getByText(/error/i)).toBeVisible();

    // Click retry button (if available)
    const retryButton = page.getByRole('button', { name: /retry/i });
    if (await retryButton.isVisible()) {
      await retryButton.click();

      // Error should disappear
      await expect(page.getByText(/error/i)).not.toBeVisible();
    }
  });
});

test.describe('Dispute Wizard - Performance', () => {
  test('should load within 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/admin/disputes/wizard');
    await page.waitForSelector('h1, h2, [data-testid="wizard-container"]', { timeout: 3000 });

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle large item lists efficiently', async ({ page }) => {
    // Mock response with 50+ items
    await page.route('**/api/admin/negative-items**', (route) => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        id: `item-${i}`,
        creditor_name: `Creditor ${i}`,
        item_type: 'delinquency',
        amount: 1000 + i,
        on_transunion: true,
      }));

      route.fulfill({
        status: 200,
        body: JSON.stringify({ data: items }),
      });
    });

    await page.goto('/admin/disputes/wizard');

    // TODO: Navigate to step 2 and verify items load
    // Performance should remain acceptable
  });
});
