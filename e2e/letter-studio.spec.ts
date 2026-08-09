import { test, expect, type Page } from '@playwright/test';
import { authState } from './fixtures/auth';
import { installLetterStudioApiFixtures } from './fixtures/routes';

test.use({ storageState: authState('admin') });

async function openLetterStudio(page: Page, sent = false) {
  const state = await installLetterStudioApiFixtures(page, sent);
  await page.goto('/workspace/disputes', { waitUntil: 'commit', timeout: 60000 });
  await expect(page.getByText('Portal Fixture', { exact: true }).last()).toBeVisible({ timeout: 90000 });
  await page.getByText('Portal Fixture', { exact: true }).last().click({ force: true });
  await expect(page.getByRole('heading', { name: 'Letter Studio' })).toBeVisible({ timeout: 30000 });
  if (!sent) await expect(page.getByRole('textbox', { name: 'Dispute letter content' })).toBeEditable({ timeout: 30000 });
  return state;
}

test.describe('Letter Studio browser journeys', () => {
  test.describe.configure({ timeout: 120000 });

  test('saves a manual edit and rewrites only the selected passage', async ({ page }) => {
    const state = await openLetterStudio(page);
    const textarea = page.getByRole('textbox', { name: 'Dispute letter content' });
    await expect(textarea).toBeEditable({ timeout: 15000 });

    await textarea.fill('Original fixture letter.');
    await textarea.fill('Original fixture letter with a selected passage.');
    await textarea.selectText();
    await page.getByRole('button', { name: 'Rewrite' }).click();

    await expect.poll(() => state.rewriteRequests.length).toBe(1);
    expect(state.rewriteRequests[0]).toMatchObject({
      mode: 'rewrite',
      expectedSelectedText: 'Original fixture letter with a selected passage.',
      selectionStart: 0,
    });
    await expect(textarea).toHaveValue('Rewritten selected fixture passage.');

    await textarea.fill('Saved fixture letter.');
    await page.getByRole('button', { name: 'Save letter' }).click({ force: true });
    await expect.poll(() => state.saveRequests.length).toBe(1);
    expect(state.saveRequests[0]).toMatchObject({ letterContent: 'Saved fixture letter.' });
  });

  test('autosaves a dirty letter when focus leaves the studio', async ({ page }) => {
    const state = await openLetterStudio(page);
    const textarea = page.getByRole('textbox', { name: 'Dispute letter content' });
    await expect(textarea).toBeEditable({ timeout: 15000 });

    await textarea.fill('Autosaved fixture letter.');
    await page.locator('select').last().focus();

    await expect.poll(() => state.saveRequests.length).toBe(1);
    expect(state.saveRequests[0]).toMatchObject({
      letterContent: 'Autosaved fixture letter.',
      acknowledgeWarnings: false,
    });
  });

  test('supports all five deliberate tone rewrites', async ({ page }) => {
    const state = await openLetterStudio(page);
    await page.getByRole('combobox', { name: 'Rewrite mode' }).selectOption('tone');
    const toneSelect = page.getByRole('combobox', { name: 'Letter tone' });

    const tones = ['professional', 'concerned', 'annoyed', 'disappointed', 'demanding'];
    for (const [index, tone] of tones.entries()) {
      await toneSelect.selectOption(tone);
      await page.getByRole('button', { name: 'Rewrite' }).click({ force: true });
      await expect.poll(() => state.toneRequests.length).toBe(index + 1);
    }

    await expect.poll(() => state.toneRequests).toEqual(['professional', 'concerned', 'annoyed', 'disappointed', 'demanding']);
  });

  test('keeps warnings saveable after acknowledgement and blocks fabricated creditors', async ({ page }) => {
    const state = await openLetterStudio(page);
    const textarea = page.getByRole('textbox', { name: 'Dispute letter content' });
    await expect(textarea).toBeEditable({ timeout: 15000 });

    await textarea.fill('I will pursue legal action if needed.');
    await expect(page.getByText('Review warnings before saving')).toBeVisible();
    await page.getByLabel('I reviewed these warnings and want to save this letter.').check({ force: true });
    await page.getByRole('button', { name: 'Save letter' }).click({ force: true });
    await expect.poll(() => state.saveRequests.length).toBe(1);
    expect(state.saveRequests[0]).toMatchObject({ acknowledgeWarnings: true });

    await textarea.fill('This not-on-file creditor must be deleted.');
    await expect(page.getByText('Blocked until corrected')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save letter' })).toBeDisabled();
  });

  test('shows history and diff, appends a revert revision, and makes sent letters read-only', async ({ page }) => {
    const state = await openLetterStudio(page);
    const textarea = page.getByRole('textbox', { name: 'Dispute letter content' });
    await expect(textarea).toBeEditable({ timeout: 15000 });

    await textarea.fill('A second saved fixture letter.');
    await page.getByRole('button', { name: 'Save letter' }).click({ force: true });
    await expect(page.getByText(/Revision 2 · manual/)).toBeVisible();

    await page.getByRole('button', { name: /Revision 1 · generated/ }).click({ force: true });
    await expect(page.getByText('Diff against revision 1')).toBeVisible();
    await page.getByRole('button', { name: 'Revert to revision 1' }).click();
    await expect.poll(() => state.revertRequests.length).toBe(1);
    await expect(page.getByText(/Saved as revision 3/)).toBeVisible({ timeout: 15000 });

    await page.goto('/workspace/disputes');
    await page.unroute('**/api/workspace/disputes**');
    const sentState = await openLetterStudio(page, true);
    await expect(page.getByText(/has been sent and its letter is immutable/i)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Dispute letter content' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save letter' })).not.toBeVisible();
    expect(sentState.saveRequests).toHaveLength(0);
  });
});
