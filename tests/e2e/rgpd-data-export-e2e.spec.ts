/**
 * RGPD Data Export E2E Tests
 * End-to-end tests for GDPR data portability feature
 * Story 1.5 - AC #2
 */

import { test, expect } from '../support/merged-fixtures';
import { createUser } from '../support/factories';

test.describe('RGPD Data Export E2E @e2e @rgpd @gdpr', () => {
  test.describe('Authenticated User Journey', () => {
    test('[P0] should complete data export request flow @smoke @p0', async ({ page }) => {
      // Given: User is logged in and on settings page
      await page.goto('/settings');
      
      // When: User navigates to privacy settings
      // Note: Selectors should be updated based on actual UI implementation
      const privacyLink = page.getByRole('link', { name: /privacy|données/i });
      if (await privacyLink.isVisible().catch(() => false)) {
        await privacyLink.click();
      }
      
      // When: User clicks export data button
      const exportButton = page.getByRole('button', { name: /export|exporter/i });
      await expect(exportButton).toBeVisible();
      await exportButton.click();
      
      // Then: Confirmation dialog appears
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();
      
      // When: User confirms export
      const confirmButton = page.getByRole('button', { name: /confirm|confirmer/i });
      await confirmButton.click();
      
      // Then: Success message is displayed
      await expect(page.getByText(/export.*success|données.*export/i)).toBeVisible();
      await expect(page.getByText(/expires|expiration/i)).toBeVisible();
    });

    test('[P0] should display export history @smoke @p0', async ({ page }) => {
      // Given: User is logged in
      await page.goto('/settings/privacy');
      
      // Then: Export history section is visible
      const historySection = page.getByRole('region', { name: /export history|historique/i });
      await expect(historySection).toBeVisible();
      
      // And: Previous exports are listed
      const exportList = page.getByTestId('export-history-list');
      await expect(exportList.or(page.getByText(/no exports|aucun export/i))).toBeVisible();
    });
  });

  test.describe('Security & Access Control', () => {
    test('[P0] should redirect unauthenticated users to login @smoke @p0 @security', async ({ page }) => {
      // Given: User is not logged in
      // When: User tries to access export endpoint directly
      await page.goto('/settings/privacy/export');
      
      // Then: Redirected to login page
      await expect(page).toHaveURL(/.*login.*/);
      await expect(page.getByText(/sign in|connexion/i)).toBeVisible();
    });

    test('[P1] should show error for failed exports @p1 @error', async ({ page }) => {
      // Given: User is logged in
      await page.goto('/settings/privacy');
      
      // When: Export request fails (network intercept to simulate failure)
      await page.route('**/api/v1/user/export-data', async (route) => {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({
            error: { code: 'EXPORT_FAILED', message: 'Failed to generate export' },
            meta: { traceId: 'test-trace-id', timestamp: new Date().toISOString() },
          }),
        });
      });
      
      const exportButton = page.getByRole('button', { name: /export|exporter/i });
      await exportButton.click();
      
      const confirmButton = page.getByRole('button', { name: /confirm|confirmer/i });
      await confirmButton.click();
      
      // Then: Error message is displayed
      await expect(page.getByText(/failed|erreur.*export/i)).toBeVisible();
    });
  });

  test.describe('UX & Accessibility', () => {
    test('[P1] should have accessible export button @p1 @a11y', async ({ page }) => {
      await page.goto('/settings/privacy');
      
      const exportButton = page.getByRole('button', { name: /export|exporter/i });
      await expect(exportButton).toHaveAttribute('aria-label', /.*/);
      
      // Should be keyboard accessible
      await exportButton.focus();
      await expect(exportButton).toBeFocused();
    });

    test('[P2] should show loading state during export @p2', async ({ page }) => {
      await page.goto('/settings/privacy');
      
      // Simulate slow response
      await page.route('**/api/v1/user/export-data', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });
      
      const exportButton = page.getByRole('button', { name: /export|exporter/i });
      await exportButton.click();
      
      // Then: Loading state is shown
      await expect(page.getByText(/loading|chargement/i).or(
        page.getByRole('progressbar')
      )).toBeVisible();
    });
  });
});
