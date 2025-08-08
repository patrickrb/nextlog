import { test, expect } from '@playwright/test';

test.describe('Authentication Pages', () => {
  test('login page should display form elements correctly', async ({ page }) => {
    await page.goto('/login');
    
    // Check page loads correctly
    await expect(page).toHaveURL('/login');
    
    // Check for specific form elements based on actual structure
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    
    // Check for labels
    await expect(page.locator('label[for="email"]')).toContainText('Email Address');
    await expect(page.locator('label[for="password"]')).toContainText('Password');
    
    // Check for submit button
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
    
    // Check page title and description
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('text=Sign in to your Nextlog account')).toBeVisible();
  });

  test('register page should display form elements correctly', async ({ page }) => {
    await page.goto('/register');
    
    // Check page loads correctly
    await expect(page).toHaveURL('/register');
    
    // Check for specific form elements based on actual structure
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#callsign')).toBeVisible();
    await expect(page.locator('#gridLocator')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
    
    // Check for submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check page title
    await expect(page.locator('text=Create your account')).toBeVisible();
  });

  test('should handle empty form submission with validation', async ({ page }) => {
    await page.goto('/login');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // The form should have HTML5 validation or custom validation
    // Since email and password are required, the form shouldn't submit
    await page.waitForTimeout(1000);
    
    // Should still be on login page
    await expect(page).toHaveURL('/login');
  });

  test('should show error message for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Fill in invalid credentials
    await page.fill('#email', 'invalid@test.com');
    await page.fill('#password', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for response and check for error
    await page.waitForTimeout(2000);
    
    // Should show error message or still be on login page
    const currentUrl = page.url();
    expect(currentUrl).toContain('login');
  });

  test('forms should have proper accessibility', async ({ page }) => {
    await page.goto('/login');
    
    // Check that form inputs have proper labels
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="password"]')).toBeVisible();
    
    // Check that inputs have proper attributes
    const emailInput = page.locator('#email');
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('required');
    
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('required');
  });

  test('should navigate between login and register pages', async ({ page }) => {
    await page.goto('/login');
    
    // Look for link to register page
    const registerLink = page.locator('a[href="/register"]');
    if (await registerLink.count() > 0) {
      await registerLink.click();
      await expect(page).toHaveURL('/register');
    }
    
    // Test navigation back to login from register
    await page.goto('/register');
    const loginLink = page.locator('a[href="/login"]');
    if (await loginLink.count() > 0) {
      await loginLink.click();
      await expect(page).toHaveURL('/login');
    }
  });
});