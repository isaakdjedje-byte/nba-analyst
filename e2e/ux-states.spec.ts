/**
 * E2E Tests for Critical UX States
 * Story 3.9: Implementer les etats UX critiques (loading, empty, degraded, blocked)
 *
 * Tests cover:
 * - AC1: Loading states avec skeleton placeholders
 * - AC2: Empty states explicites avec actions suggerees
 * - AC3: Degraded states avec contexte explicite
 * - AC4: Blocked states avec raison et action recommandee
 * - AC5: Accessibility des etats critiques (aria-live, focus)
 * - AC6: Performance des etats de transition (300ms)
 */

import { test, expect } from '@playwright/test';

test.describe('Loading States (AC1)', () => {
  test('@p0 @a11y should display skeleton placeholders when loading picks', async ({ page }) => {
    // Intercept API call and delay it
    await page.route('**/api/v1/decisions**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Delay to keep loading state
      await route.fulfill({ json: { data: [], meta: { total: 0 } } });
    });

    await page.goto('/dashboard/picks');

    // Skeleton should be visible
    const skeleton = page.getByTestId('decision-skeleton').first();
    await expect(skeleton).toBeVisible();

    // Skeleton should have pulse animation
    await expect(skeleton).toHaveClass(/animate-pulse/);

    // Skeleton should have aria-busy
    await expect(skeleton).toHaveAttribute('aria-busy', 'true');
  });

  test('@p1 should preserve layout structure during loading', async ({ page }) => {
    await page.route('**/api/v1/decisions**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await route.fulfill({ json: { data: [], meta: { total: 0 } } });
    });

    await page.goto('/dashboard/picks');

    // Grid layout should be present
    const grid = page.locator('[role="status"].grid, [class*="grid"]').first();
    await expect(grid).toBeVisible();
  });
});

test.describe('Empty States (AC2)', () => {
  test('@p0 @a11y should display empty state when no picks available', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({ json: { data: [], meta: { total: 0 } } });
    });

    await page.goto('/dashboard/picks');

    // Empty state should be visible
    const emptyState = page.getByTestId('empty-picks-state');
    await expect(emptyState).toBeVisible();

    // Title should be present
    await expect(page.getByText('Aucun pick disponible')).toBeVisible();

    // Description should explain why
    await expect(page.getByText(/décisions du jour ne sont pas encore disponibles/)).toBeVisible();

    // Action link should be present
    const historyLink = page.getByRole('link', { name: /Voir l'historique/i });
    await expect(historyLink).toBeVisible();
    await expect(historyLink).toHaveAttribute('href', '/dashboard/logs');
  });

  test('@p1 empty state should be accessible with proper role', async ({ page }) => {
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({ json: { data: [], meta: { total: 0 } } });
    });

    await page.goto('/dashboard/picks');

    const emptyState = page.getByTestId('empty-picks-state');
    await expect(emptyState).toHaveAttribute('role', 'status');
    await expect(emptyState).toHaveAttribute('aria-live', 'polite');
  });
});

test.describe('Degraded States (AC3)', () => {
  test('@p1 should display degraded state banner', async ({ page }) => {
    // Mock degraded response
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        json: {
          data: [{ id: '1', status: 'PICK', isDegraded: true }],
          meta: { degraded: true, degradedReason: 'Données sources partiellement disponibles' }
        }
      });
    });

    await page.goto('/dashboard/picks');

    // Degraded banner should be visible
    const degradedBanner = page.getByTestId('degraded-banner');
    await expect(degradedBanner).toBeVisible();

    // Reason should be displayed
    await expect(page.getByText(/Données sources partiellement disponibles/)).toBeVisible();
  });
});

test.describe('Blocked States (AC4)', () => {
  test('@p0 @a11y should display hard-stop blocked state correctly', async ({ page }) => {
    // Navigate to a decision that would be blocked
    await page.goto('/dashboard/picks');

    // Mock blocked decision in list
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        json: {
          data: [{
            id: 'blocked-1',
            status: 'HARD_STOP',
            hardStopReason: 'Limite de risque atteinte',
            recommendedAction: 'Attendre la fin du match',
            match: { homeTeam: 'LAL', awayTeam: 'GSW' }
          }],
          meta: { total: 1 }
        }
      });
    });

    await page.reload();

    // Blocked decision should show hard-stop styling
    const blockedCard = page.getByText('Limite de risque atteinte');
    await expect(blockedCard).toBeVisible();

    // Recommended action should be displayed
    await expect(page.getByText(/Attendre la fin du match/)).toBeVisible();
  });
});

test.describe('State Transitions (AC6)', () => {
  test('@p1 should transition smoothly from loading to content', async ({ page }) => {
    let resolveRequest: () => void;
    const requestPromise = new Promise<void>(resolve => { resolveRequest = resolve; });

    await page.route('**/api/v1/decisions**', async (route) => {
      await requestPromise;
      await route.fulfill({
        json: {
          data: [{ id: '1', status: 'PICK', match: { homeTeam: 'LAL', awayTeam: 'GSW' } }],
          meta: { total: 1 }
        }
      });
    });

    await page.goto('/dashboard/picks');

    // Should show skeleton initially
    await expect(page.getByTestId('decision-skeleton').first()).toBeVisible();

    // Resolve the request
    resolveRequest!();

    // Wait for content to appear
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 5000 });

    // Content should be visible
    await expect(page.getByTestId('decision-card').first()).toBeVisible();
  });

  test('@p1 loading state should be announced to screen readers', async ({ page }) => {
    await page.route('**/api/v1/decisions**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await route.fulfill({ json: { data: [], meta: { total: 0 } } });
    });

    await page.goto('/dashboard/picks');

    const loadingContainer = page.locator('[role="status"][aria-label*="Chargement"]').first();
    await expect(loadingContainer).toHaveAttribute('aria-live', 'polite');
  });
});

test.describe('Responsive States', () => {
  test('@mobile @p1 should display states correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({ json: { data: [], meta: { total: 0 } } });
    });

    await page.goto('/dashboard/picks');

    // Empty state should be visible and properly sized
    const emptyState = page.getByTestId('empty-picks-state');
    await expect(emptyState).toBeVisible();

    // Check touch targets are adequate
    const actionLink = page.getByRole('link', { name: /Voir l'historique/i });
    const box = await actionLink.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
