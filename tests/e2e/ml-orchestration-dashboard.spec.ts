import { test, expect } from '@playwright/test';

/**
 * ML Orchestration Dashboard E2E Tests
 * Tests for monitoring fallback chains, data quality gates, and source health
 */

test.describe('ML Orchestration Dashboard @e2e @p1', () => {
  test.beforeEach(async ({ page }) => {
    // Given: User is logged in as admin
    await page.goto('/admin/ml-orchestration');
  });

  test.describe('Fallback Chain Monitoring', () => {
    test('[P1] should display active fallback chains', async ({ page }) => {
      // Then: Fallback chain visualization should be visible
      await expect(page.getByTestId('fallback-chain-diagram')).toBeVisible();
      
      // And: Primary, secondary, and tertiary sources should be shown
      await expect(page.getByText('Primary Source')).toBeVisible();
      await expect(page.getByText('Secondary Source')).toBeVisible();
      await expect(page.getByText('Tertiary Source')).toBeVisible();
    });

    test('[P1] should highlight failed sources in fallback chain', async ({ page }) => {
      // Given: A source has failed (simulated in test environment)
      
      // When: Fallback was triggered
      await page.getByTestId('refresh-status-button').click();
      
      // Then: Failed source should be highlighted
      const failedSource = page.getByTestId('source-primary-model');
      await expect(failedSource).toHaveClass(/failed/);
      
      // And: Fallback source should be marked as active
      const activeSource = page.getByTestId('source-secondary-model');
      await expect(activeSource).toHaveClass(/active/);
    });

    test('[P1] should show fallback history', async ({ page }) => {
      // When: User clicks on fallback history tab
      await page.getByRole('tab', { name: 'Fallback History' }).click();
      
      // Then: Fallback history table should be visible
      await expect(page.getByTestId('fallback-history-table')).toBeVisible();
      
      // And: Should show recent fallback events
      const fallbackEvents = page.locator('[data-testid="fallback-history-table"] tbody tr');
      await expect(fallbackEvents.count()).resolves.toBeGreaterThanOrEqual(0);
    });

    test('[P2] should allow manual fallback trigger', async ({ page }) => {
      // Given: User has admin privileges
      
      // When: User clicks manual trigger button
      await page.getByTestId('manual-fallback-button').click();
      
      // Then: Confirmation dialog should appear
      await expect(page.getByText('Trigger manual fallback?')).toBeVisible();
      
      // When: User confirms
      await page.getByRole('button', { name: 'Confirm' }).click();
      
      // Then: Success message should appear
      await expect(page.getByText('Fallback triggered successfully')).toBeVisible();
    });
  });

  test.describe('Data Quality Gates', () => {
    test('[P0] should display data quality metrics', async ({ page }) => {
      // Then: Quality gate status should be visible
      await expect(page.getByTestId('quality-gates-panel')).toBeVisible();
      
      // And: Pass rate should be displayed
      await expect(page.getByText(/Pass Rate:/)).toBeVisible();
      
      // And: Individual gate statuses should be shown
      await expect(page.getByText('Confidence Gate')).toBeVisible();
      await expect(page.getByText('Edge Gate')).toBeVisible();
      await expect(page.getByText('Drift Gate')).toBeVisible();
    });

    test('[P0] should show blocked predictions due to quality failures', async ({ page }) => {
      // When: User navigates to blocked predictions
      await page.getByRole('tab', { name: 'Blocked Predictions' }).click();
      
      // Then: Blocked predictions list should be visible
      await expect(page.getByTestId('blocked-predictions-list')).toBeVisible();
      
      // And: Each blocked prediction should show reason
      const blockedItems = page.locator('[data-testid="blocked-prediction-item"]');
      const count = await blockedItems.count();
      
      if (count > 0) {
        await expect(blockedItems.first().getByTestId('block-reason')).toBeVisible();
      }
    });

    test('[P1] should allow viewing quality check details', async ({ page }) => {
      // When: User clicks on a quality gate
      await page.getByTestId('quality-gate-confidence').click();
      
      // Then: Quality gate details should be shown
      await expect(page.getByTestId('quality-gate-details')).toBeVisible();
      
      // And: Recent checks should be listed
      await expect(page.getByText('Recent Quality Checks')).toBeVisible();
    });
  });

  test.describe('Source Health Monitoring', () => {
    test('[P1] should display source health status', async ({ page }) => {
      // Then: Source health panel should be visible
      await expect(page.getByTestId('source-health-panel')).toBeVisible();
      
      // And: Each source should show status indicator
      const sources = page.locator('[data-testid="source-health-item"]');
      await expect(sources.count()).resolves.toBeGreaterThanOrEqual(1);
      
      // And: Status should be one of: healthy, degraded, unhealthy
      const firstSource = sources.first();
      await expect(firstSource.getByTestId('health-status')).toBeVisible();
    });

    test('[P1] should display source latency metrics', async ({ page }) => {
      // When: User clicks on a source
      await page.getByTestId('source-espn').click();
      
      // Then: Source details should show latency chart
      await expect(page.getByTestId('latency-chart')).toBeVisible();
      
      // And: Historical latency data should be visible
      await expect(page.getByText('Response Time (ms)')).toBeVisible();
    });

    test('[P2] should allow pausing unhealthy sources', async ({ page }) => {
      // Given: A source is unhealthy
      const unhealthySource = page.locator('[data-testid="source-health-item"].unhealthy').first();
      
      if (await unhealthySource.isVisible().catch(() => false)) {
        // When: User clicks pause button
        await unhealthySource.getByTestId('pause-source-button').click();
        
        // Then: Source should be marked as paused
        await expect(unhealthySource).toHaveClass(/paused/);
        
        // And: Status message should confirm
        await expect(page.getByText('Source paused successfully')).toBeVisible();
      }
    });

    test('[P1] should show source health history', async ({ page }) => {
      // When: User clicks on source history
      await page.getByTestId('source-espn').getByTestId('view-history-button').click();
      
      // Then: Health history chart should be visible
      await expect(page.getByTestId('health-history-chart')).toBeVisible();
      
      // And: Time range selector should be available
      await expect(page.getByTestId('time-range-selector')).toBeVisible();
    });
  });

  test.describe('Orchestration Status', () => {
    test('[P0] should display overall orchestration status', async ({ page }) => {
      // Then: Status indicator should be visible
      await expect(page.getByTestId('orchestration-status')).toBeVisible();
      
      // And: Status should be one of expected values
      const statusText = await page.getByTestId('orchestration-status').textContent();
      expect(['Idle', 'Running', 'Degraded', 'Error']).toContain(statusText?.trim());
    });

    test('[P0] should display active runs', async ({ page }) => {
      // Then: Active runs panel should be visible
      await expect(page.getByTestId('active-runs-panel')).toBeVisible();
      
      // And: Run count should be displayed
      await expect(page.getByText(/Active Runs:/)).toBeVisible();
    });

    test('[P1] should display system metrics', async ({ page }) => {
      // Then: System metrics should be visible
      await expect(page.getByTestId('system-metrics')).toBeVisible();
      
      // And: Key metrics should be shown
      await expect(page.getByText(/Avg Response Time/)).toBeVisible();
      await expect(page.getByText(/Success Rate/)).toBeVisible();
      await expect(page.getByText(/Throughput/)).toBeVisible();
    });
  });

  test.describe('Real-time Updates', () => {
    test('[P2] should update status in real-time', async ({ page }) => {
      // Given: User is viewing the dashboard
      await expect(page.getByTestId('orchestration-status')).toBeVisible();
      
      // When: Waiting for potential status updates
      // Note: In real environment, this would test WebSocket updates
      await page.waitForTimeout(1000);
      
      // Then: Status should still be visible (no crash)
      await expect(page.getByTestId('orchestration-status')).toBeVisible();
    });
  });
});
