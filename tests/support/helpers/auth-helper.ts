/**
 * Authentication Helper
 * Reusable authentication utilities for tests
 * Eliminates duplication across test files
 */

import { APIRequestContext, Page } from '@playwright/test';

export interface AuthCredentials {
  email: string;
  password: string;
}

export const defaultCredentials: AuthCredentials = {
  email: 'test@example.com',
  password: 'testpassword123',
};

/**
 * Authenticate user via API and set cookies
 * @param api - Playwright API request context
 * @param page - Playwright page
 * @param credentials - Optional custom credentials
 * @returns The authentication token
 */
export async function authenticateUser(
  api: APIRequestContext,
  page: Page,
  credentials: AuthCredentials = defaultCredentials
): Promise<string> {
  const loginResponse = await api.post('/api/auth/login', {
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  });

  if (!loginResponse.ok()) {
    throw new Error(`Authentication failed: ${loginResponse.status()}`);
  }

  const { token } = await loginResponse.json();

  await page.context().addCookies([
    {
      name: 'auth_token',
      value: token,
      domain: 'localhost',
      path: '/',
    },
  ]);

  return token;
}

/**
 * Authenticate user with API request only (no page context)
 * @param api - Playwright API request context
 * @param credentials - Optional custom credentials
 * @returns The authentication token
 */
export async function authenticateUserApi(
  api: APIRequestContext,
  credentials: AuthCredentials = defaultCredentials
): Promise<string> {
  const loginResponse = await api.post('/api/auth/login', {
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  });

  if (!loginResponse.ok()) {
    throw new Error(`Authentication failed: ${loginResponse.status()}`);
  }

  const { token } = await loginResponse.json();
  return token;
}

/**
 * Clear authentication cookies
 * @param page - Playwright page
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.context().clearCookies();
}

/**
 * Setup authenticated page with API helper
 * @param api - Playwright API request context
 * @param page - Playwright page
 * @returns Object with auth token and authenticated page
 */
export async function setupAuthenticatedUser(
  api: APIRequestContext,
  page: Page,
  credentials?: AuthCredentials
): Promise<{ token: string; page: Page }> {
  const token = await authenticateUser(api, page, credentials);
  return { token, page };
}
