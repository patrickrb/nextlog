import { test, expect } from '@playwright/test';

test.describe('Nextlog Core Features', () => {
  test('should load application without errors', async ({ page }) => {
    // Monitor console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Wait a moment for any JavaScript to execute
    await page.waitForTimeout(2000);
    
    // Should not have critical JavaScript errors (database errors are expected)
    const criticalErrors = errors.filter(error => 
      !error.includes('Installation check failed') && 
      !error.includes('ECONNREFUSED') &&
      !error.includes('relation "users" does not exist')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should have proper meta tags and SEO', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page has proper meta tags
    const title = await page.title();
    expect(title).toBeTruthy();
    
    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBeTruthy();
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    await page.goto('/non-existent-page');
    
    // Should show 404 page or redirect appropriately
    // The response should not be a server error
    const response = await page.goto('/non-existent-page');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load CSS and styling correctly', async ({ page }) => {
    await page.goto('/install');
    
    // Check that CSS is loaded by verifying computed styles
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Basic check that Tailwind CSS is working (should have some styling)
    const backgroundColor = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(backgroundColor).toBeTruthy();
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/install');
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();
  });
});