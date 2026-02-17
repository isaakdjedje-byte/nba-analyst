/**
 * GuardrailBanner E2E Tests - Story 3.7
 * ATDD Red Phase: Tests will FAIL until GuardrailBanner is implemented
 *
 * Story: 3.7 - GuardrailBanner Component
 * Epic: 3 - UX Dashboard Improvements
 *
 * Coverage:
 * - Banner displays when hard-stop is active
 * - Banner shows correct reason
 * - Banner disappears after successful reset
 * - Banner accessibility and responsive behavior
 *
 * @epic3 @story3-7 @atdd @red-phase
 */

import { test, expect } from '@playwright/test';
import { createDecision } from '../support/factories';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

test.describe('GuardrailBanner - Story 3.7 E2E Tests @e2e @epic3 @story3-7', () => {
  // ============================================
  // AC1: GuardrailBanner displays when hard-stop is active
  // ============================================

  test('[P0] [AC1] GuardrailBanner displays when hard-stop is active', async ({ page }) => {
    // Given: Navigate to dashboard
    await page.goto(`${baseUrl}/dashboard`);

    // When: Hard-stop is activated (via API or mock)
    // The banner should appear automatically
    // OR after page refresh if checking on load
    await page.reload();

    // Then: GuardrailBanner is visible
    const banner = page.getByTestId('guardrail-banner');
    await expect(banner).toBeVisible();

    // And: Banner shows hard-stop status (in French: "Bloquage actif")
    await expect(banner).toContainText('Bloquage actif');
  });

  test('[P0] [AC1] GuardrailBanner displays correct reason', async ({ page }) => {
    // Given: Navigate to dashboard with hard-stop active
    await page.goto(`${baseUrl}/dashboard`);
    await page.reload();

    // When: Banner is visible
    const banner = page.getByTestId('guardrail-banner');

    // Then: Banner displays cause and action text
    // Note: cause and action are displayed together with separator
    const causeText = page.getByText(/Cap de perte journalier atteint/);
    await expect(causeText).toBeVisible();
    const actionText = page.getByText(/Reprise recommandée/);
    await expect(actionText).toBeVisible();
  });

  test('[P1] [AC1] GuardrailBanner has correct visual styling', async ({ page }) => {
    // Given: Hard-stop is active
    await page.goto(`${baseUrl}/dashboard`);
    await page.reload();

    // When: Banner is displayed
    const banner = page.getByTestId('guardrail-banner');
    await expect(banner).toBeVisible();

    // Then: Banner has alert/warning role for accessibility
    await expect(banner).toHaveAttribute('role', 'alert');

    // And: Banner has appropriate ARIA label (in French)
    await expect(banner).toHaveAttribute('aria-label', expect.stringContaining('Bloquage actif'));
  });

  test('[P1] [AC1] GuardrailBanner is accessible', async ({ page }) => {
    // Given: Hard-stop is active
    await page.goto(`${baseUrl}/dashboard`);
    await page.reload();

    // When: Banner is visible
    const banner = page.getByTestId('guardrail-banner');
    await expect(banner).toBeVisible();

    // Then: Banner is readable by screen readers
    await expect(banner).toHaveAttribute('aria-live', 'polite');

    // And: Close button (if present) has accessible label
    const closeButton = page.getByTestId('guardrail-close');
    if (await closeButton.isVisible().catch(() => false)) {
      await expect(closeButton).toHaveAttribute('aria-label');
    }
  });

  // ============================================
  // AC2: GuardrailBanner disappears after successful reset
  // ============================================

  test('[P0] [AC2] GuardrailBanner disappears after successful reset @skip-until-api-ready', async ({ page, request }) => {
    // Given: Hard-stop is active and banner is visible
    await page.goto(`${baseUrl}/dashboard`);
    await page.reload();

    const banner = page.getByTestId('guardrail-banner');
    await expect(banner).toBeVisible();

    // When: Reset is performed via API (ops or admin role)
    const resetResponse = await request.post(`${baseUrl}/api/v1/policy/hardstop/reset`, {
      data: {
        reason: 'Test reset from ATDD',
        role: 'ops',
      },
    });
    expect(resetResponse.status()).toBe(200);

    // And: Page is refreshed
    await page.reload();

    // Then: Banner is no longer visible
    await expect(banner).not.toBeVisible();

    // And: Dashboard returns to normal state
    await expect(page.getByTestId('dashboard-content')).toBeVisible();
  });

  test('[P1] [AC2] GuardrailBanner disappears without page refresh @skip-until-polling-ready', async ({ page, request }) => {
    // Given: Hard-stop is active and banner is visible
    await page.goto(`${baseUrl}/dashboard`);
    await page.reload();

    const banner = page.getByTestId('guardrail-banner');
    await expect(banner).toBeVisible();

    // When: Reset is performed
    await request.post(`${baseUrl}/api/v1/policy/hardstop/reset`, {
      data: {
        reason: 'Test real-time update',
        role: 'ops',
      },
    });

    // Then: Banner disappears automatically (polling/WebSocket)
    await expect(banner).not.toBeVisible({ timeout: 10000 });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================

  test('[P2] GuardrailBanner does not display when hard-stop is inactive @skip-needs-mock-control', async ({ page }) => {
    // Given: Hard-stop is not active (ensure clean state)
    // This requires resetting hard-stop before test

    // When: User navigates to dashboard
    await page.goto(`${baseUrl}/dashboard`);
    await page.reload();

    // Then: Banner is not visible
    const banner = page.getByTestId('guardrail-banner');
    await expect(banner).not.toBeVisible();
  });

  test('[P2] GuardrailBanner persists across page navigation', async ({ page }) => {
    // Given: Hard-stop is active
    await page.goto(`${baseUrl}/dashboard`);
    await page.reload();

    const banner = page.getByTestId('guardrail-banner');
    await expect(banner).toBeVisible();

    // When: User navigates to another page and back
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.goto(`${baseUrl}/dashboard`);

    // Then: Banner is still visible
    await expect(banner).toBeVisible();
  });

  test('[P3] GuardrailBanner is responsive on mobile', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // When: Hard-stop is active
    await page.goto(`${baseUrl}/dashboard`);
    await page.reload();

    // Then: Banner is visible and properly sized
    const banner = page.getByTestId('guardrail-banner');
    await expect(banner).toBeVisible();

    // And: Banner fits within viewport
    const box = await banner.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });
});
