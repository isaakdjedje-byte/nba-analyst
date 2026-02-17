/**
 * Users API Tests
 * Tests for user management endpoints
 *
 * Coverage: P1 - Core functionality
 */

import { test, expect } from '../support/merged-fixtures';
import { createUser, createAdminUser } from '../support/factories';

test.describe('Users API @api @users @epic1', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test('[P1] should retrieve all users @smoke @p1', async ({ request }) => {
    // Given the users API
    // When requesting all users
    const response = await request.get(`${baseUrl}/api/users`);

    // Then the response should be successful
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.users).toBeDefined();
    expect(Array.isArray(body.users)).toBe(true);
  });

  test('[P1] should create a new user @smoke @p1', async ({ request }) => {
    // Given valid user data
    const userData = createUser({
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
    });

    // When creating a user
    const response = await request.post(`${baseUrl}/api/users`, {
      data: userData,
    });

    // Then the user should be created
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.email).toBe(userData.email);
    expect(body.name).toBe(userData.name);
    expect(body.role).toBe('user');
    expect(body.isActive).toBe(true);
    expect(body.createdAt).toBeDefined();
  });

  test('[P1] should reject user without email @validation @p1', async ({ request }) => {
    // Given user data without email
    const userData = {
      name: 'Test User',
    };

    // When creating a user
    const response = await request.post(`${baseUrl}/api/users`, {
      data: userData,
    });

    // Then the request should be rejected
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Email');
  });

  test('[P1] should reject user without name @validation @p1', async ({ request }) => {
    // Given user data without name
    const userData = {
      email: 'test@example.com',
    };

    // When creating a user
    const response = await request.post(`${baseUrl}/api/users`, {
      data: userData,
    });

    // Then the request should be rejected
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Name');
  });

  test('[P1] should reject duplicate email @validation @p1', async ({ request }) => {
    // Given a user already exists
    const email = `duplicate-${Date.now()}@example.com`;
    const userData = createUser({ email, name: 'First User' });

    // Create first user
    const firstResponse = await request.post(`${baseUrl}/api/users`, {
      data: userData,
    });
    expect(firstResponse.status()).toBe(201);

    // When creating another user with same email
    const duplicateData = createUser({ email, name: 'Second User' });
    const response = await request.post(`${baseUrl}/api/users`, {
      data: duplicateData,
    });

    // Then the request should be rejected with conflict
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toContain('Email');
    expect(body.error).toContain('exists');
  });

  test('[P1] should create user with admin role @p1', async ({ request }) => {
    // Given admin user data
    const userData = createAdminUser({
      email: `admin-${Date.now()}@example.com`,
    });

    // When creating an admin user
    const response = await request.post(`${baseUrl}/api/users`, {
      data: userData,
    });

    // Then the user should be created with admin role
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.role).toBe('admin');
  });

  test('[P2] should delete user by ID @p2', async ({ request }) => {
    // Given an existing user
    const userData = createUser({
      email: `delete-${Date.now()}@example.com`,
    });
    const createResponse = await request.post(`${baseUrl}/api/users`, {
      data: userData,
    });
    const createdUser = await createResponse.json();

    // When deleting the user
    const response = await request.delete(`${baseUrl}/api/users?id=${createdUser.id}`);

    // Then the user should be deleted
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('[P2] should return 404 when deleting non-existent user @error @p2', async ({ request }) => {
    // Given a non-existent user ID
    const nonExistentId = 'user-non-existent-123';

    // When deleting the user
    const response = await request.delete(`${baseUrl}/api/users?id=${nonExistentId}`);

    // Then should return not found
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('not found');
  });

  test('[P2] should return 404 when deleting without ID @error @p2', async ({ request }) => {
    // When deleting without providing ID
    const response = await request.delete(`${baseUrl}/api/users`);

    // Then should return not found
    expect(response.status()).toBe(404);
  });

  test('[P2] should assign default role as user @p2', async ({ request }) => {
    // Given user data without role
    const userData = {
      name: 'Test User',
      email: `default-role-${Date.now()}@example.com`,
    };

    // When creating a user
    const response = await request.post(`${baseUrl}/api/users`, {
      data: userData,
    });

    // Then role should default to 'user'
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.role).toBe('user');
  });

  test('[P3] should handle invalid request body @error @p3', async ({ request }) => {
    // Given invalid JSON
    const response = await request.post(`${baseUrl}/api/users`, {
      data: 'not valid json',
      headers: { 'Content-Type': 'application/json' },
    });

    // Then should handle error
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });
});
