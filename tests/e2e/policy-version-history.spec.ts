/**
 * Policy Version History E2E Tests - Story 5.3
 * ATDD Red Phase: Tests will FAIL until version history UI is implemented
 *
 * Story: 5.3 - Policy Versioning & History
 * Epic: 5 - Policy Governance
 *
 * Acceptance Criteria:
 * - AC1: Policy changes are logged with timestamp, user, old/new value, reason
 * - AC2: History is viewable and exportable
 * - AC3: Admin can restore previous configuration with audit logging
 * - AC4: Hard-stop enforcement cannot be bypassed
 *
 * Coverage:
 * - P0: Version history panel displays
 * - P0: Admin can view version timeline
 * - P0: Admin can restore a previous version
 * - P1: Restore is rejected if hard-stops would be weakened
 * - P1: Export functionality works
 * - P2: Version diff is displayed
 *
 * @epic5 @story5-3 @atdd @red-phase @p0 @policy @versioning
 */

import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Policy Version History UI - Story 5.3 E2E Tests @e2e @epic5 @story5-3', () => {
  
  // ============================================
  // AC2: History is viewable and exportable (P0)
  // ============================================

  test.skip('[P0] [AC2] Version history panel displays on policy config page', async ({ page }) => {
    // Given: Admin is on policy configuration page
    await page.goto(`${baseUrl}/admin/policy-config`);
    await page.waitForLoadState('networkidle');

    // Then: Version history toggle button is visible
    const historyButton = page.getByRole('button', { name: /historique|history|voir l'historique/i });
    await expect(historyButton).toBeVisible();
  });

  test.skip('[P0] [AC2] Clicking history button shows version timeline', async ({ page }) => {
    // Given: Admin is on policy configuration page
    await page.goto(`${baseUrl}/admin/policy-config`);
    await page.waitForLoadState('networkidle');

    // Mock API response for version history
    await page.route('**/api/v1/policy/config/history**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          data: {
            versions: [
              {
                id: 'version-3',
                version: 3,
                createdAt: '2026-02-16T10:00:00Z',
                createdBy: 'admin@test.com',
                changeReason: 'Updated thresholds',
                isRestore: false,
              },
              {
                id: 'version-2',
                version: 2,
                createdAt: '2026-02-15T10:00:00Z',
                createdBy: 'admin@test.com',
                changeReason: 'Restored from version 1',
                isRestore: true,
                previousVersionId: 'version-1',
              },
              {
                id: 'version-1',
                version: 1,
                createdAt: '2026-02-14T10:00:00Z',
                createdBy: 'admin@test.com',
                changeReason: 'Initial configuration',
                isRestore: false,
              },
            ],
            total: 3,
            pagination: { limit: 20, offset: 0, hasMore: false },
          },
          meta: { traceId: 'test-trace', timestamp: '2026-02-16T10:00:00Z' },
        }),
      });
    });

    // When: Admin clicks the history button
    await page.getByRole('button', { name: /historique|history/i }).click();

    // Then: Version history panel is displayed
    await expect(page.getByRole('heading', { name: /historique des versions|version history/i })).toBeVisible();
    
    // And: Version cards are displayed
    await expect(page.getByText(/Version 3/i)).toBeVisible();
    await expect(page.getByText(/Version 2/i)).toBeVisible();
    await expect(page.getByText(/Version 1/i)).toBeVisible();
  });

  test.skip('[P0] [AC2] Export button downloads version history', async ({ page }) => {
    // Given: Admin is on policy configuration page with version history visible
    await page.goto(`${baseUrl}/admin/policy-config`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /historique|history/i }).click();

    // When: Admin clicks export button
    const exportPromise = page.waitForResponse('**/api/v1/policy/config/history/export**');
    await page.getByRole('link', { name: /exporter|export/i }).click();
    const response = await exportPromise;

    // Then: Export request succeeds
    expect(response.status()).toBe(200);
  });

  // ============================================
  // AC3: Restore previous configuration (P0)
  // ============================================

  test.skip('[P0] [AC3] Admin can expand a version to see details', async ({ page }) => {
    // Given: Admin is on policy configuration page with version history visible
    await page.goto(`${baseUrl}/admin/policy-config`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /historique|history/i }).click();

    // Mock version details API
    await page.route('**/api/v1/policy/config/history**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          data: {
            versions: [
              {
                id: 'version-2',
                version: 2,
                createdAt: '2026-02-16T10:00:00Z',
                createdBy: 'admin@test.com',
                changeReason: 'Updated thresholds',
                isRestore: false,
                config: {
                  confidence: { minThreshold: 0.7 },
                  edge: { minThreshold: 0.05 },
                  drift: { maxDriftScore: 0.15 },
                  hardStops: { dailyLossLimit: 1000, consecutiveLosses: 5, bankrollPercent: 0.1 },
                },
              },
            ],
            total: 1,
            pagination: { limit: 20, offset: 0, hasMore: false },
          },
          meta: { traceId: 'test-trace', timestamp: '2026-02-16T10:00:00Z' },
        }),
      });
    });

    // When: Admin clicks on a version card to expand
    await page.getByText(/Version 2/i).click();

    // Then: Version details are displayed
    await expect(page.getByText(/Configuration/i)).toBeVisible();
    await expect(page.getByText(/Confiance/i)).toBeVisible();
  });

  test.skip('[P0] [AC3] Admin can restore a previous version', async ({ page }) => {
    // Given: Admin is on policy configuration page with version history visible
    await page.goto(`${baseUrl}/admin/policy-config`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /historique|history/i }).click();

    // Mock version history
    await page.route('**/api/v1/policy/config/history**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          data: {
            versions: [
              {
                id: 'version-2',
                version: 2,
                createdAt: '2026-02-16T10:00:00Z',
                createdBy: 'admin@test.com',
                changeReason: 'Current version',
                isRestore: false,
                config: {
                  confidence: { minThreshold: 0.7 },
                  edge: { minThreshold: 0.05 },
                  drift: { maxDriftScore: 0.15 },
                  hardStops: { dailyLossLimit: 1000, consecutiveLosses: 5, bankrollPercent: 0.1 },
                },
              },
              {
                id: 'version-1',
                version: 1,
                createdAt: '2026-02-14T10:00:00Z',
                createdBy: 'admin@test.com',
                changeReason: 'Previous version',
                isRestore: false,
                config: {
                  confidence: { minThreshold: 0.65 },
                  edge: { minThreshold: 0.05 },
                  drift: { maxDriftScore: 0.12 },
                  hardStops: { dailyLossLimit: 500, consecutiveLosses: 3, bankrollPercent: 0.05 },
                },
              },
            ],
            total: 2,
            pagination: { limit: 20, offset: 0, hasMore: false },
          },
          meta: { traceId: 'test-trace', timestamp: '2026-02-16T10:00:00Z' },
        }),
      });
    });

    // When: Admin clicks restore on version 1
    await page.getByRole('button', { name: /restaurer|restore/i }).click();

    // Then: Confirmation dialog appears
    await expect(page.getByText(/Confirmer la restauration|confirm restore/i)).toBeVisible();
    
    // And: Diff is shown
    await expect(page.getByText(/Modifications|changes/i)).toBeVisible();

    // When: Admin confirms restore
    await page.route('**/api/v1/policy/config/restore/**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          data: {
            message: 'Successfully restored to version 1',
            restoredVersion: {
              id: 'version-3',
              version: 3,
              createdAt: '2026-02-16T11:00:00Z',
              createdBy: 'admin@test.com',
              isRestore: true,
              previousVersionId: 'version-1',
            },
          },
          meta: { traceId: 'test-trace', timestamp: '2026-02-16T11:00:00Z' },
        }),
      });
    });
    await page.getByRole('button', { name: /confirmer|confirm/i }).click();

    // Then: Restore succeeds
    await expect(page.getByText(/Successfully restored|Restauration réussie/i)).toBeVisible();
  });

  // ============================================
  // AC4: Hard-stop protection (P1)
  // ============================================

  test.skip('[P1] [AC4] Restore is rejected if it weakens hard-stops', async ({ page }) => {
    // Given: Admin is on policy configuration page with version history visible
    await page.goto(`${baseUrl}/admin/policy-config`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /historique|history/i }).click();

    // Mock version history with weaker hard-stops
    await page.route('**/api/v1/policy/config/history**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          data: {
            versions: [
              {
                id: 'version-2',
                version: 2,
                createdAt: '2026-02-16T10:00:00Z',
                createdBy: 'admin@test.com',
                changeReason: 'Current',
                isRestore: false,
                config: {
                  confidence: { minThreshold: 0.7 },
                  edge: { minThreshold: 0.05 },
                  drift: { maxDriftScore: 0.15 },
                  hardStops: { dailyLossLimit: 1000, consecutiveLosses: 5, bankrollPercent: 0.1 },
                },
              },
              {
                id: 'version-1',
                version: 1,
                createdAt: '2026-02-14T10:00:00Z',
                createdBy: 'admin@test.com',
                changeReason: 'Weaker hard-stops',
                isRestore: false,
                config: {
                  confidence: { minThreshold: 0.6 },
                  edge: { minThreshold: 0.03 },
                  drift: { maxDriftScore: 0.1 },
                  hardStops: { dailyLossLimit: 2000, consecutiveLosses: 10, bankrollPercent: 0.25 }, // WEAKER!
                },
              },
            ],
            total: 2,
            pagination: { limit: 20, offset: 0, hasMore: false },
          },
          meta: { traceId: 'test-trace', timestamp: '2026-02-16T10:00:00Z' },
        }),
      });
    });

    // When: Admin clicks restore on version 1 (weaker hard-stops)
    await page.getByRole('button', { name: /restaurer|restore/i }).click();

    // Then: Confirmation dialog appears
    await expect(page.getByText(/Confirmer la restauration/i)).toBeVisible();

    // When: Admin confirms restore
    await page.route('**/api/v1/policy/config/restore/**', async (route) => {
      await route.fulfill({
        status: 403,
        body: JSON.stringify({
          error: {
            code: 'HARD_STOP_VIOLATION',
            message: 'Cannot restore: would weaken hard-stop protections. Violations: dailyLossLimit, consecutiveLosses, bankrollPercent',
          },
          meta: { traceId: 'test-trace', timestamp: '2026-02-16T11:00:00Z' },
        }),
      });
    });
    await page.getByRole('button', { name: /confirmer|confirm/i }).click();

    // Then: Error message is displayed
    await expect(page.getByText(/hard-stop|HARD_STOP_VIOLATION/i)).toBeVisible();
    await expect(page.getByText(/weaken|affaiblir/i)).toBeVisible();
  });

  // ============================================
  // UI/UX Quality (P2)
  // ============================================

  test.skip('[P2] Version diff is displayed when expanding a version', async ({ page }) => {
    // Given: Admin is on policy configuration page with version history visible
    await page.goto(`${baseUrl}/admin/policy-config`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /historique|history/i }).click();

    // Mock version history with multiple versions
    await page.route('**/api/v1/policy/config/history**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          data: {
            versions: [
              {
                id: 'version-2',
                version: 2,
                createdAt: '2026-02-16T10:00:00Z',
                createdBy: 'admin@test.com',
                changeReason: 'Updated',
                isRestore: false,
                config: {
                  confidence: { minThreshold: 0.75 },
                  edge: { minThreshold: 0.06 },
                  drift: { maxDriftScore: 0.15 },
                  hardStops: { dailyLossLimit: 1000, consecutiveLosses: 5, bankrollPercent: 0.1 },
                },
              },
              {
                id: 'version-1',
                version: 1,
                createdAt: '2026-02-14T10:00:00Z',
                createdBy: 'admin@test.com',
                changeReason: 'Initial',
                isRestore: false,
                config: {
                  confidence: { minThreshold: 0.65 },
                  edge: { minThreshold: 0.05 },
                  drift: { maxDriftScore: 0.12 },
                  hardStops: { dailyLossLimit: 500, consecutiveLosses: 3, bankrollPercent: 0.05 },
                },
              },
            ],
            total: 2,
            pagination: { limit: 20, offset: 0, hasMore: false },
          },
          meta: { traceId: 'test-trace', timestamp: '2026-02-16T10:00:00Z' },
        }),
      });
    });

    // When: Admin expands version 2
    await page.getByText(/Version 2/i).click();

    // Then: Diff between versions is displayed
    await expect(page.getByText(/65% → 75%/i)).toBeVisible(); // confidence
    await expect(page.getByText(/500€ → 1000€/i)).toBeVisible(); // daily loss
  });

  test.skip('[P2] Loading state is displayed while fetching history', async ({ page }) => {
    // Given: Admin is on policy configuration page
    await page.goto(`${baseUrl}/admin/policy-config`);
    await page.waitForLoadState('networkidle');

    // When: Admin clicks the history button with slow network
    await page.route('**/api/v1/policy/config/history**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      await route.continue();
    });
    await page.getByRole('button', { name: /historique|history/i }).click();

    // Then: Loading skeleton is displayed
    await expect(page.locator('.animate-pulse').first()).toBeVisible();
  });
});
