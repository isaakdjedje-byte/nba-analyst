/**
 * E2E Tests for Policy Configuration
 * Story 5.2: Interface admin de gestion des paramètres policy
 */

import { test, expect } from '@playwright/test';

test.describe('Policy Configuration', () => {
  const policyConfigUrl = '/dashboard/policy-config';

  test.describe('Access Control', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      await page.goto(policyConfigUrl);
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('UI Components with Mock Auth', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authentication for UI component tests
      await page.addInitScript(() => {
        window.localStorage.setItem('mock-auth', 'true');
        window.localStorage.setItem('mock-user-role', 'admin');
      });
    });

    test('should display policy parameters grouped by category', async ({ page }) => {
      // Mock the API response
      await page.route('/api/v1/policy/config', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              config: {
                confidence: { minThreshold: 0.65 },
                edge: { minThreshold: 0.05 },
                drift: { maxDriftScore: 0.15 },
                hardStops: {
                  dailyLossLimit: 500,
                  consecutiveLosses: 5,
                  bankrollPercent: 0.1,
                },
              },
              defaults: {
                confidence: { minThreshold: 0.65 },
                edge: { minThreshold: 0.05 },
                drift: { maxDriftScore: 0.15 },
                hardStops: {
                  dailyLossLimit: 500,
                  consecutiveLosses: 5,
                  bankrollPercent: 0.1,
                },
              },
            },
            meta: {
              traceId: 'test-trace-id',
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });

      // Navigate to the page with mock auth
      await page.goto(policyConfigUrl);

      // Verify the page loads with correct title
      await expect(page.getByRole('heading', { name: /Configuration des Policies/i })).toBeVisible();

      // Verify category sections are present
      await expect(page.getByText(/Seuil de valeur/i)).toBeVisible();
      await expect(page.getByText(/Confiance/i)).toBeVisible();
      await expect(page.getByText(/Limite de sécurité/i)).toBeVisible();
    });

    test('should validate input values in real-time', async ({ page }) => {
      // Mock the API response
      await page.route('/api/v1/policy/config', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              config: {
                confidence: { minThreshold: 0.65 },
                edge: { minThreshold: 0.05 },
                drift: { maxDriftScore: 0.15 },
                hardStops: {
                  dailyLossLimit: 500,
                  consecutiveLosses: 5,
                  bankrollPercent: 0.1,
                },
              },
              defaults: {
                confidence: { minThreshold: 0.65 },
                edge: { minThreshold: 0.05 },
                drift: { maxDriftScore: 0.15 },
                hardStops: {
                  dailyLossLimit: 500,
                  consecutiveLosses: 5,
                  bankrollPercent: 0.1,
                },
              },
            },
            meta: {
              traceId: 'test-trace-id',
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });

      await page.goto(policyConfigUrl);

      // Find the confidence input and try to enter invalid value
      const confidenceInput = page.locator('input[id*="confidence"]').first();
      await expect(confidenceInput).toBeVisible();

      // Input value above max should trigger validation
      await confidenceInput.fill('150');
      await confidenceInput.blur();

      // Should show validation error
      await expect(page.getByText(/La valeur maximum est 1/)).toBeVisible();
    });

    test('should show read-only notice for non-admin users', async ({ page }) => {
      // Set mock user role to ops (can view but not modify)
      await page.addInitScript(() => {
        window.localStorage.setItem('mock-user-role', 'ops');
      });

      // Mock the API response
      await page.route('/api/v1/policy/config', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              config: {
                confidence: { minThreshold: 0.65 },
                edge: { minThreshold: 0.05 },
                drift: { maxDriftScore: 0.15 },
                hardStops: {
                  dailyLossLimit: 500,
                  consecutiveLosses: 5,
                  bankrollPercent: 0.1,
                },
              },
              defaults: {
                confidence: { minThreshold: 0.65 },
                edge: { minThreshold: 0.05 },
                drift: { maxDriftScore: 0.15 },
                hardStops: {
                  dailyLossLimit: 500,
                  consecutiveLosses: 5,
                  bankrollPercent: 0.1,
                },
              },
            },
            meta: {
              traceId: 'test-trace-id',
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });

      await page.goto(policyConfigUrl);

      // Should show read-only notice for ops role
      await expect(page.getByText(/Accès en lecture seule/i)).toBeVisible();
      await expect(page.getByText(/En tant qu'ops/i)).toBeVisible();
    });
  });

  test.describe('API Endpoints', () => {
    test('GET /api/v1/policy/config should require authentication', async ({ request }) => {
      const response = await request.get('/api/v1/policy/config');
      // Should return 401 or 403 for unauthenticated requests
      expect([401, 403]).toContain(response.status());
    });

    test('GET /api/v1/policy/config/history should require authentication', async ({ request }) => {
      const response = await request.get('/api/v1/policy/config/history');
      // Should return 401 or 403 for unauthenticated requests
      expect([401, 403]).toContain(response.status());
    });
  });
});
