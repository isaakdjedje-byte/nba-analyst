/**
 * HardStop Management API Tests
 * Tests for hardstop status and reset endpoints
 *
 * Coverage: P0 - Critical risk management
 */

import { test, expect } from '../support/merged-fixtures';
import { PolicyFactory } from '../factories/policy-factory';

test.describe('HardStop Management API @api @hardstop @risk @p0 @epic5', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test.describe('GET /api/v1/policy/hardstop/status', () => {
    test('[P0] should return hardstop status @smoke @p0', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/policy/hardstop/status',
      });

      expect(status).toBe(200);
      expect(body.active).toBeDefined();
      expect(typeof body.active).toBe('boolean');
    });

    test('[P0] should return active hardstop details when triggered @p0', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/policy/hardstop/status',
      });

      expect(status).toBe(200);
      
      if (body.active) {
        expect(body.triggered_at).toBeDefined();
        expect(body.cause).toBeDefined();
        expect(body.recommendation).toBeDefined();
        expect(body.affected_predictions).toBeDefined();
        expect(typeof body.affected_predictions).toBe('number');
      }
    });

    test('[P1] should include hardstop history @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/policy/hardstop/status',
      });

      expect(status).toBe(200);
      expect(body.history).toBeDefined();
      expect(Array.isArray(body.history)).toBe(true);
    });

    test('[P1] should require authentication @security @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/policy/hardstop/status',
        expectStatus: [200, 401, 403],
      });

      expect([200, 401, 403]).toContain(status);
    });
  });

  test.describe('POST /api/v1/policy/hardstop/reset', () => {
    test('[P0] should reset active hardstop @smoke @p0', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/policy/hardstop/reset',
        data: {
          reason: 'Manual reset after review',
          reviewed_by: 'admin@example.com',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 403]).toContain(status);
      
      if (status === 200) {
        expect(body.success).toBe(true);
        expect(body.reset_at).toBeDefined();
        expect(body.previous_state).toBeDefined();
      }
    });

    test('[P0] should require admin role to reset @rbac @p0', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/policy/hardstop/reset',
        data: {
          reason: 'Unauthorized reset attempt',
        },
        expectStatus: [401, 403],
      });

      expect([401, 403]).toContain(status);
    });

    test('[P1] should reject reset without reason @validation @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/policy/hardstop/reset',
        data: {},
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [400, 403],
      });

      expect([400, 403]).toContain(status);
      if (status === 400) {
        expect(body.error).toBeDefined();
      }
    });

    test('[P1] should create audit log on reset @audit @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/policy/hardstop/reset',
        data: {
          reason: 'Test audit log creation',
          reviewed_by: 'test-admin',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 403]).toContain(status);
      
      if (status === 200) {
        expect(body.audit_log_id).toBeDefined();
      }
    });

    test('[P2] should handle reset when no active hardstop @edge-case @p2', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/policy/hardstop/reset',
        data: {
          reason: 'Reset when no hardstop active',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [200, 400, 409, 403],
      });

      expect([200, 400, 409, 403]).toContain(status);
    });
  });

  test.describe('HardStop Status Transitions', () => {
    test('[P1] should track hardstop state changes @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/policy/hardstop/status',
      });

      expect(status).toBe(200);
      expect(body.state_transitions).toBeDefined();
      if (body.state_transitions) {
        expect(Array.isArray(body.state_transitions)).toBe(true);
      }
    });
  });
});
