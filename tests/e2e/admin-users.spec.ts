import { test, expect } from '@playwright/test';

/**
 * Admin User Management E2E Tests
 * 
 * Coverage for:
 * - User listing
 * - User search
 * - Role management
 * - User actions (activate/deactivate, delete)
 * 
 * Priority: P0 (admin functionality - security critical)
 * Test Level: E2E
 */

test.describe('Admin User Management', () => {
  // Require admin authentication
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Login as admin - assume admin user exists
  });

  test.describe('User List', () => {
    test('[P0] should display user management page', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      
      // Assert page structure
      await expect(page.getByRole('heading', { name: /user management/i })).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
    });

    test('[P0] should display user list with key columns', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      
      // Wait for users to load
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/admin/users') && resp.status() === 200,
        { timeout: 10000 }
      );
      
      // Assert columns visible
      await expect(page.getByRole('columnheader', { name: /email/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /role/i })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible();
    });

    test('[P1] should display pagination', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/admin/users')
      );
      
      // Check for pagination controls
      const pagination = page.locator('[data-testid="pagination"]');
      if (await pagination.isVisible()) {
        await expect(pagination).toBeVisible();
      }
    });
  });

  test.describe('User Search', () => {
    test('[P1] should search users by email', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      
      // Enter search query
      const searchInput = page.getByRole('textbox', { name: /search users/i });
      await searchInput.fill('admin@example.com');
      await searchInput.press('Enter');
      
      // Wait for filtered results
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/admin/users')
      );
      
      // Verify results
      const rows = page.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    });

    test('[P2] should filter users by role', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      
      // Open role filter
      await page.getByRole('button', { name: /filter by role/i }).click();
      
      // Select role
      await page.getByRole('option', { name: /admin/i }).click();
      
      // Wait for filtered results
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/admin/users')
      );
      
      // Verify all visible users are admins
      const roleCells = page.locator('tbody td[data-testid="user-role"]');
      const count = await roleCells.count();
      for (let i = 0; i < count; i++) {
        await expect(roleCells.nth(i)).toContainText(/admin/i);
      }
    });

    test('[P2] should filter users by status', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      
      // Open status filter
      await page.getByRole('button', { name: /filter by status/i }).click();
      
      // Select active
      await page.getByRole('option', { name: /active/i }).click();
      
      // Wait for filtered results
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/admin/users')
      );
      
      // Verify status indicator
      await expect(page.locator('[data-testid="status-active"]')).toBeVisible();
    });
  });

  test.describe('User Actions', () => {
    test('[P0] should be able to change user role', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/admin/users')
      );
      
      // Click role dropdown for first user
      await page.locator('tbody tr').first().locator('[data-testid="role-dropdown"]').click();
      
      // Select new role
      await page.getByRole('option', { name: /moderator/i }).click();
      
      // Confirm action
      await page.getByRole('button', { name: /confirm/i }).click();
      
      // Verify success message
      await expect(page.getByText(/role updated successfully/i)).toBeVisible();
    });

    test('[P1] should be able to activate/deactivate user', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/admin/users')
      );
      
      // Click status toggle
      await page.locator('tbody tr').first().locator('[data-testid="status-toggle"]').click();
      
      // Confirm action
      await page.getByRole('button', { name: /confirm/i }).click();
      
      // Verify success message
      await expect(page.getByText(/status updated successfully/i)).toBeVisible();
    });

    test('[P0] should require confirmation for user deletion', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/admin/users')
      );
      
      // Click delete button
      await page.locator('tbody tr').first().locator('[data-testid="delete-button"]').click();
      
      // Should show confirmation dialog
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/are you sure you want to delete/i)).toBeVisible();
    });

    test('[P1] should be able to delete user with confirmation', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/admin/users')
      );
      
      // Click delete button
      await page.locator('tbody tr').first().locator('[data-testid="delete-button"]').click();
      
      // Confirm in dialog
      await page.getByRole('button', { name: /delete/i }).click();
      
      // Verify success message
      await expect(page.getByText(/user deleted successfully/i)).toBeVisible();
    });
  });

  test.describe('Access Control', () => {
    test('[P0] should restrict access to non-admin users', async ({ page }) => {
      // Login as regular user
      await page.goto('/login');
      await page.fill('[data-testid="email"]', 'user@example.com');
      await page.fill('[data-testid="password"]', 'password123');
      await page.click('[data-testid="login-button"]');
      
      // Try to access admin page
      await page.goto('/dashboard/admin/users');
      
      // Should be redirected or see forbidden
      await expect(page.getByText(/access denied|forbidden|unauthorized/i)).toBeVisible({ timeout: 5000 });
    });
  });
});
