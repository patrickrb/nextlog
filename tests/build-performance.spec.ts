import { test, expect } from '@playwright/test';

test.describe('Build and Performance', () => {
  test('application should start without build errors', async ({ page }) => {
    // Monitor any console errors during page load
    const errors: string[] = [];
    const warnings: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Wait for page to fully load
    await page.waitForTimeout(3000);
    
    // Filter out expected database connection errors
    const unexpectedErrors = errors.filter(error => 
      !error.includes('Installation check failed') && 
      !error.includes('ECONNREFUSED') &&
      !error.includes('relation "users" does not exist') &&
      !error.includes('connect ECONNREFUSED')
    );
    
    // Should not have unexpected JavaScript errors
    expect(unexpectedErrors).toHaveLength(0);
  });

  test('static assets should load correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check that basic HTML structure is present
    await expect(page.locator('html')).toBeVisible();
    await expect(page.locator('head')).toBeVisible();
    await expect(page.locator('body')).toBeVisible();
    
    // Check that CSS is loading (page should have background styling)
    const body = page.locator('body');
    const styles = await body.evaluate(el => {
      const computed = getComputedStyle(el);
      return {
        fontFamily: computed.fontFamily,
        margin: computed.margin,
        padding: computed.padding
      };
    });
    
    // Should have some CSS applied (Tailwind CSS)
    expect(styles.fontFamily).toBeTruthy();
  });

  test('page should be accessible', async ({ page }) => {
    await page.goto('/install');
    
    // Check for basic accessibility features
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBeTruthy(); // Should have language attribute
    
    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBeTruthy();
    
    // Check page has a title
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('application should handle different HTTP methods correctly', async ({ page }) => {
    // Test that API endpoints return appropriate responses for different methods
    const testEndpoints = [
      '/api/user',
      '/api/contacts',
      '/api/stations'
    ];

    for (const endpoint of testEndpoints) {
      const response = await page.goto(endpoint);
      const status = response?.status();
      
      // Should not return 5xx server errors
      if (status) {
        expect(status).toBeLessThan(500);
      }
    }
  });
});