import { test, expect } from '@playwright/test';

test.describe('Contact Management Pages', () => {
  test('new contact page should load correctly', async ({ page }) => {
    // The page should load without server errors
    const response = await page.goto('/new-contact');
    
    // Check that the response is valid
    if (response?.status()) {
      expect(response.status()).toBeLessThan(500);
    }
    
    // Check that we're on the new contact page or redirected appropriately
    const url = page.url();
    
    // Should either be on new-contact page or redirected to install/login
    expect(url).toMatch(/(new-contact|install|login)/);
  });

  test('dashboard page should handle missing database gracefully', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should redirect to install or login page when no database
    await page.waitForURL(/(install|login)/, { timeout: 10000 });
    
    const url = page.url();
    expect(url).toMatch(/(install|login)/);
  });

  test('search page should load correctly', async ({ page }) => {
    await page.goto('/search');
    
    // Should handle the request appropriately
    const response = await page.goto('/search');
    expect(response?.status()).toBeLessThan(500);
    
    // Should either show search page or redirect
    const url = page.url();
    expect(url).toMatch(/(search|install|login)/);
  });

  test('stations page should load correctly', async ({ page }) => {
    await page.goto('/stations');
    
    // Should handle the request appropriately
    const response = await page.goto('/stations');
    expect(response?.status()).toBeLessThan(500);
    
    // Should either show stations page or redirect
    const url = page.url();
    expect(url).toMatch(/(stations|install|login)/);
  });

  test('awards pages should load correctly', async ({ page }) => {
    // Test main awards page
    let response = await page.goto('/awards');
    if (response?.status()) {
      expect(response.status()).toBeLessThan(500);
    }
    
    // Test DXCC awards page
    response = await page.goto('/awards/dxcc');
    if (response?.status()) {
      expect(response.status()).toBeLessThan(500);
    }
    
    // Test WAS awards page
    response = await page.goto('/awards/was');
    if (response?.status()) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('admin pages should require authentication', async ({ page }) => {
    await page.goto('/admin');
    
    // Should redirect to login or install page
    await page.waitForURL(/(install|login)/, { timeout: 10000 });
    
    const url = page.url();
    expect(url).toMatch(/(install|login)/);
  });

  test('API endpoints should respond appropriately', async ({ page }) => {
    // Test that API endpoints return appropriate responses
    const apiTests = [
      '/api/contacts',
      '/api/stations', 
      '/api/user',
      '/api/install/check'
    ];

    for (const apiPath of apiTests) {
      const response = await page.goto(apiPath);
      const status = response?.status();
      
      // Should not return server error (500+), though may return 401/403/404
      expect(status).toBeLessThan(500);
    }
  });
});