import { test, expect } from '@playwright/test';
import { createRun, createFailedRun } from '../support/factories';

/**
 * ML Orchestration API Tests
 * Tests for fallback chain, data quality gates, and source health monitoring
 */

test.describe('ML Orchestration API @api @p1', () => {
  const baseUrl = '/api/v1/ml';

  test.describe('Fallback Chain', () => {
    test('[P1] should trigger fallback when primary source fails', async ({ request }) => {
      // Given: A run with primary source failure
      const runData = createFailedRun({ source: 'primary-model', failureReason: 'timeout' });

      // When: Fallback chain is triggered
      const response = await request.post(`${baseUrl}/fallback`, {
        data: {
          runId: runData.id,
          failedSource: 'primary-model',
          availableSources: ['secondary-model', 'tertiary-model'],
        },
      });

      // Then: Fallback should succeed
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.fallbackTriggered).toBe(true);
      expect(body.selectedSource).toBe('secondary-model');
    });

    test('[P1] should return 422 when no fallback sources available', async ({ request }) => {
      // When: No fallback sources available
      const response = await request.post(`${baseUrl}/fallback`, {
        data: {
          runId: 'test-run-id',
          failedSource: 'primary-model',
          availableSources: [],
        },
      });

      // Then: Should return unprocessable entity
      expect(response.status()).toBe(422);
      const body = await response.json();
      expect(body.error).toBe('No fallback sources available');
    });

    test('[P2] should track fallback chain history', async ({ request }) => {
      // Given: Multiple fallback attempts
      const runId = `run-${Date.now()}`;

      // Trigger multiple fallbacks
      await request.post(`${baseUrl}/fallback`, {
        data: {
          runId,
          failedSource: 'primary-model',
          selectedSource: 'secondary-model',
        },
      });

      // Query fallback history
      const response = await request.get(`${baseUrl}/fallback-history/${runId}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.history).toBeInstanceOf(Array);
      expect(body.history.length).toBeGreaterThan(0);
    });
  });

  test.describe('Data Quality Gates', () => {
    test('[P0] should block prediction when data quality fails', async ({ request }) => {
      // Given: Invalid data that should fail quality checks
      const invalidData = {
        source: 'test-source',
        data: { incomplete: true },
        timestamp: null,
      };

      // When: Submitting to quality gate
      const response = await request.post(`${baseUrl}/quality-check`, {
        data: invalidData,
      });

      // Then: Should be blocked
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.allowed).toBe(false);
      expect(body.blockedReason).toBeDefined();
    });

    test('[P0] should allow prediction when data quality passes', async ({ request }) => {
      // Given: Valid data
      const validData = {
        source: 'test-source',
        data: { odds: 1.5, confidence: 0.85, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      };

      // When: Submitting to quality gate
      const response = await request.post(`${baseUrl}/quality-check`, {
        data: validData,
      });

      // Then: Should be allowed
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.allowed).toBe(true);
    });

    test('[P1] should return quality metrics', async ({ request }) => {
      const response = await request.get(`${baseUrl}/quality-metrics`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.metrics).toBeDefined();
      expect(body.passRate).toBeGreaterThanOrEqual(0);
      expect(body.passRate).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Source Health Monitoring', () => {
    test('[P1] should report source health status', async ({ request }) => {
      const response = await request.get(`${baseUrl}/source-health`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.sources).toBeInstanceOf(Array);
      body.sources.forEach((source: { name: string; status: string; lastCheck: string }) => {
        expect(source).toHaveProperty('name');
        expect(source).toHaveProperty('status');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(source.status);
      });
    });

    test('[P1] should update source health status', async ({ request }) => {
      const updateData = {
        sourceName: 'espn-provider',
        status: 'degraded',
        reason: 'Slow response times',
        latency: 2500,
      };

      const response = await request.post(`${baseUrl}/source-health`, {
        data: updateData,
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.updated).toBe(true);
    });

    test('[P2] should return health history for specific source', async ({ request }) => {
      const response = await request.get(`${baseUrl}/source-health/espn-provider/history`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.history).toBeInstanceOf(Array);
    });
  });

  test.describe('Orchestration Status', () => {
    test('[P0] should return current orchestration status', async ({ request }) => {
      const response = await request.get(`${baseUrl}/status`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.status).toBeDefined();
      expect(['idle', 'running', 'degraded', 'error']).toContain(body.status);
    });

    test('[P0] should return active runs', async ({ request }) => {
      const response = await request.get(`${baseUrl}/active-runs`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.runs).toBeInstanceOf(Array);
    });
  });
});
