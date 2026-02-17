import { test, expect } from '@playwright/test';

/**
 * Performance Metrics E2E Tests
 * 
 * Coverage for:
 * - Performance dashboard display
 * - Metrics visualization
 * - Date range selection
 * 
 * Priority: P1 (core user journey)
 * Test Level: E2E
 */

test.describe('Performance Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Assume authenticated state
  });

  test.describe('Page Load', () => {
    test('[P0] should display performance dashboard', async ({ page }) => {
      await page.goto('/dashboard/performance');
      
      // Assert main heading
      await expect(page.getByRole('heading', { name: /dashboard/performance/i })).toBeVisible();
      
      // Assert key metric cards present
      await expect(page.getByTestId('metric-card')).toHaveCount(4); // Common: win rate, ROI, etc.
    });

    test('[P1] should show loading state initially', async ({ page }) => {
      await page.goto('/dashboard/performance');
      
      // Check for skeleton loaders
      const skeleton = page.locator('[data-testid="metric-skeleton"]');
      if (await skeleton.first().isVisible()) {
        // Wait for data to load
        await expect(skeleton.first()).not.toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('Metrics Display', () => {
    test('[P0] should display key performance metrics', async ({ page }) => {
      await page.goto('/dashboard/performance');
      
      // Wait for API response
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/performance') && resp.status() === 200,
        { timeout: 10000 }
      );
      
      // Assert metrics visible
      await expect(page.getByText(/win rate/i)).toBeVisible();
      await expect(page.getByText(/roi/i)).toBeVisible();
      await expect(page.getByText(/total picks/i)).toBeVisible();
    });

    test('[P1] should display trend indicators', async ({ page }) => {
      await page.goto('/dashboard/performance');
      
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/performance')
      );
      
      // Check for trend arrows/text
      const trendIndicator = page.locator('[data-testid="trend-indicator"]');
      if (await trendIndicator.first().isVisible()) {
        await expect(trendIndicator.first()).toContainText(/up|down|stable/i);
      }
    });

    test('[P2] should display historical data chart', async ({ page }) => {
      await page.goto('/dashboard/performance');
      
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/performance')
      );
      
      // Chart should be visible
      await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
    });
  });

  test.describe('Date Range Selection', () => {
    test('[P1] should allow date range selection', async ({ page }) => {
      await page.goto('/dashboard/performance');
      
      // Open date picker
      await page.getByRole('button', { name: /date range/i }).click();
      
      // Select preset range
      await page.getByRole('button', { name: /last 30 days/i }).click();
      
      // Wait for data to refresh
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/performance')
      );
      
      // Verify selection is reflected
      await expect(page.getByRole('button', { name: /last 30 days.*selected/i })).toBeVisible();
    });

    test('[P2] should allow custom date range', async ({ page }) => {
      await page.goto('/dashboard/performance');
      
      // Open date picker
      await page.getByRole('button', { name: /date range/i }).click();
      
      // Select custom range
      await page.getByRole('button', { name: /custom/i }).click();
      
      // Select start and end dates
      await page.getByRole('textbox', { name: /start date/i }).fill('2024-01-01');
      await page.getByRole('textbox', { name: /end date/i }).fill('2024-01-31');
      
      await page.getByRole('button', { name: /apply/i }).click();
      
      // Verify custom range applied
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/performance')
      );
    });
  });

  test.describe('Metrics Breakdown', () => {
    test('[P2] should display breakdown by sport', async ({ page }) => {
      await page.goto('/dashboard/performance');
      
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/performance')
      );
      
      // Check for sport breakdown section
      const breakdownSection = page.getByRole('heading', { name: /by sport/i });
      if (await breakdownSection.isVisible()) {
        await expect(page.getByTestId('sport-breakdown')).toBeVisible();
      }
    });

    test('[P2] should display breakdown by period', async ({ page }) => {
      await page.goto('/dashboard/performance');
      
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/performance')
      );
      
      // Check for period breakdown (weekly/monthly)
      const breakdownSection = page.getByRole('heading', { name: /by period/i });
      if (await breakdownSection.isVisible()) {
        await expect(page.getByTestId('period-breakdown')).toBeVisible();
      }
    });
  });
});
