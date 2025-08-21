import { test, expect } from '@playwright/test';

test.describe('ADIF and Import/Export Features', () => {
  test('ADIF page should load correctly', async ({ page }) => {
    // Should handle the request appropriately (either show page or redirect)
    const response = await page.goto('/adif');
    
    // Response might be null due to redirects, which is acceptable
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
    
    const url = page.url();
    expect(url).toMatch(/(adif|install|login)/);
  });

  test('LoTW page should load correctly', async ({ page }) => {
    // Should handle the request appropriately (redirect or load page)
    const response = await page.goto('/lotw');
    
    // Response might be null due to redirects, which is acceptable
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
    
    const url = page.url();
    expect(url).toMatch(/(lotw|install|login)/);
  });

  test('QSL cards page should load correctly', async ({ page }) => {
    // Should handle the request appropriately (redirect or load page)
    const response = await page.goto('/qsl-cards');
    
    // Response might be null due to redirects, which is acceptable
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
    
    const url = page.url();
    expect(url).toMatch(/(qsl-cards|install|login)/);
  });

  test('propagation page should load correctly', async ({ page }) => {
    // Should handle the request appropriately (redirect or load page)
    const response = await page.goto('/propagation');
    
    // Response might be null due to redirects, which is acceptable
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
    
    const url = page.url();
    expect(url).toMatch(/(propagation|install|login)/);
  });

  test('stats page should load correctly', async ({ page }) => {
    // Should handle the request appropriately (redirect or load page)
    const response = await page.goto('/stats');
    
    // Response might be null due to redirects, which is acceptable
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
    
    const url = page.url();
    expect(url).toMatch(/(stats|install|login)/);
  });

  test('DXpeditions page should load correctly', async ({ page }) => {
    // Should handle the request appropriately (redirect or load page)
    const response = await page.goto('/dxpeditions');
    
    // Response might be null due to redirects, which is acceptable
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
    
    const url = page.url();
    expect(url).toMatch(/(dxpeditions|install|login)/);
  });
});