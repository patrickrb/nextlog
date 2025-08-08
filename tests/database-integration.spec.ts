import { test, expect } from '@playwright/test';

test.describe('Database Integration Tests', () => {
  test('install page should handle database setup flow', async ({ page }) => {
    await page.goto('/install');
    
    // Should be on install page
    await expect(page).toHaveURL('/install');
    
    // Page should load without server errors
    await expect(page.locator('body')).toBeVisible();
    
    // Should have installation-related content
    const content = await page.content();
    const hasInstallContent = content.toLowerCase().includes('install') || 
                             content.toLowerCase().includes('setup') ||
                             content.toLowerCase().includes('database');
    expect(hasInstallContent).toBe(true);
  });

  test('API endpoints should handle missing database gracefully', async ({ page }) => {
    const apiEndpoints = [
      '/api/install/check',
      '/api/user',
      '/api/contacts',
      '/api/stations',
      '/api/awards/dxcc/summary',
      '/api/awards/was/summary'
    ];

    for (const endpoint of apiEndpoints) {
      const response = await page.goto(endpoint);
      const status = response?.status();
      
      // Should handle database errors gracefully (not return 500)
      // May return 401, 403, 404, or other non-500 errors
      if (status) {
        if (status >= 500) {
          console.log(`Endpoint ${endpoint} returned ${status} status`);
          const body = await response.text();
          console.log(`Response body: ${body.substring(0, 200)}...`);
        }
        expect(status).toBeLessThan(500);
      }
    }
  });

  test('authenticated routes should redirect to login when not authenticated', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard',
      '/new-contact', 
      '/admin',
      '/profile'
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to login or install page
      await page.waitForURL(/(login|install)/, { timeout: 10000 });
      
      const url = page.url();
      expect(url).toMatch(/(login|install)/);
    }
  });
});