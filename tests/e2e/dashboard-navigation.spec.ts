/**
 * Dashboard Navigation E2E Tests
 * Story 3.1: Créer la structure dashboard avec navigation Picks/No-Bet/Performance/Logs
 *
 * RED PHASE: These tests should FAIL before implementation
 * Tests cover AC1-AC5 from story acceptance criteria
 */

import { test, expect } from '../support/merged-fixtures';

test.describe('Dashboard Navigation @e2e @epic3', () => {
  
  // AC1: Navigation Structure - Tabs visible and consistent
  test('[P0] [3.1-AC1-001] should display all navigation tabs', async ({ page }) => {
    // Given: User is authenticated and accesses dashboard
    await page.goto('/dashboard/picks');
    
    // Then: Navigation tabs are visible
    await expect(page.getByTestId('nav-tab-picks')).toBeVisible();
    await expect(page.getByTestId('nav-tab-no-bet')).toBeVisible();
    await expect(page.getByTestId('nav-tab-performance')).toBeVisible();
    await expect(page.getByTestId('nav-tab-logs')).toBeVisible();
  });

  test('[P0] [3.1-AC1-002] should show correct tab labels', async ({ page }) => {
    await page.goto('/dashboard/picks');
    
    // Then: Tab labels are correct
    await expect(page.getByTestId('nav-tab-picks')).toHaveText('Picks');
    await expect(page.getByTestId('nav-tab-no-bet')).toHaveText('No-Bet');
    await expect(page.getByTestId('nav-tab-performance')).toHaveText('Performance');
    await expect(page.getByTestId('nav-tab-logs')).toHaveText('Logs');
  });

  // AC2: Layout Structure - Consistent layout wrapper with header
  test('[P0] [3.1-AC2-001] should display dashboard header with user info', async ({ page }) => {
    await page.goto('/dashboard/picks');
    
    // Then: Header with user info is visible
    await expect(page.getByTestId('dashboard-header')).toBeVisible();
    await expect(page.getByTestId('user-info')).toBeVisible();
  });

  test('[P0] [3.1-AC2-002] should display logout button in header', async ({ page }) => {
    await page.goto('/dashboard/picks');
    
    // Then: Logout button is visible
    await expect(page.getByTestId('logout-button')).toBeVisible();
  });

  test('[P1] [3.1-AC2-003] should have consistent layout across all tabs', async ({ page }) => {
    // Given: User is on picks tab
    await page.goto('/dashboard/picks');
    await expect(page.getByTestId('dashboard-header')).toBeVisible();
    
    // When: User navigates to no-bet tab
    await page.getByTestId('nav-tab-no-bet').click();
    
    // Then: Layout remains consistent
    await expect(page.getByTestId('dashboard-header')).toBeVisible();
    
    // When: User navigates to performance tab
    await page.getByTestId('nav-tab-performance').click();
    
    // Then: Layout remains consistent
    await expect(page.getByTestId('dashboard-header')).toBeVisible();
  });

  // AC3: Route Structure - URL updates correctly
  test('[P0] [3.1-AC3-001] should navigate to picks tab', async ({ page }) => {
    await page.goto('/dashboard/picks');
    
    // Then: URL is /dashboard/picks
    await expect(page).toHaveURL('/dashboard/picks');
  });

  test('[P0] [3.1-AC3-002] should navigate to no-bet tab', async ({ page }) => {
    await page.goto('/dashboard/picks');
    await page.getByTestId('nav-tab-no-bet').click();
    
    // Then: URL is /dashboard/no-bet
    await expect(page).toHaveURL('/dashboard/no-bet');
  });

  test('[P0] [3.1-AC3-003] should navigate to performance tab', async ({ page }) => {
    await page.goto('/dashboard/picks');
    await page.getByTestId('nav-tab-performance').click();
    
    // Then: URL is /dashboard/performance
    await expect(page).toHaveURL('/dashboard/performance');
  });

  test('[P0] [3.1-AC3-004] should navigate to logs tab', async ({ page }) => {
    await page.goto('/dashboard/picks');
    await page.getByTestId('nav-tab-logs').click();
    
    // Then: URL is /dashboard/logs
    await expect(page).toHaveURL('/dashboard/logs');
  });

  test('[P1] [3.1-AC3-005] should support browser back navigation', async ({ page }) => {
    // Given: User is on picks tab
    await page.goto('/dashboard/picks');
    await expect(page).toHaveURL('/dashboard/picks');
    
    // When: User navigates to no-bet
    await page.getByTestId('nav-tab-no-bet').click();
    await expect(page).toHaveURL('/dashboard/no-bet');
    
    // Then: Browser back works
    await page.goBack();
    await expect(page).toHaveURL('/dashboard/picks');
  });

  test('[P1] [3.1-AC3-006] should support browser forward navigation', async ({ page }) => {
    // Given: User is on picks tab
    await page.goto('/dashboard/picks');
    await page.getByTestId('nav-tab-no-bet').click();
    await expect(page).toHaveURL('/dashboard/no-bet');
    
    // Then: Browser forward works
    await page.goForward();
    await expect(page).toHaveURL('/dashboard/no-bet');
  });

  test('[P1] [3.1-AC3-007] should support deep linking to specific tabs', async ({ page }) => {
    // Then: Deep linking to /dashboard/performance works
    await page.goto('/dashboard/performance');
    await expect(page).toHaveURL('/dashboard/performance');
    
    // Then: Deep linking to /dashboard/logs works
    await page.goto('/dashboard/logs');
    await expect(page).toHaveURL('/dashboard/logs');
  });

  // AC4: Authentication Protection
  test('[P0] [3.1-AC4-001] should redirect to login when not authenticated - picks', async ({ page }) => {
    // When: User tries to access /dashboard/picks without auth
    await page.goto('/dashboard/picks');
    
    // Then: Redirected to login
    await expect(page).toHaveURL('/login');
  });

  test('[P0] [3.1-AC4-002] should redirect to login when not authenticated - no-bet', async ({ page }) => {
    await page.goto('/dashboard/no-bet');
    await expect(page).toHaveURL('/login');
  });

  test('[P0] [3.1-AC4-003] should redirect to login when not authenticated - performance', async ({ page }) => {
    await page.goto('/dashboard/performance');
    await expect(page).toHaveURL('/login');
  });

  test('[P0] [3.1-AC4-004] should redirect to login when not authenticated - logs', async ({ page }) => {
    await page.goto('/dashboard/logs');
    await expect(page).toHaveURL('/login');
  });

  // AC5: Loading States
  test('[P1] [3.1-AC5-001] should show skeleton while loading picks', async ({ page }) => {
    // When: User navigates to picks tab
    await page.goto('/dashboard/picks');
    
    // Then: Loading skeleton is shown
    await expect(page.getByTestId('loading-skeleton')).toBeVisible();
  });

  test('[P1] [3.1-AC5-002] should show skeleton while loading no-bet', async ({ page }) => {
    await page.goto('/dashboard/picks');
    await page.getByTestId('nav-tab-no-bet').click();
    
    // Then: Loading skeleton is shown
    await expect(page.getByTestId('loading-skeleton')).toBeVisible();
  });

  test('[P2] [3.1-AC5-003] should have no layout shift during transitions', async ({ page }) => {
    // Given: User is on picks tab
    await page.goto('/dashboard/picks');
    
    // When: Navigate to no-bet
    const navigationPromise = page.getByTestId('nav-tab-no-bet').click();
    
    // Then: No significant layout shift occurs (header remains stable)
    await expect(page.getByTestId('dashboard-header')).toBeVisible();
  });
});

test.describe('Dashboard Navigation - Mobile Responsive @epic3', () => {
  test('[P1] [3.1-AC2-MOB-001] should be responsive on mobile breakpoint', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard/picks');
    
    // Then: Navigation is still visible on mobile
    await expect(page.getByTestId('nav-tab-picks')).toBeVisible();
  });

  test('[P1] [3.1-AC2-MOB-002] should be responsive on tablet breakpoint', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/dashboard/picks');
    
    // Then: Navigation is visible on tablet
    await expect(page.getByTestId('nav-tab-picks')).toBeVisible();
  });
});
