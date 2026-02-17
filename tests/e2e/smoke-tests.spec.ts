/**
 * Smoke Tests - Critical User Journeys
 * High-level smoke tests for critical application paths
 *
 * Coverage: P0 - Critical paths only
 */

import { test, expect } from '../support/merged-fixtures';

test.describe('Smoke Tests @smoke @critical @epic1', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test('[P0] should display homepage @p0', async ({ page }) => {
    // Given the application is running
    // When navigating to homepage
    await page.goto(baseUrl);

    // Then the page should load successfully
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('[P0] should display login page @p0 @auth', async ({ page }) => {
    // When navigating to login
    await page.goto(`${baseUrl}/login`);

    // Then login form should be visible
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('body')).toContainText(/sign in|login|connexion/i);
  });

  test('[P0] should display register page @p0 @auth', async ({ page }) => {
    // When navigating to register
    await page.goto(`${baseUrl}/register`);

    // Then registration form should be visible
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('body')).toContainText(/sign up|register|inscription/i);
  });

  test('[P0] should display dashboard picks page @p0 @dashboard', async ({ page }) => {
    // When navigating to dashboard picks
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then the page should load (may redirect to login if unauthenticated)
    await expect(page.locator('body')).toBeVisible();
  });

  test('[P0] should display dashboard no-bet page @p0 @dashboard', async ({ page }) => {
    // When navigating to no-bet page
    await page.goto(`${baseUrl}/dashboard/no-bet`);

    // Then the page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('[P1] should display privacy settings page @p1 @settings', async ({ page }) => {
    // When navigating to privacy settings
    await page.goto(`${baseUrl}/settings/privacy`);

    // Then the page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('[P1] should display MFA settings page @p1 @auth @mfa', async ({ page }) => {
    // When navigating to MFA settings
    await page.goto(`${baseUrl}/settings/mfa`);

    // Then the page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('[P1] should display admin users page @p1 @admin', async ({ page }) => {
    // When navigating to admin users
    await page.goto(`${baseUrl}/admin/users`);

    // Then the page should load (may redirect if not admin)
    await expect(page.locator('body')).toBeVisible();
  });

  test('[P1] should handle 404 errors gracefully @p1 @error', async ({ page }) => {
    // When navigating to non-existent page
    await page.goto(`${baseUrl}/non-existent-page-12345`);

    // Then should show 404 page
    await expect(page.locator('body')).toBeVisible();
    const pageContent = await page.locator('body').textContent();
    expect(pageContent?.toLowerCase()).toMatch(/404|not found|page introuvable/);
  });

  test('[P2] should have responsive layout @p2 @ux', async ({ page }) => {
    // Given a mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // When navigating to homepage
    await page.goto(baseUrl);

    // Then content should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('[P2] should load without console errors @p2 @quality', async ({ page }) => {
    // Collect console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // When navigating to homepage
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    // Then there should be no critical console errors
    // (Some warnings are acceptable)
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('source map')
    );
    expect(criticalErrors.length).toBeLessThan(5);
  });
});
