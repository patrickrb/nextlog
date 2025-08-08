import { test, expect } from '@playwright/test';

test.describe('Nextlog Application Flow', () => {
  test('should redirect to install page when database is not set up', async ({ page }) => {
    await page.goto('/');
    
    // Wait for redirect to happen
    await page.waitForURL('**/install', { timeout: 10000 });
    
    // Should redirect to install page when database is not available
    await expect(page).toHaveURL('/install');
  });

  test('should display installation page correctly', async ({ page }) => {
    await page.goto('/install');
    
    // Check that we're on the install page
    await expect(page).toHaveURL('/install');
    
    // The page should load without errors
    await expect(page.locator('body')).toBeVisible();
    
    // Should have some installation-related content
    const content = await page.content();
    expect(content.toLowerCase()).toContain('install');
  });

  test('should be able to access login page directly', async ({ page }) => {
    await page.goto('/login');
    
    // Should be on login page
    await expect(page).toHaveURL('/login');
    
    // Check for login form elements with correct selectors
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('should be able to access register page directly', async ({ page }) => {
    await page.goto('/register');
    
    // Should be on register page
    await expect(page).toHaveURL('/register');
    
    // Check for registration form elements with correct selectors
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('should have proper page structure and metadata', async ({ page }) => {
    await page.goto('/install');
    
    // Check page title
    const title = await page.title();
    expect(title.toLowerCase()).toContain('nextlog');
    
    // Check for proper HTML structure
    await expect(page.locator('html')).toBeVisible();
    await expect(page.locator('body')).toBeVisible();
    
    // Check that head element exists (even though it's not visible)
    await expect(page.locator('head')).toHaveCount(1);
    
    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBeTruthy();
  });
});