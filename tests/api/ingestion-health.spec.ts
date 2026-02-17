import { test, expect } from '@playwright/test';

/**
 * Ingestion Health API Tests
 * 
 * Tests for /api/ingestion/health endpoint
 * Monitors data provider health status
 * 
 * Priority: P1 - Data integrity is critical for the platform
 */
test.describe('Ingestion Health API @api @ingestion @health', () => {
  const ENDPOINT = '/api/ingestion/health';

  test('[P0] should return health status with required fields @smoke @p0', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    // Should return 200 (healthy) or 503 (unhealthy)
    expect([200, 503]).toContain(response.status());
    
    const body = await response.json();
    
    // Verify response structure
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('providers');
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('traceId');
    expect(body).toHaveProperty('duration');
    
    // Verify status values
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
    
    // Verify summary
    expect(body.summary).toHaveProperty('total');
    expect(body.summary).toHaveProperty('healthy');
    expect(body.summary).toHaveProperty('degraded');
    
    // Summary counts should add up
    expect(body.summary.healthy + body.summary.degraded).toBe(body.summary.total);
  });

  test('[P0] should return 503 when all providers unhealthy @smoke @p0', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    const body = await response.json();
    
    if (body.status === 'unhealthy') {
      expect(response.status()).toBe(503);
    } else {
      expect(response.status()).toBe(200);
    }
  });

  test('[P0] should return 200 when all providers healthy @smoke @p0', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    const body = await response.json();
    
    if (body.status === 'healthy') {
      expect(response.status()).toBe(200);
    }
  });

  test('[P1] should include provider-specific health @p1', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    expect(response.status()).toBeGreaterThanOrEqual(200);
    
    const body = await response.json();
    
    // Providers should be an object with provider names as keys
    expect(body.providers).toBeDefined();
    expect(typeof body.providers).toBe('object');
    
    // Each provider should have healthy and latency
    Object.entries(body.providers).forEach(([name, health]: [string, any]) => {
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('latency');
      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.latency).toBe('number');
    });
  });

  test('[P1] should return valid trace ID header @p1', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    // Should have trace ID in headers
    expect(response.headers()).toHaveProperty('x-trace-id');
    const traceId = response.headers()['x-trace-id'];
    expect(traceId).toBeTruthy();
    expect(typeof traceId).toBe('string');
  });

  test('[P1] should set no-cache headers @p1', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toContain('no-cache');
    expect(cacheControl).toContain('no-store');
    expect(cacheControl).toContain('must-revalidate');
  });

  test('[P2] should measure and return response duration @p2', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    const body = await response.json();
    
    // Duration should be a positive number (milliseconds)
    expect(typeof body.duration).toBe('number');
    expect(body.duration).toBeGreaterThanOrEqual(0);
  });

  test('[P2] should handle error responses properly @error @p2', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    const status = response.status();
    
    if (status === 503) {
      const body = await response.json();
      expect(body).toHaveProperty('status', 'unhealthy');
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('traceId');
    } else {
      // If not error, should be healthy
      const body = await response.json();
      expect(body.status).toBe('healthy');
    }
  });

  test('[P2] should return degraded status with some unhealthy providers @p2', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    const body = await response.json();
    
    // If degraded, should have both healthy and degraded counts
    if (body.status === 'degraded') {
      expect(body.summary.healthy).toBeGreaterThan(0);
      expect(body.summary.degraded).toBeGreaterThan(0);
      expect(response.status()).toBe(200);
    }
  });
});
