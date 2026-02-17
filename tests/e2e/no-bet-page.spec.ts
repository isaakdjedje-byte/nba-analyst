import { test, expect } from '@playwright/test';

test.describe('No-Bet Page @e2e @no-bet', () => {
  test.beforeEach(async ({ page }) => {
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/') || resp.status() === 200);
    await page.goto('/dashboard/no-bet');
    await responsePromise;
  });

  test('[P0] [1.2-NB-001] should display no-bet list @smoke @p0', async ({ page }) => {
    await expect(page.getByTestId('no-bet-list')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No-Bet Recommendations' })).toBeVisible();
  });

  test('[P0] [1.2-NB-002] should show refresh button @smoke @p0', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /refresh/i });
    await expect(refreshBtn).toBeVisible();
  });

  test('[P0] [1.2-NB-003] should display hard-stop banner when present @smoke @p0', async ({ page }) => {
    // Wait for content to load using network response instead of hard wait
    await page.waitForResponse(resp => resp.status() === 200);
    
    const hardStopBanner = page.getByTestId('hard-stop-banner');
    
    // Use expect with network-based wait instead of conditional
    await expect(hardStopBanner).toBeVisible();
    await expect(page.getByTestId('hard-stop-message')).toContainText('Critical policy violation');
    await expect(page.getByTestId('publish-button')).toBeDisabled();
    await expect(page.getByTestId('publish-button')).toContainText('Blocked');
  });

  test('[P1] [1.2-NB-004] should expand/collapse learn more section @p1', async ({ page }) => {
    // Wait for network response instead of hard wait
    await page.waitForResponse(resp => resp.status() === 200);
    
    const learnMoreBtn = page.getByTestId('learn-more-btn').first();
    
    // Click to expand
    await learnMoreBtn.click();
    await expect(page.getByTestId('detailed-explanation')).toBeVisible();
    
    // Click to collapse
    await learnMoreBtn.click();
    await expect(page.getByTestId('detailed-explanation')).not.toBeVisible();
  });

  test('[P1] [1.2-NB-005] should show no-bet cards with rationale @p1', async ({ page }) => {
    // Wait for network response instead of hard wait
    await page.waitForResponse(resp => resp.status() === 200);
    
    // Check first card has rationale
    const firstCardRationale = page.getByTestId(/dashboard\/no-bet-rationale-/).first();
    await expect(firstCardRationale).toBeVisible();
    
    // Check failed gates are displayed
    await expect(page.getByTestId('failed-gates').first()).toBeVisible();
  });

  test('[P2] [1.2-NB-006] should display hard-stop decision details @p2', async ({ page }) => {
    // Wait for network response instead of hard wait
    await page.waitForResponse(resp => resp.status() === 200);
    
    // Look for hard-stop rationale
    const hardStopRationale = page.locator('[data-testid^="no-bet-rationale-"]').filter({ hasText: /Critical policy|violation/i }).first();
    await expect(hardStopRationale).toContainText(/Critical policy|violation/);
  });

  test('[P2] [1.2-NB-007] should show empty state when no no-bet decisions @p2', async ({ page }) => {
    // Wait for network response instead of hard wait
    await page.waitForResponse(resp => resp.status() === 200);
    
    const emptyState = page.getByTestId('no-bet-empty');
    const noBetCards = page.getByTestId('no-bet-card');
    
    // Either empty state is visible OR no-bet cards are visible
    await expect(emptyState.or(noBetCards.first())).toBeVisible();
  });
});
