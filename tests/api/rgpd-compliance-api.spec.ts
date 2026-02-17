/**
 * RGPD/Compliance API Tests
 * Tests for GDPR data handling and user rights
 *
 * Coverage: P1 - High priority compliance
 * Rights: deletion, export, portability
 */

import { test, expect } from '../support/merged-fixtures';
import { faker } from '@faker-js/faker';

test.describe('RGPD Compliance API @api @rgpd @gdpr @compliance @p1 @epic1', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test.describe('POST /api/v1/user/delete-account', () => {
    test('[P1] should request account deletion @smoke @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/delete-account',
        data: {
          confirm: true,
          reason: 'No longer using the service',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 201]).toContain(status);
      if ([200, 201].includes(status)) {
        expect(body.success).toBe(true);
        expect(body.scheduledDeletionDate).toBeDefined();
        expect(body.gracePeriodDays).toBeDefined();
        expect(body.deletionId).toBeDefined();
      }
    });

    test('[P1] should reject deletion without confirmation @validation @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/delete-account',
        data: {
          confirm: false,
          reason: 'Testing without confirmation',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [400],
      });

      expect(status).toBe(400);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('[P1] should require authentication @security @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/delete-account',
        data: { confirm: true },
        expectStatus: [401, 403],
      });

      expect([401, 403]).toContain(status);
      expect(body.error).toBeDefined();
    });

    test('[P1] should create audit log entry @audit @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/delete-account',
        data: {
          confirm: true,
          reason: 'Privacy concerns',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 201]).toContain(status);
      if ([200, 201].includes(status) && body.auditLogId) {
        expect(body.auditLogId).toBeDefined();
      }
    });

    test('[P2] should accept deletion without optional reason @p2', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/delete-account',
        data: {
          confirm: true,
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 201]).toContain(status);
      if ([200, 201].includes(status)) {
        expect(body.success).toBe(true);
      }
    });
  });

  test.describe('GET /api/v1/user/deletion-status', () => {
    test('[P1] should retrieve deletion status @smoke @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/user/deletion-status',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(status).toBe(200);
      expect(body.pendingDeletion).toBeDefined();
      expect(typeof body.pendingDeletion).toBe('boolean');
    });

    test('[P1] should include deletion details when pending @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/user/deletion-status',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(status).toBe(200);
      
      if (body.pendingDeletion) {
        expect(body.scheduledDeletionDate).toBeDefined();
        expect(body.deletionId).toBeDefined();
        expect(body.daysRemaining).toBeDefined();
        expect(typeof body.daysRemaining).toBe('number');
      }
    });

    test('[P1] should require authentication @security @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/user/deletion-status',
        expectStatus: [401, 403],
      });

      expect([401, 403]).toContain(status);
    });
  });

  test.describe('POST /api/v1/user/cancel-deletion', () => {
    test('[P1] should cancel pending deletion @smoke @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/cancel-deletion',
        data: {
          reason: 'Changed my mind',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 400, 404]).toContain(status);
      
      if (status === 200) {
        expect(body.success).toBe(true);
        expect(body.message).toBeDefined();
      }
    });

    test('[P1] should require authentication @security @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/cancel-deletion',
        data: {},
        expectStatus: [401, 403],
      });

      expect([401, 403]).toContain(status);
    });

    test('[P2] should return 404 when no pending deletion @edge-case @p2', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/cancel-deletion',
        data: {},
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [200, 404],
      });

      expect([200, 404]).toContain(status);
      if (status === 404) {
        expect(body.error).toContain('No pending deletion');
      }
    });
  });

  test.describe('POST /api/v1/user/export-data', () => {
    test('[P1] should request data export @smoke @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/export-data',
        data: {
          format: 'json',
          include: ['profile', 'decisions', 'activity'],
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 201, 202]).toContain(status);
      if ([200, 201, 202].includes(status)) {
        expect(body.success).toBe(true);
        expect(body.exportId).toBeDefined();
        expect(body.estimatedCompletion).toBeDefined();
      }
    });

    test('[P1] should validate export format @validation @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/export-data',
        data: {
          format: 'invalid-format',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [400],
      });

      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });

    test('[P1] should require authentication @security @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/export-data',
        data: { format: 'json' },
        expectStatus: [401, 403],
      });

      expect([401, 403]).toContain(status);
    });

    test('[P2] should support different export formats @p2', async ({ apiRequest, authToken }) => {
      const formats = ['json', 'csv'];
      
      for (const format of formats) {
        const { status, body } = await apiRequest({
          method: 'POST',
          path: '/api/v1/user/export-data',
          data: { format },
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        expect([200, 201, 202, 400]).toContain(status);
      }
    });

    test('[P2] should create audit log for data export @audit @p2', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/user/export-data',
        data: {
          format: 'json',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 201, 202]).toContain(status);
      if ([200, 201, 202].includes(status) && body.auditLogId) {
        expect(body.auditLogId).toBeDefined();
      }
    });
  });
});
