/**
 * Health API Tests
 * Tests for health monitoring endpoints
 *
 * Coverage: P0/P1 - Service monitoring
 */

import { test, expect } from '../support/merged-fixtures';

test.describe('Health API @api @health @monitoring', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test('[P0] should return Redis health status @smoke @p0', async ({ request }) => {
    // Given the Redis service
    // When requesting health status
    const response = await request.get(`${baseUrl}/api/health/redis`);

    // Then the response should indicate service status
    const body = await response.json();
    expect(body.service).toBe('redis');
    expect(body.status).toBeDefined();
    expect(['healthy', 'unhealthy']).toContain(body.status);
    expect(body.timestamp).toBeDefined();

    // Status code should reflect health
    const expectedStatus = body.status === 'healthy' ? 200 : 503;
    expect(response.status()).toBe(expectedStatus);
  });

  test('[P0] should include latency in Redis health response @p0', async ({ request }) => {
    // When requesting Redis health
    const response = await request.get(`${baseUrl}/api/health/redis`);

    // Then latency should be included
    const body = await response.json();
    expect(body.latency).toBeDefined();
    expect(typeof body.latency).toBe('number');
    expect(body.latency).toBeGreaterThanOrEqual(0);
  });

  test('[P0] should return ingestion health status @smoke @p0 @epic2', async ({ request }) => {
    // Given the ingestion service with multiple providers
    // When requesting ingestion health
    const response = await request.get(`${baseUrl}/api/ingestion/health`);

    // Then the response should include provider statuses
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
    expect(body.providers).toBeDefined();
    expect(body.summary).toBeDefined();
    expect(body.summary.total).toBeGreaterThanOrEqual(0);
    expect(body.summary.healthy).toBeGreaterThanOrEqual(0);
    expect(body.traceId).toBeDefined();
    expect(body.duration).toBeDefined();
  });

  test('[P1] should calculate correct overall status for ingestion health @p1', async ({ request }) => {
    // When requesting ingestion health
    const response = await request.get(`${baseUrl}/api/ingestion/health`);

    // Then status calculation should be consistent
    const body = await response.json();
    const { total, healthy } = body.summary;

    if (healthy === 0 && total > 0) {
      expect(body.status).toBe('unhealthy');
    } else if (healthy === total && total > 0) {
      expect(body.status).toBe('healthy');
    } else if (total > 0) {
      expect(body.status).toBe('degraded');
    }
  });

  test('[P1] should return 503 when ingestion is unhealthy @error @p1', async ({ request }) => {
    // When ingestion health shows all providers down
    const response = await request.get(`${baseUrl}/api/ingestion/health`);

    // Then status should be 503 if unhealthy
    const body = await response.json();
    if (body.status === 'unhealthy') {
      expect(response.status()).toBe(503);
    }
  });

  test('[P1] should include cache-control headers @headers @p1', async ({ request }) => {
    // When requesting health endpoints
    const redisResponse = await request.get(`${baseUrl}/api/health/redis`);
    const ingestionResponse = await request.get(`${baseUrl}/api/ingestion/health`);

    // Then cache headers should prevent caching
    expect(redisResponse.headers()['cache-control']).toContain('no-store');
    expect(ingestionResponse.headers()['cache-control']).toContain('no-cache');
  });

  test('[P2] should handle health check errors gracefully @error @p2', async ({ request }) => {
    // Health endpoints should always return a response even on error
    const response = await request.get(`${baseUrl}/api/health/redis`);

    // Should return valid JSON
    const body = await response.json();
    expect(body).toBeDefined();
    expect(body.service || body.error).toBeDefined();
  });

  test('[P2] should include individual provider health details @p2', async ({ request }) => {
    // When requesting ingestion health
    const response = await request.get(`${baseUrl}/api/ingestion/health`);

    // Then each provider should have health details
    const body = await response.json();
    if (body.providers && Object.keys(body.providers).length > 0) {
      const provider = Object.values(body.providers)[0] as { healthy: boolean; latency: number };
      expect(provider.healthy).toBeDefined();
      expect(provider.latency).toBeDefined();
    }
  });
});
