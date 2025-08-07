import { test, expect } from '@playwright/test';

test.describe('ADIF and Import/Export Features', () => {
  test('ADIF page should load correctly', async ({ page }) => {
    await page.goto('/adif');
    
    // Should handle the request appropriately (either show page or redirect)
    const response = await page.goto('/adif');
    expect(response?.status()).toBeLessThan(500);
    
    const url = page.url();
    expect(url).toMatch(/(adif|install|login)/);
  });

  test('LoTW page should load correctly', async ({ page }) => {
    await page.goto('/lotw');
    
    // Should handle the request appropriately
    const response = await page.goto('/lotw');
    expect(response?.status()).toBeLessThan(500);
    
    const url = page.url();
    expect(url).toMatch(/(lotw|install|login)/);
  });

  test('QSL cards page should load correctly', async ({ page }) => {
    await page.goto('/qsl-cards');
    
    // Should handle the request appropriately
    const response = await page.goto('/qsl-cards');
    expect(response?.status()).toBeLessThan(500);
    
    const url = page.url();
    expect(url).toMatch(/(qsl-cards|install|login)/);
  });

  test('propagation page should load correctly', async ({ page }) => {
    await page.goto('/propagation');
    
    // Should handle the request appropriately
    const response = await page.goto('/propagation');
    expect(response?.status()).toBeLessThan(500);
    
    const url = page.url();
    expect(url).toMatch(/(propagation|install|login)/);
  });

  test('stats page should load correctly', async ({ page }) => {
    await page.goto('/stats');
    
    // Should handle the request appropriately
    const response = await page.goto('/stats');
    expect(response?.status()).toBeLessThan(500);
    
    const url = page.url();
    expect(url).toMatch(/(stats|install|login)/);
  });

  test('DXpeditions page should load correctly', async ({ page }) => {
    await page.goto('/dxpeditions');
    
    // Should handle the request appropriately
    const response = await page.goto('/dxpeditions');
    expect(response?.status()).toBeLessThan(500);
    
    const url = page.url();
    expect(url).toMatch(/(dxpeditions|install|login)/);
  });
});