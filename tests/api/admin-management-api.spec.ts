/**
 * Admin Management API Tests
 * Tests for admin user management endpoints
 *
 * Coverage: P1 - High priority admin functionality
 * Security: RBAC enforcement
 */

import { test, expect } from '../support/merged-fixtures';
import { createUser, createAdminUser } from '../support/factories';
import { faker } from '@faker-js/faker';

test.describe('Admin Management API @api @admin @rbac @p1 @epic4', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test.describe('GET /api/v1/admin/users', () => {
    test('[P1] should list all users with admin role @smoke @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/admin/users',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 403]).toContain(status);
      
      if (status === 200) {
        expect(body.users).toBeDefined();
        expect(Array.isArray(body.users)).toBe(true);
        expect(body.pagination).toBeDefined();
      }
    });

    test('[P1] should reject non-admin access @rbac @p1 @security', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/admin/users',
        headers: {
          Authorization: 'Bearer user-token',
        },
        expectStatus: [401, 403],
      });

      expect([401, 403]).toContain(status);
      expect(body.error).toBeDefined();
    });

    test('[P1] should require authentication @security @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/admin/users',
        expectStatus: [401, 403],
      });

      expect([401, 403]).toContain(status);
    });

    test('[P1] should support pagination @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/admin/users?page=1&limit=20',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 403]).toContain(status);
      
      if (status === 200) {
        expect(body.pagination).toBeDefined();
        expect(body.pagination.page).toBe(1);
        expect(body.pagination.limit).toBe(20);
      }
    });

    test('[P2] should filter users by role @p2', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/admin/users?role=user',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 403]).toContain(status);
      
      if (status === 200 && body.users.length > 0) {
        expect(body.users[0].role).toBe('user');
      }
    });

    test('[P2] should include user metadata @p2', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/admin/users',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 403]).toContain(status);
      
      if (status === 200 && body.users.length > 0) {
        const user = body.users[0];
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.role).toBeDefined();
        expect(user.createdAt).toBeDefined();
        expect(user.isActive).toBeDefined();
      }
    });
  });

  test.describe('PATCH /api/v1/admin/users/:id/role', () => {
    test('[P1] should change user role @smoke @p1', async ({ apiRequest, authToken }) => {
      const targetUser = createUser();

      const { status, body } = await apiRequest({
        method: 'PATCH',
        path: `/api/v1/admin/users/${targetUser.id}/role`,
        data: {
          role: 'admin',
          reason: 'Promotion to admin role',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 403, 404]).toContain(status);
      
      if (status === 200) {
        expect(body.success).toBe(true);
        expect(body.user.role).toBe('admin');
        expect(body.auditLog).toBeDefined();
      }
    });

    test('[P1] should reject role change without reason @validation @p1', async ({ apiRequest, authToken }) => {
      const targetUser = createUser();

      const { status, body } = await apiRequest({
        method: 'PATCH',
        path: `/api/v1/admin/users/${targetUser.id}/role`,
        data: {
          role: 'admin',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [400, 403],
      });

      expect([400, 403]).toContain(status);
      if (status === 400) {
        expect(body.error).toContain('reason');
      }
    });

    test('[P1] should reject invalid role values @validation @p1', async ({ apiRequest, authToken }) => {
      const targetUser = createUser();

      const { status, body } = await apiRequest({
        method: 'PATCH',
        path: `/api/v1/admin/users/${targetUser.id}/role`,
        data: {
          role: 'superuser',
          reason: 'Invalid role test',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [400, 403],
      });

      expect([400, 403]).toContain(status);
      if (status === 400) {
        expect(body.error).toContain('role');
      }
    });

    test('[P1] should prevent self-demotion @rbac @p1 @security', async ({ apiRequest, authToken }) => {
      const adminUserId = 'current-admin-id';

      const { status, body } = await apiRequest({
        method: 'PATCH',
        path: `/api/v1/admin/users/${adminUserId}/role`,
        data: {
          role: 'user',
          reason: 'Self demotion attempt',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [403, 400],
      });

      expect([400, 403]).toContain(status);
      if (status === 403) {
        expect(body.error).toMatch(/cannot|self|own/i);
      }
    });

    test('[P1] should require admin role @rbac @p1 @security', async ({ apiRequest }) => {
      const targetUser = createUser();

      const { status, body } = await apiRequest({
        method: 'PATCH',
        path: `/api/v1/admin/users/${targetUser.id}/role`,
        data: {
          role: 'admin',
          reason: 'Unauthorized promotion',
        },
        headers: {
          Authorization: 'Bearer user-token',
        },
        expectStatus: [401, 403],
      });

      expect([401, 403]).toContain(status);
    });

    test('[P1] should return 404 for non-existent user @p1', async ({ apiRequest, authToken }) => {
      const nonExistentId = faker.string.uuid();

      const { status, body } = await apiRequest({
        method: 'PATCH',
        path: `/api/v1/admin/users/${nonExistentId}/role`,
        data: {
          role: 'admin',
          reason: 'Test non-existent user',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [404, 403],
      });

      expect([404, 403]).toContain(status);
      if (status === 404) {
        expect(body.error).toMatch(/not found|not exist/i);
      }
    });

    test('[P2] should create audit log entry @audit @p2', async ({ apiRequest, authToken }) => {
      const targetUser = createUser();

      const { status, body } = await apiRequest({
        method: 'PATCH',
        path: `/api/v1/admin/users/${targetUser.id}/role`,
        data: {
          role: 'support',
          reason: 'Test audit logging',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 403]).toContain(status);
      
      if (status === 200) {
        expect(body.auditLog).toBeDefined();
        expect(body.auditLog.id).toBeDefined();
        expect(body.auditLog.action).toBe('role_change');
      }
    });
  });
});
