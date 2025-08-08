import { test, expect } from '@playwright/test';

test.describe('Authentication Pages', () => {
  test('login page should redirect to install when database not available', async ({ page }) => {
    await page.goto('/login');
    
    // Should redirect to install page when database is not available
    await page.waitForURL('**/install', { timeout: 10000 });
    await expect(page).toHaveURL('/install');
    
    // Page should load successfully
    await expect(page.locator('body')).toBeVisible();
  });

  test('register page should redirect to install when database not available', async ({ page }) => {
    await page.goto('/register');
    
    // Should redirect to install page when database is not available  
    await page.waitForURL('**/install', { timeout: 10000 });
    await expect(page).toHaveURL('/install');
    
    // Page should load successfully
    await expect(page.locator('body')).toBeVisible();
  });

  test('authentication routes should be protected without database', async ({ page }) => {
    const authRoutes = ['/login', '/register'];
    
    for (const route of authRoutes) {
      await page.goto(route);
      
      // Should redirect to install page when database is not available
      await page.waitForURL('**/install', { timeout: 10000 });
      await expect(page).toHaveURL('/install');
    }
  });

  test('install page should load correctly when accessed from auth routes', async ({ page }) => {
    // Navigate to login (which should redirect to install)
    await page.goto('/login');
    await page.waitForURL('**/install', { timeout: 10000 });
    
    // Verify install page content loads properly
    await expect(page.locator('body')).toBeVisible();
    
    // Should have installation-related content
    const content = await page.content();
    const hasInstallContent = content.toLowerCase().includes('install') || 
                             content.toLowerCase().includes('setup') ||
                             content.toLowerCase().includes('database');
    expect(hasInstallContent).toBe(true);
  });

  test('should handle navigation attempts to auth pages gracefully', async ({ page }) => {
    const authPages = ['/login', '/register'];
    
    for (const authPage of authPages) {
      const response = await page.goto(authPage);
      
      // Should not return server error
      if (response?.status()) {
        expect(response.status()).toBeLessThan(500);
      }
      
      // Should end up on install page
      await page.waitForURL('**/install', { timeout: 5000 });
      expect(page.url()).toContain('install');
    }
  });

  test('install page should have proper structure when redirected from auth', async ({ page }) => {
    await page.goto('/login');
    await page.waitForURL('**/install', { timeout: 10000 });
    
    // Check page title
    const title = await page.title();
    expect(title.toLowerCase()).toContain('nextlog');
    
    // Check for proper HTML structure
    await expect(page.locator('html')).toBeVisible();
    await expect(page.locator('body')).toBeVisible();
  });
});