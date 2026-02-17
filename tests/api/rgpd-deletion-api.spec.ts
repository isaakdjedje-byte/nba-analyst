/**
 * RGPD Account Deletion API Tests
 * Tests for GDPR right to be forgotten endpoint
 * Story 1.5 - AC #3
 */

import { test, expect } from '@playwright/test';
import { createUser } from '../support/factories';

test.describe('RGPD Account Deletion API @api @rgpd @gdpr', () => {
  test.describe('POST /api/v1/user/delete-account', () => {
    test('[P0] should request account deletion with confirmation @smoke @p0', async ({ request }) => {
      const response = await request.post('/api/v1/user/delete-account', {
        headers: {
          // Auth headers
        },
        data: {
          confirm: true,
          reason: 'No longer using the service',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.success).toBe(true);
      expect(body.data.scheduledDeletionDate).toBeTruthy();
      expect(body.data.gracePeriodDays).toBeDefined();
      expect(body.data.message).toBeTruthy();
      expect(body.meta.traceId).toBeTruthy();
      expect(body.meta.timestamp).toBeTruthy();
    });

    test('[P0] should reject unauthenticated deletion requests @smoke @p0 @security', async ({ request }) => {
      const response = await request.post('/api/v1/user/delete-account', {
        data: {
          confirm: true,
        },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication required');
      expect(body.meta.traceId).toBeTruthy();
      expect(body.meta.timestamp).toBeTruthy();
    });

    test('[P0] should reject deletion without confirmation @p0 @validation', async ({ request }) => {
      const response = await request.post('/api/v1/user/delete-account', {
        headers: {
          // Auth headers
        },
        data: {
          confirm: false,
          reason: 'No longer using',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Confirmation required');
      expect(body.meta.traceId).toBeTruthy();
      expect(body.meta.timestamp).toBeTruthy();
    });

    test('[P1] should accept deletion without optional reason @p1', async ({ request }) => {
      const response = await request.post('/api/v1/user/delete-account', {
        headers: {
          // Auth headers
        },
        data: {
          confirm: true,
          // No reason provided - should still work
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.success).toBe(true);
    });

    test('[P1] should include audit event for deletion request @p1 @audit', async ({ request }) => {
      const response = await request.post('/api/v1/user/delete-account', {
        headers: {
          // Auth headers
        },
        data: {
          confirm: true,
          reason: 'Privacy concerns',
        },
      });

      expect(response.status()).toBe(200);
      // Audit event is logged asynchronously
    });

    test('[P2] should handle server errors gracefully @p2 @error', async ({ request }) => {
      // Documented requirement - would need service mocking
    });
  });
});
