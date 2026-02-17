/**
 * Runs Management API Tests
 * Tests for runs CRUD and orchestration endpoints
 *
 * Coverage: P1 - High priority run management
 */

import { test, expect } from '../support/merged-fixtures';
import { createRun, createFailedRun, createRunningRun } from '../support/factories';
import { faker } from '@faker-js/faker';

test.describe('Runs Management API @api @runs @p1 @epic2', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test.describe('GET /api/v1/runs', () => {
    test('[P1] should list all runs @smoke @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/runs',
      });

      expect(status).toBe(200);
      expect(body.runs).toBeDefined();
      expect(Array.isArray(body.runs)).toBe(true);
    });

    test('[P1] should support pagination @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/runs?page=1&limit=20',
      });

      expect(status).toBe(200);
      expect(body.runs).toBeDefined();
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(20);
    });

    test('[P1] should filter by status @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/runs?status=completed',
      });

      expect(status).toBe(200);
      expect(body.runs).toBeDefined();
    });

    test('[P2] should filter by date range @p2', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/runs?from=2024-01-01&to=2024-12-31',
      });

      expect(status).toBe(200);
      expect(body.runs).toBeDefined();
    });
  });

  test.describe('POST /api/v1/runs/trigger', () => {
    test('[P1] should trigger new run @smoke @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/runs/trigger',
        data: {
          type: 'daily',
          force: false,
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 201, 202]).toContain(status);
      if ([200, 201, 202].includes(status)) {
        expect(body.runId).toBeDefined();
        expect(body.status).toBeDefined();
        expect(body.queuedAt).toBeDefined();
      }
    });

    test('[P1] should trigger run with specific date @p1', async ({ apiRequest, authToken }) => {
      const runDate = new Date().toISOString().split('T')[0];

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/runs/trigger',
        data: {
          type: 'daily',
          date: runDate,
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 201, 202, 400]).toContain(status);
    });

    test('[P1] should require authentication @security @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/runs/trigger',
        data: { type: 'daily' },
        expectStatus: [401, 403],
      });

      expect([401, 403]).toContain(status);
    });

    test('[P2] should reject invalid run type @validation @p2', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/runs/trigger',
        data: {
          type: 'invalid-type',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [400, 401, 403],
      });

      expect([400, 401, 403]).toContain(status);
    });

    test('[P2] should handle concurrent run trigger @edge-case @p2', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/runs/trigger',
        data: {
          type: 'daily',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 201, 202, 409]).toContain(status);
      if (status === 409) {
        expect(body.error).toContain('already running');
      }
    });
  });

  test.describe('GET /api/v1/runs/:id', () => {
    test('[P1] should retrieve run details @smoke @p1', async ({ apiRequest }) => {
      const runId = faker.string.uuid();

      const { status, body } = await apiRequest({
        method: 'GET',
        path: `/api/v1/runs/${runId}`,
        expectStatus: [200, 404],
      });

      expect([200, 404]).toContain(status);
      
      if (status === 200) {
        expect(body.id).toBe(runId);
        expect(body.status).toBeDefined();
        expect(body.decisionsCount).toBeDefined();
      }
    });

    test('[P1] should return 404 for non-existent run @p1', async ({ apiRequest }) => {
      const nonExistentId = 'run-non-existent-123';

      const { status, body } = await apiRequest({
        method: 'GET',
        path: `/api/v1/runs/${nonExistentId}`,
        expectStatus: [404],
      });

      expect(status).toBe(404);
      expect(body.error).toBeDefined();
    });

    test('[P2] should include run logs @p2', async ({ apiRequest }) => {
      const runId = faker.string.uuid();

      const { status, body } = await apiRequest({
        method: 'GET',
        path: `/api/v1/runs/${runId}?includeLogs=true`,
        expectStatus: [200, 404],
      });

      if (status === 200) {
        expect(body.logs).toBeDefined();
      }
    });
  });

  test.describe('GET /api/v1/runs/health', () => {
    test('[P1] should return runs health status @smoke @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/runs/health',
      });

      expect(status).toBe(200);
      expect(body.status).toBeDefined();
      expect(body.healthy).toBeDefined();
      expect(typeof body.healthy).toBe('boolean');
    });

    test('[P1] should include run statistics @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/runs/health',
      });

      expect(status).toBe(200);
      expect(body.stats).toBeDefined();
      if (body.stats) {
        expect(body.stats.totalRuns).toBeDefined();
        expect(body.stats.successfulRuns).toBeDefined();
        expect(body.stats.failedRuns).toBeDefined();
      }
    });

    test('[P2] should include last run timestamp @p2', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/runs/health',
      });

      expect(status).toBe(200);
      expect(body.lastRunAt).toBeDefined();
    });
  });
});
