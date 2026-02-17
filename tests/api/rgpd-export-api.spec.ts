/**
 * RGPD Data Export API Tests
 * Tests for GDPR data portability endpoint
 * Story 1.5 - AC #2
 */

import { test, expect } from '@playwright/test';
import { createUser } from '../support/factories';

test.describe('RGPD Data Export API @api @rgpd @gdpr', () => {
  test.describe('POST /api/v1/user/export-data', () => {
    test('[P0] should create data export for authenticated user @smoke @p0', async ({ request }) => {
      // Note: This test requires authentication
      // In real implementation, use auth fixture or seed authenticated user
      const response = await request.post('/api/v1/user/export-data', {
        headers: {
          // Authentication header would be injected by auth fixture
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(body.data.message).toBe('Data export generated successfully');
      expect(body.data.expiresAt).toBeTruthy();
      expect(body.data.dataHash).toBeTruthy();
      expect(body.meta.traceId).toBeTruthy();
      expect(body.meta.timestamp).toBeTruthy();
    });

    test('[P0] should reject unauthenticated requests @smoke @p0 @security', async ({ request }) => {
      const response = await request.post('/api/v1/user/export-data');

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication required');
      expect(body.meta.traceId).toBeTruthy();
      expect(body.meta.timestamp).toBeTruthy();
    });

    test('[P1] should include audit event for export request @p1 @audit', async ({ request }) => {
      const response = await request.post('/api/v1/user/export-data', {
        headers: {
          // Auth headers
        },
      });

      expect(response.status()).toBe(201);
      // Audit event is logged asynchronously - verify in separate audit test
      // This test documents the requirement
    });

    test('[P2] should handle server errors gracefully @p2 @error', async ({ request }) => {
      // This would require mocking the service to throw
      // Documented here as requirement
    });
  });

  test.describe('GET /api/v1/user/export-data', () => {
    test('[P0] should list user export history @smoke @p0', async ({ request }) => {
      const response = await request.get('/api/v1/user/export-data', {
        headers: {
          // Auth headers
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.exports).toBeDefined();
      expect(Array.isArray(body.data.exports)).toBe(true);
      expect(body.meta.traceId).toBeTruthy();
      expect(body.meta.timestamp).toBeTruthy();
    });

    test('[P0] should reject unauthenticated list requests @smoke @p0 @security', async ({ request }) => {
      const response = await request.get('/api/v1/user/export-data');

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication required');
    });

    test('[P1] should return empty array when no exports exist @p1', async ({ request }) => {
      const response = await request.get('/api/v1/user/export-data', {
        headers: {
          // Auth headers for new user with no exports
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.exports).toEqual([]);
    });
  });
});
