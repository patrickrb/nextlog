import { test, expect } from '@playwright/test';

test.describe('Nextlog Basic Navigation', () => {
  test('should load installation page correctly', async ({ page }) => {
    await page.goto('/install');
    
    // Check that we can load the install page
    await expect(page).toHaveURL('/install');
    
    // The page should load without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display correct page title', async ({ page }) => {
    await page.goto('/install');
    
    // Check page title contains expected text
    await expect(page).toHaveTitle(/.*nextlog.*/i);
  });
});