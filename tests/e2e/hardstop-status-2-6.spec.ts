/**
 * Hard-Stop Status Display UI E2E Tests - Story 2.6
 * ATDD Red Phase: Tests will FAIL until hard-stop UI is implemented
 *
 * Story: 2.6 - Hard-Stop Tracker
 * Epic: 2 - ML Orchestration & Policy Engine
 *
 * Acceptance Criteria:
 * - AC3: Hard-stop status visible in UI with recommended action
 * - Ops admin can view status and reset from UI
 *
 * Coverage:
 * - P0: Hard-stop status is visible in UI
 * - P0: Recommended action is displayed
 * - P0: Ops admin can view current status
 * - P0: Ops admin can reset from UI
 * - P1: Status indicators (colors, icons)
 * - P1: Historical status view
 * - P2: Status notifications
 *
 * @epic2 @story2-6 @atdd @red-phase @p0 @hardstop @status
 */

import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Hard-Stop Status Display UI - Story 2.6 E2E Tests @e2e @epic2 @story2-6', () => {
  // ============================================
  // AC3: Hard-stop status visible in UI (P0)
  // ============================================

  test.skip('[P0] [AC3] Hard-stop status badge is visible on dashboard', async ({ page }) => {
    // Given: User is on dashboard
    await page.goto(`${baseUrl}/dashboard`);

    // Mock hard-stop status
    await page.route('**/api/hardstop/status', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: true,
          triggeredAt: new Date().toISOString(),
          reason: 'Daily loss limit exceeded',
          severity: 'critical',
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Dashboard loads

    // Then: Hard-stop status badge is visible
    const statusBadge = page.getByTestId('hardstop-status-badge');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toHaveText(/active|hard.?stop|arrêt/i);
  });

  test.skip('[P0] [AC3] Hard-stop status shows correct state', async ({ page }) => {
    // Given: Hard-stop is active
    await page.goto(`${baseUrl}/dashboard`);

    await page.route('**/api/hardstop/status', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: true,
          triggeredAt: '2026-02-15T10:30:00Z',
          reason: 'Daily loss limit exceeded',
          severity: 'critical',
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: User views status

    // Then: Status shows "active" or similar
    const statusBadge = page.getByTestId('hardstop-status-badge');
    await expect(statusBadge).toHaveAttribute('data-status', 'active');
    await expect(statusBadge).toHaveClass(/active|critical|danger|error/i);
  });

  test.skip('[P0] [AC3] Recommended action is displayed', async ({ page }) => {
    // Given: Hard-stop is active
    await page.goto(`${baseUrl}/dashboard`);

    await page.route('**/api/hardstop/status', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: true,
          triggeredAt: '2026-02-15T10:30:00Z',
          reason: 'Daily loss limit exceeded',
          severity: 'critical',
          recommendedAction: 'Stop all new bets and review strategy',
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: User views hard-stop panel

    // Then: Recommended action is displayed
    const actionPanel = page.getByTestId('hardstop-recommended-action');
    await expect(actionPanel).toBeVisible();
    await expect(actionPanel).toContainText(/stop|arrêter|review|réviser/i);
  });

  test.skip('[P0] [AC3] Hard-stop reason is displayed', async ({ page }) => {
    // Given: Hard-stop is active with reason
    await page.goto(`${baseUrl}/dashboard`);

    await page.route('**/api/hardstop/status', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: true,
          triggeredAt: '2026-02-15T10:30:00Z',
          reason: 'Daily loss limit exceeded',
          severity: 'critical',
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: User views status details
    const statusDetails = page.getByTestId('hardstop-status-details');
    await expect(statusDetails).toBeVisible();

    // Then: Reason is shown
    await expect(statusDetails).toContainText(/daily loss|limite de perte|exceeded|dépassé/i);
  });

  // ============================================
  // Ops Admin View Status (P0)
  // ============================================

  test.skip('[P0] [AC3] Ops admin can access hard-stop status page', async ({ page }) => {
    // Given: Ops admin is logged in
    await page.goto(`${baseUrl}/login`);
    await page.getByRole('textbox', { name: /email/i }).fill('ops@test.com');
    await page.getByRole('textbox', { name: /password/i }).fill('ops123');
    await page.getByRole('button', { name: /sign in|login|connexion/i }).click();
    await page.waitForLoadState('networkidle');

    // When: Ops admin navigates to hard-stop page
    await page.getByRole('link', { name: /admin|operations|ops/i }).click();
    await page.getByRole('link', { name: /hard.?stop|arrêt|safety/i }).click();

    // Then: Hard-stop status page is displayed
    await expect(page.getByRole('heading', { name: /hard.?stop|arrêt d'urgence/i })).toBeVisible();
    await expect(page.getByText(/status|état|current|actuel/i)).toBeVisible();
  });

  test.skip('[P0] [AC3] Status page shows current hard-stop state', async ({ page }) => {
    // Given: Ops admin is on hard-stop status page
    await page.goto(`${baseUrl}/admin/hardstop`);

    await page.route('**/api/hardstop/status**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: false,
          lastTriggered: '2026-02-14T15:00:00Z',
          lastReset: '2026-02-14T16:00:00Z',
          currentExposure: 500,
          dailyLimit: 1000,
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Page loads

    // Then: Current state is displayed
    await expect(page.getByText(/inactive|normal|opérationnel/i)).toBeVisible();
    await expect(page.getByText(/current exposure|exposition actuelle/i)).toBeVisible();
    await expect(page.getByText(/500|\$500/i)).toBeVisible();
  });

  test.skip('[P0] [AC3] Status page shows triggered timestamp', async ({ page }) => {
    // Given: Hard-stop was triggered
    await page.goto(`${baseUrl}/admin/hardstop`);

    await page.route('**/api/hardstop/status**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: true,
          triggeredAt: '2026-02-15T10:30:00Z',
          reason: 'Daily loss limit exceeded',
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Ops admin views status

    // Then: Triggered timestamp is shown
    await expect(page.getByText(/triggered|déclenché|activated/i)).toBeVisible();
    await expect(page.getByText(/2026-02-15|15 Feb|10:30/i)).toBeVisible();
  });

  // ============================================
  // Reset from UI (P0)
  // ============================================

  test.skip('[P0] [AC3] Reset button is visible when hard-stop is active', async ({ page }) => {
    // Given: Hard-stop is active
    await page.goto(`${baseUrl}/admin/hardstop`);

    await page.route('**/api/hardstop/status**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: true,
          triggeredAt: '2026-02-15T10:30:00Z',
          reason: 'Daily loss limit exceeded',
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Ops admin views status

    // Then: Reset button is visible
    const resetButton = page.getByRole('button', { name: /reset|réinitialiser|clear/i });
    await expect(resetButton).toBeVisible();
    await expect(resetButton).toBeEnabled();
  });

  test.skip('[P0] [AC3] Ops admin can reset hard-stop from UI', async ({ page }) => {
    // Given: Hard-stop is active
    await page.goto(`${baseUrl}/admin/hardstop`);

    await page.route('**/api/hardstop/status**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: true,
          triggeredAt: '2026-02-15T10:30:00Z',
          reason: 'Daily loss limit exceeded',
        }),
      });
    });

    // Intercept reset request
    let resetRequestReceived = false;
    await page.route('**/api/hardstop/reset', async (route) => {
      if (route.request().method() === 'POST') {
        resetRequestReceived = true;
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, message: 'Hard-stop reset successfully' }),
        });
      }
    });

    await page.waitForLoadState('networkidle');

    // When: Ops admin clicks reset
    const resetButton = page.getByRole('button', { name: /reset|réinitialiser/i });
    await resetButton.click();

    // Confirm reset
    const confirmButton = page.getByRole('button', { name: /confirm|yes|oui/i });
    await confirmButton.click();

    // Then: Reset is processed
    await expect(page.getByText(/reset|réinitialisé|success/i)).toBeVisible();
    expect(resetRequestReceived).toBe(true);
  });

  test.skip('[P0] [AC3] Reset requires confirmation', async ({ page }) => {
    // Given: Hard-stop is active
    await page.goto(`${baseUrl}/admin/hardstop`);

    await page.route('**/api/hardstop/status**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: true,
          triggeredAt: '2026-02-15T10:30:00Z',
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Ops admin clicks reset
    const resetButton = page.getByRole('button', { name: /reset|réinitialiser/i });
    await resetButton.click();

    // Then: Confirmation dialog appears
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(/confirm|confirmer|sure|certain/i);
  });

  // ============================================
  // Status Indicators (P1)
  // ============================================

  test.skip('[P1] [AC3] Active hard-stop shows red/critical indicator', async ({ page }) => {
    // Given: Hard-stop is active
    await page.goto(`${baseUrl}/dashboard`);

    await page.route('**/api/hardstop/status', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: true,
          severity: 'critical',
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Status is displayed

    // Then: Red/critical styling is applied
    const statusBadge = page.getByTestId('hardstop-status-badge');
    await expect(statusBadge).toHaveClass(/red|critical|danger|error|bg-red/i);
  });

  test.skip('[P1] [AC3] Inactive hard-stop shows green/normal indicator', async ({ page }) => {
    // Given: Hard-stop is inactive
    await page.goto(`${baseUrl}/dashboard`);

    await page.route('**/api/hardstop/status', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: false,
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Status is displayed

    // Then: Green/normal styling is applied
    const statusBadge = page.getByTestId('hardstop-status-badge');
    await expect(statusBadge).toHaveClass(/green|success|normal|bg-green/i);
  });

  test.skip('[P1] [AC3] Status includes appropriate icon', async ({ page }) => {
    // Given: Hard-stop is active
    await page.goto(`${baseUrl}/dashboard`);

    await page.route('**/api/hardstop/status', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: true,
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Status is displayed

    // Then: Warning/stop icon is present
    const statusBadge = page.getByTestId('hardstop-status-badge');
    const icon = statusBadge.locator('svg, [data-icon], .icon');
    await expect(icon).toBeVisible();
  });

  // ============================================
  // Historical Status (P1)
  // ============================================

  test.skip('[P1] [AC3] Historical hard-stop events are viewable', async ({ page }) => {
    // Given: Ops admin is on hard-stop page
    await page.goto(`${baseUrl}/admin/hardstop`);

    await page.route('**/api/hardstop/history**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          events: [
            { id: 'h1', triggeredAt: '2026-02-15T10:30:00Z', reason: 'Daily loss limit', resetAt: '2026-02-15T11:00:00Z' },
            { id: 'h2', triggeredAt: '2026-02-14T14:00:00Z', reason: 'Consecutive losses', resetAt: '2026-02-14T15:00:00Z' },
          ],
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Ops admin views history
    const historyTab = page.getByRole('tab', { name: /history|historique/i });
    await historyTab.click();

    // Then: Historical events are displayed
    const historyTable = page.getByRole('table', { name: /history|historique/i });
    await expect(historyTable).toBeVisible();
    await expect(historyTable.getByText(/2026-02-15/)).toBeVisible();
    await expect(historyTable.getByText(/2026-02-14/)).toBeVisible();
  });

  test.skip('[P1] [AC3] Statistics about hard-stop frequency are shown', async ({ page }) => {
    // Given: Ops admin is on hard-stop page
    await page.goto(`${baseUrl}/admin/hardstop`);

    await page.route('**/api/hardstop/stats**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          totalTriggers: 15,
          last30Days: 3,
          averageDuration: 45,
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Statistics are loaded

    // Then: Statistics are displayed
    await expect(page.getByText(/total triggers|total déclenchements/i)).toBeVisible();
    await expect(page.getByText(/15/)).toBeVisible();
    await expect(page.getByText(/last 30 days|30 derniers jours/i)).toBeVisible();
  });

  // ============================================
  // Notifications (P2)
  // ============================================

  test.skip('[P2] Hard-stop activation shows notification', async ({ page }) => {
    // Given: Hard-stop is triggered
    await page.goto(`${baseUrl}/dashboard`);

    await page.route('**/api/hardstop/status', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          active: true,
          triggeredAt: new Date().toISOString(),
          reason: 'Daily loss limit exceeded',
          isNew: true,
        }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Status updates

    // Then: Notification is shown
    const notification = page.getByRole('alert');
    await expect(notification).toBeVisible();
    await expect(notification).toContainText(/hard.?stop|arrêt|activated|déclenché/i);
  });

  test.skip('[P2] Reset confirmation shows success notification', async ({ page }) => {
    // Given: Ops admin resets hard-stop
    await page.goto(`${baseUrl}/admin/hardstop`);

    await page.route('**/api/hardstop/status**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ active: true }),
      });
    });

    await page.route('**/api/hardstop/reset', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    await page.waitForLoadState('networkidle');

    // When: Reset is completed
    await page.getByRole('button', { name: /reset/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    // Then: Success notification is shown
    await expect(page.getByRole('alert')).toContainText(/success|réussi|réinitialisé|reset/i);
  });
});

/**
 * Test execution commands:
 *
 * Run hard-stop status tests:
 *   npx playwright test tests/e2e/hardstop-status-2-6.spec.ts
 *
 * Run P0 tests only:
 *   npx playwright test tests/e2e/hardstop-status-2-6.spec.ts --grep @p0
 *
 * Run with specific project:
 *   npx playwright test tests/e2e/hardstop-status-2-6.spec.ts --project="chromium"
 */
