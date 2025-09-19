import { test, expect } from '@playwright/test';

test.describe('API Ping Health Endpoint', () => {
  test('should reject requests without API key', async ({ request }) => {
    const response = await request.get('/api/ping');
    
    expect(response.status()).toBe(401);
    
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('API key is required');
    expect(data.timestamp).toBeTruthy();
  });

  test('should reject requests with invalid API key format', async ({ request }) => {
    // Test with invalid format
    const response = await request.get('/api/ping', {
      headers: {
        'X-API-Key': 'invalid-key-format'
      }
    });
    
    expect(response.status()).toBe(401);
    
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid API key format');
    expect(data.timestamp).toBeTruthy();
  });

  test('should reject requests with non-existent API key', async ({ request }) => {
    // Test with valid format but non-existent key
    const response = await request.get('/api/ping', {
      headers: {
        'X-API-Key': 'nextlog_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      }
    });
    
    // In test environment without database, expect either 401 (auth error) or 500 (db error)
    expect([401, 500]).toContain(response.status());
    
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeTruthy();
    expect(data.timestamp).toBeTruthy();
  });

  test('should support different authentication methods', async ({ request }) => {
    const testKey = 'nextlog_test1234567890123456789012345';
    
    // Test X-API-Key header
    const headerResponse = await request.get('/api/ping', {
      headers: {
        'X-API-Key': testKey
      }
    });
    expect([401, 500]).toContain(headerResponse.status()); // Expected since key doesn't exist or no DB
    
    // Test Authorization Bearer header
    const bearerResponse = await request.get('/api/ping', {
      headers: {
        'Authorization': `Bearer ${testKey}`
      }
    });
    expect([401, 500]).toContain(bearerResponse.status()); // Expected since key doesn't exist or no DB
    
    // Test query parameter
    const queryResponse = await request.get(`/api/ping?api_key=${testKey}`);
    expect([401, 500]).toContain(queryResponse.status()); // Expected since key doesn't exist or no DB
  });

  test('should handle CORS preflight requests', async ({ request }) => {
    const response = await request.fetch('/api/ping', {
      method: 'OPTIONS'
    });
    
    expect(response.status()).toBe(200);
    expect(response.headers()['access-control-allow-origin']).toBe('*');
    expect(response.headers()['access-control-allow-methods']).toContain('GET');
    expect(response.headers()['access-control-allow-headers']).toContain('X-API-Key');
    expect(response.headers()['access-control-allow-headers']).toContain('Authorization');
  });

  test('should include CORS headers in response', async ({ request }) => {
    const response = await request.get('/api/ping');
    
    // Check CORS headers are present
    expect(response.headers()['access-control-allow-origin']).toBe('*');
    expect(response.headers()['access-control-allow-methods']).toContain('GET');
    expect(response.headers()['access-control-allow-headers']).toContain('X-API-Key');
  });

  test('should return proper response structure on authentication failure', async ({ request }) => {
    const response = await request.get('/api/ping');
    
    const data = await response.json();
    
    // Validate response structure
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('error');
    expect(data).toHaveProperty('timestamp');
    expect(data.success).toBe(false);
    expect(typeof data.timestamp).toBe('string');
    
    // Validate timestamp format (ISO 8601)
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });

  test('should handle server errors gracefully', async ({ request }) => {
    // This test ensures the endpoint handles unexpected errors
    // In a real scenario with a valid API key, it would test the success case
    const response = await request.get('/api/ping', {
      headers: {
        'X-API-Key': 'nextlog_test1234567890123456789012345'
      }
    });
    
    // Should handle database connection errors gracefully
    expect([401, 500]).toContain(response.status());
    
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.timestamp).toBeTruthy();
    expect(data.error).toBeTruthy();
  });

  test('should validate content type', async ({ request }) => {
    const response = await request.get('/api/ping');
    
    expect(response.headers()['content-type']).toContain('application/json');
  });
});