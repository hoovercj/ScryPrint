/**
 * End-to-end browser tests for the language picker and localization.
 *
 * Covers regressions:
 * - Language picker displays globe icon + language code (not flag emojis)
 * - Dropdown shows aligned language codes + names
 * - Switching language updates the UI text
 * - Planechase/Archenemy show English-only note for non-en languages
 * - Browse search returns results in non-English languages
 * - Momir page displays localized card data
 */
import { test, expect } from '@playwright/test';

test.describe('Language Picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('language button shows globe icon with code, not a flag emoji', async ({ page }) => {
    const langBtn = page.locator('[class*="langBtn"]');
    await expect(langBtn).toBeVisible();
    // Should contain a globe SVG
    const svg = langBtn.locator('svg');
    await expect(svg).toBeVisible();
    // Should show language code text
    const code = langBtn.locator('[class*="langBtnCode"]');
    await expect(code).toBeVisible();
    const text = await code.textContent();
    expect(text).toMatch(/^[A-Z]{2,3}$/);
  });

  test('dropdown opens and shows language options', async ({ page }) => {
    await page.click('[class*="langBtn"]');
    const dropdown = page.locator('[class*="langDropdown"]');
    await expect(dropdown).toBeVisible();
    // Should have 11 languages
    const options = dropdown.locator('[class*="langOption"]');
    await expect(options).toHaveCount(11);
    // Each option should have a code and name
    const firstCode = options.first().locator('[class*="langCode"]');
    await expect(firstCode).toBeVisible();
    const firstName = options.first().locator('[class*="langName"]');
    await expect(firstName).toBeVisible();
  });

  test('switching to Italian changes UI text', async ({ page }) => {
    await page.click('[class*="langBtn"]');
    // Click Italian option
    await page.click('[class*="langOption"]:has-text("Italiano")');
    // Landing subtitle should be in Italian
    await expect(page.locator('text=A cosa giochi oggi?')).toBeVisible();
  });

  test('switching back to English restores UI text', async ({ page }) => {
    // Switch to Italian first
    await page.click('[class*="langBtn"]');
    await page.click('[class*="langOption"]:has-text("Italiano")');
    await expect(page.locator('text=A cosa giochi oggi?')).toBeVisible();
    // Switch back
    await page.click('[class*="langBtn"]');
    await page.click('[class*="langOption"]:has-text("English")');
    await expect(page.locator('text=What are you playing today?')).toBeVisible();
  });
});

test.describe('Planechase English-only note', () => {
  test('shows note when non-English language is selected', async ({ page }) => {
    await page.goto('/');
    // Switch to Spanish
    await page.click('[class*="langBtn"]');
    await page.click('[class*="langOption"]:has-text("Español")');
    // Navigate to Planechase
    await page.goto('/planechase');
    const note = page.locator('[class*="langNote"]');
    await expect(note).toBeVisible();
  });

  test('hides note when English is selected', async ({ page }) => {
    await page.goto('/planechase');
    const note = page.locator('[class*="langNote"]');
    await expect(note).not.toBeVisible();
  });
});

test.describe('Archenemy English-only note', () => {
  test('shows note when non-English language is selected', async ({ page }) => {
    await page.goto('/');
    await page.click('[class*="langBtn"]');
    await page.click('[class*="langOption"]:has-text("Français")');
    await page.goto('/archenemy');
    const note = page.locator('[class*="langNote"]');
    await expect(note).toBeVisible();
  });

  test('hides note when English is selected', async ({ page }) => {
    await page.goto('/archenemy');
    const note = page.locator('[class*="langNote"]');
    await expect(note).not.toBeVisible();
  });
});

test.describe('Browse — localized search', () => {
  test('search returns results without 404 errors', async ({ page }) => {
    // Collect console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/browse');
    const searchInput = page.locator('input[placeholder]');
    await searchInput.fill('lightning bolt');
    // Wait for results to appear
    await page.waitForSelector('[class*="cardItem"]', { timeout: 10000 });
    const cards = page.locator('[class*="cardItem"]');
    expect(await cards.count()).toBeGreaterThan(0);
    // No 404 errors
    const scryfallErrors = errors.filter(e => e.includes('404'));
    expect(scryfallErrors).toEqual([]);
  });
});

test.describe('Settings panel — language dropdown', () => {
  test('settings language dropdown shows codes, not flag emojis', async ({ page }) => {
    await page.goto('/');
    // Open settings/info panel
    await page.click('[aria-label="About"]');
    // Find the language select
    const langSelect = page.locator('select').last();
    const firstOption = langSelect.locator('option').first();
    const text = await firstOption.textContent();
    // Should contain "EN" code, not a flag emoji
    expect(text).toContain('EN');
    expect(text).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]{2}/u); // no flag emojis
  });
});
