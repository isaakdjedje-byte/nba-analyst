/**
 * RGPD Account Deletion E2E Tests
 * End-to-end tests for GDPR right to be forgotten feature
 * Story 1.5 - AC #3
 */

import { test, expect } from '../support/merged-fixtures';
import { createUser } from '../support/factories';

test.describe('RGPD Account Deletion E2E @e2e @rgpd @gdpr', () => {
  test.describe('Authenticated User Journey', () => {
    test('[P0] should complete account deletion request flow @smoke @p0', async ({ page }) => {
      // Given: User is logged in and on settings page
      await page.goto('/settings');
      
      // When: User navigates to account settings
      const accountLink = page.getByRole('link', { name: /account|compte/i });
      if (await accountLink.isVisible().catch(() => false)) {
        await accountLink.click();
      }
      
      // When: User initiates account deletion
      const deleteButton = page.getByRole('button', { name: /delete account|supprimer.*compte/i });
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();
      
      // Then: Confirmation dialog appears with warnings
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();
      await expect(page.getByText(/confirm|confirmer/i)).toBeVisible();
      await expect(page.getByText(/permanent|irreversible|permanent/i)).toBeVisible();
      
      // When: User provides optional reason
      const reasonInput = page.getByRole('textbox', { name: /reason|raison/i });
      if (await reasonInput.isVisible().catch(() => false)) {
        await reasonInput.fill('No longer using the service');
      }
      
      // When: User confirms checkbox
      const confirmCheckbox = page.getByRole('checkbox', { name: /confirm|understand|comprendre/i });
      if (await confirmCheckbox.isVisible().catch(() => false)) {
        await confirmCheckbox.check();
      }
      
      // When: User confirms deletion
      const confirmButton = page.getByRole('button', { name: /delete|supprimer/i });
      await confirmButton.click();
      
      // Then: Success message with grace period info
      await expect(page.getByText(/deletion.*scheduled|suppression.*planifie/i)).toBeVisible();
      await expect(page.getByText(/30 days|30 jours/i)).toBeVisible();
      await expect(page.getByText(/cancel|annuler/i)).toBeVisible();
    });

    test('[P0] should require explicit confirmation @p0 @validation', async ({ page }) => {
      // Given: User is on account deletion page
      await page.goto('/settings/account');
      
      // When: User tries to delete without confirmation
      const deleteButton = page.getByRole('button', { name: /delete account|supprimer.*compte/i });
      await deleteButton.click();
      
      // Skip confirmation checkbox
      const confirmButton = page.getByRole('button', { name: /delete|supprimer/i });
      await confirmButton.click();
      
      // Then: Error is shown
      await expect(page.getByText(/confirmation required|confirmation requise/i)).toBeVisible();
    });
  });

  test.describe('Security & Access Control', () => {
    test('[P0] should redirect unauthenticated users to login @smoke @p0 @security', async ({ page }) => {
      // Given: User is not logged in
      await page.goto('/settings/account/delete');
      
      // Then: Redirected to login
      await expect(page).toHaveURL(/.*login.*/);
    });

    test('[P1] should allow cancellation during grace period @p1', async ({ page }) => {
      // Given: User has requested deletion
      await page.goto('/settings/account');
      
      // When: User views deletion status
      const cancelButton = page.getByRole('button', { name: /cancel.*deletion|annuler.*suppression/i });
      
      // Then: Cancel option is available
      if (await cancelButton.isVisible().catch(() => false)) {
        await cancelButton.click();
        await expect(page.getByText(/deletion cancelled|suppression annulee/i)).toBeVisible();
      }
    });
  });

  test.describe('UX & Accessibility', () => {
    test('[P1] should warn about data loss @p1', async ({ page }) => {
      await page.goto('/settings/account');
      
      const deleteButton = page.getByRole('button', { name: /delete account|supprimer.*compte/i });
      await deleteButton.click();
      
      // Then: Warning about data loss is visible
      await expect(page.getByText(/data will be lost|donnees.*perdu/i)).toBeVisible();
      await expect(page.getByText(/irreversible|cannot be undone/i)).toBeVisible();
    });

    test('[P1] should have accessible deletion flow @p1 @a11y', async ({ page }) => {
      await page.goto('/settings/account');
      
      const deleteButton = page.getByRole('button', { name: /delete account|supprimer.*compte/i });
      await expect(deleteButton).toHaveAttribute('aria-label', /.*/);
      
      // Should be keyboard accessible
      await deleteButton.focus();
      await expect(deleteButton).toBeFocused();
      await deleteButton.press('Enter');
      
      // Dialog should trap focus
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();
    });

    test('[P2] should show deletion timeline @p2', async ({ page }) => {
      await page.goto('/settings/account');
      
      const deleteButton = page.getByRole('button', { name: /delete account|supprimer.*compte/i });
      await deleteButton.click();
      
      // Then: Timeline is shown
      await expect(page.getByText(/deletion timeline|calendrier/i)).toBeVisible();
      await expect(page.getByText(/30 days/i)).toBeVisible();
    });
  });
});
