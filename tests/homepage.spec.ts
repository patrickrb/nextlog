import { test, expect } from '@playwright/test';

test.describe('Nextlog Application Flow', () => {
  test('should redirect to install page when database is not set up', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to install page when database is not available
    await expect(page).toHaveURL('/install');
    
    // Check for installation page content
    await expect(page.locator('text=Installation')).toBeVisible();
  });

  test('should display installation page correctly', async ({ page }) => {
    await page.goto('/install');
    
    // Check that we're on the install page
    await expect(page).toHaveURL('/install');
    
    // The install page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('should be able to access login page directly', async ({ page }) => {
    await page.goto('/login');
    
    // Should be on login page
    await expect(page).toHaveURL('/login');
    
    // Check for login form elements
    await expect(page.locator('input[type="email"], input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should be able to access register page directly', async ({ page }) => {
    await page.goto('/register');
    
    // Should be on register page
    await expect(page).toHaveURL('/register');
    
    // Check for registration form elements
    await expect(page.locator('input[type="email"], input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('homepage should show features when accessed without redirect', async ({ page }) => {
    // Visit homepage and wait longer to see if content loads despite redirect
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Give it a moment before redirect
    await page.waitForTimeout(500);
    
    // Even if redirected, we can test that the homepage component works
    // by checking that the source contains the expected content
    const content = await page.content();
    
    // The static content should be in the HTML even if JavaScript redirects
    expect(content).toContain('Nextlog');
    expect(content).toContain('Modern Amateur Radio Logging');
  });
});