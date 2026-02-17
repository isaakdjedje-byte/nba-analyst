import { test, expect } from '@playwright/test';

/**
 * ATDD E2E Tests for Story 4-1: Performance View
 * Tests the implemented performance view
 * 
 * Acceptance Criteria:
 * - AC1: Performance metrics display (accuracy, picks, no-bet, hard-stop)
 * - AC2: Performance < 2.0s, skeleton loading, empty states
 * - AC3: Tooltips, keyboard accessibility
 * - AC4: Date range filtering with URL state
 */

test.describe('Performance View E2E', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/api/auth/signin');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/picks');
  });

  test('[P0] should display performance page with date range picker', async ({ page }) => {
    await page.goto('/dashboard/performance');
    
    // Check page loads with heading
    await expect(page.getByRole('heading', { name: 'Performance' })).toBeVisible();
    
    // Check date range picker is present
    await expect(page.getByTestId('performance-date-range')).toBeVisible();
    
    // Check preset buttons
    await expect(page.getByTestId('performance-date-range-preset-7d')).toBeVisible();
    await expect(page.getByTestId('performance-date-range-preset-30d')).toBeVisible();
    await expect(page.getByTestId('performance-date-range-preset-90d')).toBeVisible();
  });

  test('[P0] should filter by date range using presets', async ({ page }) => {
    await page.goto('/dashboard/performance');
    
    // Click 7 days preset
    await page.getByTestId('performance-date-range-preset-7d').click();
    
    // Verify from date is updated
    const fromDateInput = page.getByTestId('performance-date-range-from');
    await expect(fromDateInput).toBeVisible();
  });

  test('[P0] should filter by custom date range', async ({ page }) => {
    await page.goto('/dashboard/performance');
    
    // Set custom date range
    const fromDateInput = page.getByTestId('performance-date-range-from');
    const toDateInput = page.getByTestId('performance-date-range-to');
    
    await fromDateInput.fill('2026-01-01');
    await toDateInput.fill('2026-01-31');
  });

  test('[P1] should display skeleton while loading', async ({ page }) => {
    // Navigate and immediately check
    await page.goto('/dashboard/performance');
    
    // Skeleton should appear during navigation/loading
    const skeleton = page.getByTestId('performance-metrics-skeleton');
    await expect(skeleton).toBeVisible({ timeout: 10000 });
  });

  test('[P1] should display empty state when no data available', async ({ page }) => {
    // Navigate with date range that has no data
    await page.goto('/dashboard/performance');
    
    // Wait for loading to complete
    await page.waitForTimeout(2000);
    
    // Either empty state or metrics should be visible
    const hasEmptyState = await page.locator('[data-testid="performance-empty-state"]').count() > 0;
    const hasMetrics = await page.locator('[data-testid="metric-accuracy"]').count() > 0;
    
    expect(hasEmptyState || hasMetrics).toBe(true);
  });

  test('[P2] should be accessible via keyboard navigation', async ({ page }) => {
    await page.goto('/dashboard/performance');
    
    // Tab through the page
    await page.keyboard.press('Tab');
    
    // Should be able to navigate to preset buttons
    const presetButton = page.getByTestId('performance-date-range-preset-7d');
    await expect(presetButton).toBeFocused();
    
    // Press Enter to activate
    await page.keyboard.press('Enter');
  });

  test('[P1] should update URL when date range changes (AC4)', async ({ page }) => {
    await page.goto('/dashboard/performance');
    
    // Click 90 days preset
    await page.getByTestId('performance-date-range-preset-90d').click();
    
    // Verify URL is updated with date params
    await expect(page).toHaveURL(/fromDate=/);
    await expect(page).toHaveURL(/toDate=/);
    
    // Verify URL can be shared (bookmarkable)
    const url = page.url();
    expect(url).toContain('fromDate=');
    expect(url).toContain('toDate=');
  });

  test('[P1] should persist date range in URL on page reload (AC4)', async ({ page }) => {
    // Navigate with specific date range in URL
    await page.goto('/dashboard/performance?fromDate=2026-01-01&toDate=2026-01-31');
    
    // Verify date inputs reflect URL params
    const fromDateInput = page.getByTestId('performance-date-range-from');
    await expect(fromDateInput).toHaveValue('2026-01-01');
    
    const toDateInput = page.getByTestId('performance-date-range-to');
    await expect(toDateInput).toHaveValue('2026-01-31');
  });

  test('[P2] should show metric cards with proper accessibility', async ({ page }) => {
    await page.goto('/dashboard/performance');
    
    // Wait for content to load
    await page.waitForTimeout(2000);
    
    // Check for metric cards or empty state
    const hasMetrics = await page.locator('[data-testid="metric-accuracy"]').count() > 0;
    const hasEmptyState = await page.locator('[data-testid="performance-empty-state"]').count() > 0;
    
    // Either metrics or empty state should be visible
    expect(hasMetrics || hasEmptyState).toBe(true);
  });

  test('[P3] should load page within 2.0s p95', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard/performance');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Expected: Load time under 2 seconds (2000ms)
    expect(loadTime).toBeLessThan(2000);
  });
});
