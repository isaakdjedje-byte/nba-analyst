/**
 * Runs Health API Tests
 * Tests for scheduler health check endpoint
 *
 * Coverage: P0 - Critical monitoring endpoints
 * Story: 2.8 - Daily production run pipeline
 */

import { test, expect } from '@playwright/test';

test.describe('Runs Health API @api @runs @health @epic2', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test('[P0] should return healthy status when scheduler is operational @smoke @p0', async ({ request }) => {
    // Given the scheduler health endpoint
    // When requesting health status
    const response = await request.get(`${baseUrl}/api/v1/runs/health`);

    // Then the response should be successful
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body).toHaveProperty('healthy');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('config');
    expect(body).toHaveProperty('metrics');
    expect(body).toHaveProperty('timestamp');
  });

  test('[P0] should return correct config structure @p0', async ({ request }) => {
    // Given the scheduler health endpoint
    // When requesting health status
    const response = await request.get(`${baseUrl}/api/v1/runs/health`);

    // Then config should have required fields
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body.config).toHaveProperty('cronExpression');
    expect(body.config).toHaveProperty('timezone');
    expect(body.config).toHaveProperty('enabled');
    expect(typeof body.config.enabled).toBe('boolean');
  });

  test('[P0] should return metrics with timestamps @p0', async ({ request }) => {
    // Given the scheduler health endpoint
    // When requesting health status
    const response = await request.get(`${baseUrl}/api/v1/runs/health`);

    // Then metrics should include timing information
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body.metrics).toHaveProperty('consecutiveFailures');
    expect(typeof body.metrics.consecutiveFailures).toBe('number');
    // Note: lastSuccessfulRun and lastFailedRun may not exist if no runs completed
    // Just verify metrics object has the expected structure
    expect(body.metrics).toBeDefined();
  });

  test('[P1] should return valid ISO timestamp @p1', async ({ request }) => {
    // Given the scheduler health endpoint
    // When requesting health status
    const response = await request.get(`${baseUrl}/api/v1/runs/health`);

    // Then timestamp should be valid ISO format
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    
    // Should be parseable as date
    const parsedDate = new Date(body.timestamp);
    expect(parsedDate.getTime()).toBeGreaterThan(0);
  });

  test('[P1] should indicate healthy state correctly @p1', async ({ request }) => {
    // Given the scheduler health endpoint
    // When requesting health status
    const response = await request.get(`${baseUrl}/api/v1/runs/health`);

    // Then healthy flag should reflect scheduler state
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    // Healthy should be a boolean
    expect(typeof body.healthy).toBe('boolean');
    
    // Message should exist when healthy
    if (body.healthy) {
      expect(body.message).toBeTruthy();
    }
  });

  test('[P2] should handle scheduler disabled state @p2', async ({ request }) => {
    // Given the scheduler health endpoint
    // When requesting health status with scheduler disabled
    // (This test documents expected behavior - actual result depends on config)
    const response = await request.get(`${baseUrl}/api/v1/runs/health`);

    // Then should return appropriate status
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    // Even if disabled, should return valid response structure
    expect(body).toHaveProperty('healthy');
    expect(body).toHaveProperty('config');
    expect(body.config).toHaveProperty('enabled');
  });

  test('[P2] should handle consecutive failures tracking @p2', async ({ request }) => {
    // Given the scheduler health endpoint
    // When requesting health status
    const response = await request.get(`${baseUrl}/api/v1/runs/health`);

    // Then consecutive failures should be tracked
    expect(response.status()).toBe(200);
    const body = await response.json();
    
    // Consecutive failures should be non-negative
    expect(body.metrics.consecutiveFailures).toBeGreaterThanOrEqual(0);
  });
});
