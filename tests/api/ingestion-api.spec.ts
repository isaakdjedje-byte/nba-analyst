/**
 * Ingestion API Tests
 * Tests for data ingestion endpoints
 *
 * Coverage: P0 - Critical data pipeline
 */

import { test, expect } from '../support/merged-fixtures';

test.describe('Ingestion API @api @ingestion @epic2', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test('[P0] should get ingestion status @smoke @p0', async ({ request }) => {
    // Given the ingestion service is running
    // When requesting ingestion status
    const response = await request.get(`${baseUrl}/api/ingestion`);

    // Then the response should be successful
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.providers).toBeDefined();
    expect(body.traceId).toBeDefined();
  });

  test('[P0] should trigger ingestion from all providers @smoke @p0', async ({ request }) => {
    // Given all providers are configured
    // When triggering ingestion for all providers
    const response = await request.post(`${baseUrl}/api/ingestion`, {
      data: { all: true },
    });

    // Then the response should be successful
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBeDefined();
    expect(body.summary).toBeDefined();
    expect(body.byProvider).toBeDefined();
    expect(body.traceId).toBeDefined();
    expect(body.duration).toBeDefined();
  });

  test('[P0] should trigger ingestion from specific provider @p0', async ({ request }) => {
    // Given a specific provider is requested
    const provider = 'espn';

    // When triggering ingestion for that provider
    const response = await request.post(`${baseUrl}/api/ingestion`, {
      data: { provider },
    });

    // Then the response should indicate success or failure
    const body = await response.json();
    expect([200, 500]).toContain(response.status());
    expect(body.traceId).toBeDefined();
    if (response.status() === 200) {
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    }
  });

  test('[P1] should reject ingestion without provider or all flag @validation @p1', async ({ request }) => {
    // Given an invalid request without provider or all flag
    // When making the request
    const response = await request.post(`${baseUrl}/api/ingestion`, {
      data: {},
    });

    // Then the response should be a bad request
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Bad Request');
    expect(body.message).toContain('Must specify either "provider" or "all: true"');
    expect(body.traceId).toBeDefined();
  });

  test('[P1] should handle ingestion errors gracefully @error @p1', async ({ request }) => {
    // Given an invalid provider name
    const provider = 'invalid-provider-name';

    // When triggering ingestion
    const response = await request.post(`${baseUrl}/api/ingestion`, {
      data: { provider },
    });

    // Then the response should handle the error
    const body = await response.json();
    expect(body.traceId).toBeDefined();
    // Service may return 500 for provider errors
    expect([200, 500]).toContain(response.status());
  });

  test('[P2] should include trace ID in response headers @observability @p2', async ({ request }) => {
    // When making any ingestion request
    const response = await request.get(`${baseUrl}/api/ingestion`);

    // Then trace ID should be present in headers
    expect(response.status()).toBe(200);
    const traceId = response.headers()['x-trace-id'];
    expect(traceId).toBeDefined();
    expect(traceId).toContain('ingestion-api');
  });

  test('[P2] should return multi-status when some providers fail @p2', async ({ request }) => {
    // Given a request to ingest from all providers
    // When some providers may fail (in real scenarios)
    const response = await request.post(`${baseUrl}/api/ingestion`, {
      data: { all: true },
    });

    // Then response status should be 200 (all ok) or 207 (multi-status)
    expect([200, 207]).toContain(response.status());
    const body = await response.json();
    expect(body.byProvider).toBeDefined();
  });
});
