import { test, expect } from '@playwright/test';

/**
 * ATDD E2E Tests for Story 4-2: Logs View
 * Tests the /dashboard/logs page user journey
 * 
 * TDD RED PHASE: These tests will FAIL until the feature is implemented
 * Use test.skip() to document intentional failures
 * 
 * Acceptance Criteria:
 * - AC1: Chronological list, sortable/filterable
 * - AC2: Performance < 2.0s, skeleton loading, empty states
 * - AC3: Decision details with rationale, gate outcomes, traceId
 * - AC4: URL state for filters (bookmarking)
 * - AC5: Sorting controls with session persistence
 */

test.describe('Logs View E2E (ATDD - GREEN PHASE)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/api/auth/signin');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/picks');
  });

  test('[P0] should display logs page with heading', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Check page loads with heading
    await expect(page.getByRole('heading', { name: /historique|logs/i })).toBeVisible();
  });

  test('[P0] should display chronological list of decisions', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Check that decision list is visible
    await expect(page.getByTestId('logs-list')).toBeVisible();
    
    // Check that entries display required fields
    const firstEntry = page.locator('[data-testid="log-entry"]').first();
    await expect(firstEntry).toBeVisible();
    
    // Verify entry has: match, date, status, rationale summary
    await expect(firstEntry.locator('[data-testid="log-entry-match"]')).toBeVisible();
    await expect(firstEntry.locator('[data-testid="log-entry-date"]')).toBeVisible();
    await expect(firstEntry.locator('[data-testid="log-entry-status"]')).toBeVisible();
    await expect(firstEntry.locator('[data-testid="log-entry-rationale"]')).toBeVisible();
  });

  test('[P0] should filter logs by status using dropdown', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Select status filter
    const statusFilter = page.getByTestId('logs-status-filter');
    await expect(statusFilter).toBeVisible();
    await statusFilter.selectOption('pick');
    
    // Verify all visible entries have 'pick' status
    const entries = page.locator('[data-testid="log-entry"]');
    const count = await entries.count();
    
    for (let i = 0; i < count; i++) {
      const status = entries.nth(i).locator('[data-testid="log-entry-status"]');
      await expect(status).toHaveText('pick');
    }
  });

  test('[P0] should update URL when filters change (AC4)', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Apply status filter
    await page.getByTestId('logs-status-filter').selectOption('no-bet');
    
    // Verify URL is updated
    await expect(page).toHaveURL(/status=no-bet/);
    
    // Apply date filter
    await page.getByTestId('logs-date-from').fill('2026-01-01');
    await page.getByTestId('logs-date-to').fill('2026-01-31');
    
    // Verify URL includes date params
    await expect(page).toHaveURL(/fromDate=2026-01-01/);
    await expect(page).toHaveURL(/toDate=2026-01-31/);
  });

  test('[P0] should persist filter state in URL on reload (AC4)', async ({ page }) => {
    // Navigate with filters in URL
    await page.goto('/dashboard/logs?status=pick&fromDate=2026-01-01&toDate=2026-01-31');
    
    // Verify filters are reflected in UI
    await expect(page.getByTestId('logs-status-filter')).toHaveValue('pick');
    await expect(page.getByTestId('logs-date-from')).toHaveValue('2026-01-01');
    await expect(page.getByTestId('logs-date-to')).toHaveValue('2026-01-31');
  });

  test('[P0] should display decision details on entry click (AC3)', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Wait for entries to load
    await page.waitForSelector('[data-testid="log-entry"]');
    
    // Click on first entry
    const firstEntry = page.locator('[data-testid="log-entry"]').first();
    await firstEntry.click();
    
    // Verify details panel appears
    const detailsPanel = page.getByTestId('log-details-panel');
    await expect(detailsPanel).toBeVisible();
    
    // Verify details contain required fields
    await expect(detailsPanel.locator('[data-testid="detail-rationale"]')).toBeVisible();
    await expect(detailsPanel.locator('[data-testid="detail-gate-outcomes"]')).toBeVisible();
    await expect(detailsPanel.locator('[data-testid="detail-traceId"]')).toBeVisible();
    await expect(detailsPanel.locator('[data-testid="detail-data-signals"]')).toBeVisible();
  });

  test('[P1] should display skeleton while loading (AC2)', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Skeleton should appear during navigation/loading
    const skeleton = page.getByTestId('logs-skeleton');
    await expect(skeleton).toBeVisible({ timeout: 10000 });
    
    // Skeleton should disappear after loading
    await expect(skeleton).not.toBeVisible({ timeout: 15000 });
  });

  test('[P1] should display empty state when no logs available (AC2)', async ({ page }) => {
    // Navigate with date range that has no data
    await page.goto('/dashboard/logs?fromDate=2050-01-01&toDate=2050-12-31');
    
    // Wait for loading to complete
    await page.waitForTimeout(2000);
    
    // Empty state should be visible
    const emptyState = page.getByTestId('logs-empty-state');
    await expect(emptyState).toBeVisible();
    
    // Empty state should have helpful message
    await expect(emptyState.getByText(/no.*decision/i)).toBeVisible();
  });

  test('[P1] should sort logs by date (newest first)', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Wait for entries to load
    await page.waitForSelector('[data-testid="log-entry"]');
    
    // Click sort button to sort by newest first
    const sortButton = page.getByTestId('logs-sort-newest');
    await sortButton.click();
    
    // Verify sort preference is shown as active
    await expect(sortButton).toHaveAttribute('data-active', 'true');
    
    // Get all entry dates
    const dates = await page.locator('[data-testid="log-entry-date"]').allInnerTexts();
    
    // Verify descending order (newest first)
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      expect(curr.getTime()).toBeLessThanOrEqual(prev.getTime());
    }
  });

  test('[P1] should sort logs by date (oldest first)', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Wait for entries to load
    await page.waitForSelector('[data-testid="log-entry"]');
    
    // Click sort button to sort by oldest first
    const sortButton = page.getByTestId('logs-sort-oldest');
    await sortButton.click();
    
    // Verify sort preference is shown as active
    await expect(sortButton).toHaveAttribute('data-active', 'true');
    
    // Get all entry dates
    const dates = await page.locator('[data-testid="log-entry-date"]').allInnerTexts();
    
    // Verify ascending order (oldest first)
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
    }
  });

  test('[P1] should be accessible via keyboard navigation (AC4)', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Tab through the page
    await page.keyboard.press('Tab');
    
    // Should be able to navigate to filter controls
    const statusFilter = page.getByTestId('logs-status-filter');
    await expect(statusFilter).toBeFocused();
    
    // Should be able to navigate to sort buttons
    await page.keyboard.press('Tab');
    const sortButton = page.getByTestId('logs-sort-newest');
    await expect(sortButton).toBeFocused();
    
    // Should be able to activate with Enter
    await page.keyboard.press('Enter');
  });

  test('[P2] should persist sort preference in session (AC5)', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Change sort preference
    await page.getByTestId('logs-sort-oldest').click();
    
    // Navigate to another page
    await page.goto('/dashboard/performance');
    await page.waitForTimeout(500);
    
    // Return to logs
    await page.goto('/dashboard/logs');
    
    // Verify sort preference persisted
    const sortButton = page.getByTestId('logs-sort-oldest');
    await expect(sortButton).toHaveAttribute('data-active', 'true');
  });

  test('[P2] should display status badges with proper styling', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Wait for entries
    await page.waitForSelector('[data-testid="log-entry"]');
    
    // Verify StatusBadge component is used for each status type
    const pickBadge = page.locator('[data-testid="status-badge-pick"]').first();
    const noBetBadge = page.locator('[data-testid="status-badge-no-bet"]').first();
    const hardStopBadge = page.locator('[data-testid="status-badge-hard-stop"]').first();
    
    // At least one should be visible depending on data
    const hasAnyBadge = 
      (await pickBadge.count()) > 0 || 
      (await noBetBadge.count()) > 0 || 
      (await hardStopBadge.count()) > 0;
    
    expect(hasAnyBadge).toBe(true);
  });

  test('[P3] should load page within 2.0s p95 (AC2)', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard/logs');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Expected: Load time under 2 seconds (2000ms)
    expect(loadTime).toBeLessThan(2000);
  });

  test('[P3] should show filter count badge', async ({ page }) => {
    await page.goto('/dashboard/logs');
    
    // Apply a filter
    await page.getByTestId('logs-status-filter').selectOption('pick');
    
    // Badge should show count of active filters
    const filterBadge = page.getByTestId('active-filters-badge');
    await expect(filterBadge).toBeVisible();
    await expect(filterBadge).toHaveText('1');
  });
});
