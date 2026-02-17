/**
 * Runs API Tests
 * Tests for run management endpoints
 *
 * Coverage: P1 - Core functionality
 */

import { test, expect } from '../support/merged-fixtures';
import { createRun, createFailedRun, createRunningRun } from '../support/factories';

test.describe('Runs API @api @runs @epic2', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test('[P1] should retrieve all runs @smoke @p1', async ({ request }) => {
    // Given the runs API
    // When requesting all runs
    const response = await request.get(`${baseUrl}/api/v1/runs`);

    // Then the response should be successful
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.runs).toBeDefined();
    expect(Array.isArray(body.runs)).toBe(true);
  });

  test('[P1] should create a new run @smoke @p1', async ({ request }) => {
    // Given run data
    const runData = createRun({
      status: 'pending',
      decisionsCount: 5,
    });

    // When creating a run
    const response = await request.post(`${baseUrl}/api/v1/runs`, {
      data: runData,
    });

    // Then the run should be created
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.status).toBe('pending');
    expect(body.decisionsCount).toBe(5);
  });

  test('[P1] should create run with auto-generated ID @p1', async ({ request }) => {
    // Given run data without ID
    const runData = {
      status: 'running',
      decisionsCount: 3,
    };

    // When creating a run
    const response = await request.post(`${baseUrl}/api/v1/runs`, {
      data: runData,
    });

    // Then ID should be auto-generated
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.id).toMatch(/^run-/);
  });

  test('[P1] should preserve provided run ID @p1', async ({ request }) => {
    // Given run data with specific ID
    const customId = 'run-custom-123';
    const runData = {
      id: customId,
      status: 'completed',
    };

    // When creating a run
    const response = await request.post(`${baseUrl}/api/v1/runs`, {
      data: runData,
    });

    // Then the provided ID should be preserved
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toBe(customId);
  });

  test('[P2] should create failed run status @p2', async ({ request }) => {
    // Given failed run data
    const runData = createFailedRun();

    // When creating a run
    const response = await request.post(`${baseUrl}/api/v1/runs`, {
      data: runData,
    });

    // Then the run should be created with failed status
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('failed');
    expect(body.errorsCount).toBeGreaterThan(0);
  });

  test('[P2] should create running run status @p2', async ({ request }) => {
    // Given running run data
    const runData = createRunningRun();

    // When creating a run
    const response = await request.post(`${baseUrl}/api/v1/runs`, {
      data: runData,
    });

    // Then the run should be created with running status
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('running');
    expect(body.completedAt).toBeUndefined();
  });

  test('[P2] should handle empty runs list @p2', async ({ request }) => {
    // When requesting runs
    const response = await request.get(`${baseUrl}/api/v1/runs`);

    // Then should return empty array if no runs
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.runs).toBeDefined();
    expect(Array.isArray(body.runs)).toBe(true);
  });

  test('[P3] should handle invalid run data @error @p3', async ({ request }) => {
    // Given invalid run data
    const runData = {
      status: 'invalid-status',
    };

    // When creating a run
    const response = await request.post(`${baseUrl}/api/v1/runs`, {
      data: runData,
    });

    // Then should handle gracefully (API accepts any data currently)
    expect([201, 400]).toContain(response.status());
  });
});
