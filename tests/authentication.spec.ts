import { test, expect } from '@playwright/test';

test.describe('Authentication Pages', () => {
  test('login page should display form elements', async ({ page }) => {
    await page.goto('/login');
    
    // Check page loads correctly
    await expect(page).toHaveURL('/login');
    
    // Look for form elements that should be present on a login page
    // Use more flexible selectors that don't depend on exact structure
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    
    // Should have at least 2 inputs (email/username and password)
    expect(inputCount).toBeGreaterThanOrEqual(2);
    
    // Should have some kind of submit button
    const buttons = page.locator('button, input[type="submit"]');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(1);
  });

  test('register page should display form elements', async ({ page }) => {
    await page.goto('/register');
    
    // Check page loads correctly
    await expect(page).toHaveURL('/register');
    
    // Look for form elements
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    
    // Registration typically has more fields than login
    expect(inputCount).toBeGreaterThanOrEqual(2);
    
    // Should have submit button
    const buttons = page.locator('button, input[type="submit"]');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(1);
  });

  test('should handle form validation', async ({ page }) => {
    await page.goto('/login');
    
    // Try to submit empty form
    const submitButton = page.locator('button, input[type="submit"]').first();
    await submitButton.click();
    
    // Page should handle validation (either client-side or server-side)
    // We shouldn't get a server error
    await page.waitForTimeout(1000);
    
    // Should still be on login page or show validation message
    const currentUrl = page.url();
    expect(currentUrl).toContain('login');
  });

  test('login and register pages should be accessible', async ({ page }) => {
    // Test login page accessibility
    await page.goto('/login');
    
    // Basic accessibility check - should have proper form labels or aria-labels
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const ariaLabel = await input.getAttribute('aria-label');
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');
      
      // Input should have some form of labeling
      expect(ariaLabel || id || name).toBeTruthy();
    }
  });

  test('pages should have proper navigation', async ({ page }) => {
    await page.goto('/login');
    
    // Look for navigation links (like "Sign up" on login page)
    const links = page.locator('a');
    const linkCount = await links.count();
    
    // Should have at least some navigation links
    expect(linkCount).toBeGreaterThan(0);
    
    // Test register page too
    await page.goto('/register');
    const registerLinks = page.locator('a');
    const registerLinkCount = await registerLinks.count();
    expect(registerLinkCount).toBeGreaterThan(0);
  });
});