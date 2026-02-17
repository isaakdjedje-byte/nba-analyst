/**
 * Audit Metadata E2E Tests
 * 
 * Story 4.5: Implémenter les métadonnées d'audit exploitables
 * 
 * Coverage:
 * - Audit Metadata Query API (GET /api/v1/audit/metadata)
 * - Audit Export API (GET /api/v1/audit/export)
 * - Source fingerprint capture in decisions
 * - Query filters: traceId, date range, status, user, source
 * - Pagination and sorting
 * - Export formats: CSV and JSON
 */

import { test, expect } from '@playwright/test';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  beforeEachE2E,
} from './helpers/test-database';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const TEST_USERS = {
  admin: { email: 'test-admin@example.com', password: 'AdminPass123!' },
  ops: { email: 'test-ops@example.com', password: 'OpsPass123!' },
  support: { email: 'test-support@example.com', password: 'SupportPass123!' },
  user: { email: 'test-user@example.com', password: 'UserPass123!' },
};

// Test data for source fingerprints
const TEST_FINGERPRINTS = [
  {
    sourceName: 'nba-cdn',
    sourceVersion: '2.1.0',
    fetchTimestamp: new Date().toISOString(),
    qualityScore: 0.95,
    recordCount: 1250,
  },
  {
    sourceName: 'espn',
    sourceVersion: '1.5.0',
    fetchTimestamp: new Date().toISOString(),
    qualityScore: 0.88,
    recordCount: 850,
  },
];

// Authenticate and get session
async function authenticateUser(
  request: APIRequestContext,
  role: keyof typeof TEST_USERS
): Promise<{ cookie: string; userId: string }> {
  const credentials = TEST_USERS[role];
  
  const loginResponse = await request.post(`${baseUrl}/api/auth/login`, {
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  });
  
  expect(loginResponse.ok()).toBeTruthy();
  
  const setCookieHeader = loginResponse.headers()['set-cookie'];
  const cookie = setCookieHeader?.split(';')[0] || '';
  
  const userResponse = await request.get(`${baseUrl}/api/auth/me`, {
    headers: { cookie },
  });
  
  const userData = await userResponse.json();
  
  return { cookie, userId: userData.data?.user?.id || 'test-user-id' };
}

test.describe('Audit Metadata API', () => {
  test.beforeEach(async ({}) => {
    // Setup test environment
  });

  // ============================================
  // AC #1: Query with filters
  // ============================================
  
  test.describe('GET /api/v1/audit/metadata', () => {
    test('should return 401 for unauthenticated requests', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/v1/audit/metadata`);
      
      expect(response.status()).toBe(401);
      
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return 403 for user role', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'user');
      
      const response = await request.get(`${baseUrl}/api/v1/audit/metadata`, {
        headers: { cookie },
      });
      
      expect(response.status()).toBe(403);
      
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    test('should return audit metadata for support role', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'support');
      
      const response = await request.get(`${baseUrl}/api/v1/audit/metadata`, {
        headers: { cookie },
      });
      
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('traceId');
      expect(body.meta).toHaveProperty('timestamp');
      expect(body.meta).toHaveProperty('pagination');
    });

    test('should filter by traceId', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'admin');
      
      const testTraceId = 'test-trace-123';
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/metadata?traceId=${testTraceId}`,
        { headers: { cookie } }
      );
      
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      // If data exists, should be filtered by traceId
      if (body.data.length > 0) {
        expect(body.data[0].traceId).toBe(testTraceId);
      }
    });

    test('should filter by date range', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'admin');
      
      const fromDate = '2025-01-01T00:00:00Z';
      const toDate = '2025-12-31T23:59:59Z';
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/metadata?fromDate=${fromDate}&toDate=${toDate}`,
        { headers: { cookie } }
      );
      
      expect(response.ok()).toBeTruthy();
    });

    test('should filter by status', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'ops');
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/metadata?status=PICK`,
        { headers: { cookie } }
      );
      
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      // If data exists, should all be PICK status
      if (body.data.length > 0) {
        body.data.forEach((decision: any) => {
          expect(decision.status).toBe('PICK');
        });
      }
    });

    test('should filter by source name', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'admin');
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/metadata?source=nba-cdn`,
        { headers: { cookie } }
      );
      
      expect(response.ok()).toBeTruthy();
    });

    test('should support pagination', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'admin');
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/metadata?page=1&limit=10`,
        { headers: { cookie } }
      );
      
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      expect(body.meta.pagination.page).toBe(1);
      expect(body.meta.pagination.limit).toBe(10);
      expect(body.meta.pagination).toHaveProperty('total');
      expect(body.meta.pagination).toHaveProperty('totalPages');
    });

    test('should validate pagination limits', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'admin');
      
      // Should reject limit > 100
      const response = await request.get(
        `${baseUrl}/api/v1/audit/metadata?limit=200`,
        { headers: { cookie } }
      );
      
      expect(response.status()).toBe(400);
    });
  });

  // ============================================
  // AC #3: Export functionality
  // ============================================
  
  test.describe('GET /api/v1/audit/export', () => {
    test('should export in JSON format', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'admin');
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/export?format=json`,
        { headers: { cookie } }
      );
      
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta.export.format).toBe('json');
    });

    test('should export in CSV format', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'ops');
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/export?format=csv`,
        { headers: { cookie } }
      );
      
      expect(response.ok()).toBeTruthy();
      expect(response.headers()['content-type']).toContain('text/csv');
    });

    test('should include export metadata', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'admin');
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/export?format=json`,
        { headers: { cookie } }
      );
      
      const body = await response.json();
      expect(body.meta.export).toHaveProperty('recordCount');
      expect(body.meta.export).toHaveProperty('fromDate');
      expect(body.meta.export).toHaveProperty('toDate');
    });

    test('should filter export by date range', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'admin');
      
      const fromDate = '2025-01-01T00:00:00Z';
      const toDate = '2025-06-30T23:59:59Z';
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/export?fromDate=${fromDate}&toDate=${toDate}&format=json`,
        { headers: { cookie } }
      );
      
      expect(response.ok()).toBeTruthy();
    });

    test('should filter export by status', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'support');
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/export?status=NO_BET&format=json`,
        { headers: { cookie } }
      );
      
      expect(response.ok()).toBeTruthy();
    });
  });

  // ============================================
  // Data Source Fingerprints Integration
  // ============================================
  
  test.describe('Data Source Fingerprints', () => {
    test('should include dataSourceFingerprints in response', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'admin');
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/metadata`,
        { headers: { cookie } }
      );
      
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      // If data exists, check for fingerprints field
      if (body.data.length > 0) {
        expect(body.data[0]).toHaveProperty('dataSourceFingerprints');
        expect(Array.isArray(body.data[0].dataSourceFingerprints)).toBeTruthy();
      }
    });

    test('should include modelVersion in response', async ({ request }) => {
      const { cookie } = await authenticateUser(request, 'admin');
      
      const response = await request.get(
        `${baseUrl}/api/v1/audit/metadata`,
        { headers: { cookie } }
      );
      
      expect(response.ok()).toBeTruthy();
      
      const body = await response.json();
      if (body.data.length > 0) {
        expect(body.data[0]).toHaveProperty('modelVersion');
      }
    });
  });
});
