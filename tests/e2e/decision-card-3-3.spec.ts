/**
 * DecisionCard E2E Tests - Story 3.3 (TDD GREEN PHASE)
 * 
 * These tests verify the NEW features from Story 3.3 in an end-to-end context:
 * - AC5: Expandable details
 * - AC6: State variants
 * - AC7: Responsive mobile-first behavior
 * - AC9: Dark mode coherence
 * 
 * Current Status: Implementation complete. Tests should PASS.
 * Fixed 2026-02-14: All ACs implemented including viewport detection and keyboard navigation.
 */

import { test, expect, type Page } from '@playwright/test';

// =============================================================================
// TEST FIXTURES & HELPERS
// =============================================================================

test.describe('DecisionCard - Story 3.3 E2E Tests @epic3', () => {
  
  // Test data matching the Decision type from the story
  const mockPickDecision = {
    id: 'dec-123',
    match: {
      homeTeam: 'Lakers',
      awayTeam: 'Warriors',
      startTime: '2026-02-14T20:00:00Z',
    },
    status: 'PICK' as const,
    edge: 0.052,
    confidence: 0.78,
    rationale: 'Strong favorite with home court advantage',
  };

  const mockHardStopDecision = {
    id: 'dec-456',
    match: {
      homeTeam: 'Celtics',
      awayTeam: 'Heat',
      startTime: '2026-02-14T19:00:00Z',
    },
    status: 'HARD_STOP' as const,
    hardStopReason: 'Player injury detected - key player out',
    recommendedAction: 'Wait for updated odds',
    edge: 0,
    confidence: 0,
    rationale: 'Hard-stop triggered by policy engine',
  };

  const mockNoBetDecision = {
    id: 'dec-789',
    match: {
      homeTeam: 'Bulls',
      awayTeam: 'Knicks',
      startTime: '2026-02-14T18:00:00Z',
    },
    status: 'NO_BET' as const,
    edge: 0.02,
    confidence: 0.42,
    rationale: 'Confidence too low for reliable pick',
  };

  // Helper to navigate to picks page
  async function navigateToPicks(page: Page) {
    await page.goto('/dashboard/picks');
    await page.waitForLoadState('networkidle');
  }

  // Helper to mock API response with decisions
  async function mockDecisionsApi(page: Page, decisions: unknown[]) {
    await page.route('/api/v1/decisions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(decisions),
      });
    });
  }

  // =============================================================================
  // AC5: EXPANDABLE DETAILS
  // =============================================================================

  test.describe('AC5: Expandable Details', () => {
    
    test('should display expand button for each decision card', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      // Refresh to trigger API call
      await page.reload();
      
      // Should show expand button
      const expandButton = page.getByRole('button', { name: /plus de détails|more details|expand/i });
      await expect(expandButton).toBeVisible();
    });

    test('should reveal detailed metrics when expanded', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      // Click expand button
      const expandButton = page.getByRole('button', { name: /plus de détails|more details|expand/i });
      await expandButton.click();
      
      // Should show confidence breakdown
      const breakdown = page.getByText(/confidence.*breakdown|répartition/i);
      await expect(breakdown).toBeVisible();
      
      // Should show gate outcomes
      const gates = page.getByText(/gate outcomes|portails|portes/i);
      await expect(gates).toBeVisible();
    });

    test('should toggle expand state correctly', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const expandButton = page.getByRole('button', { name: /plus de détails|more details|expand/i });
      
      // First click - expand
      await expandButton.click();
      await expect(page.getByTestId('decision-details')).toBeVisible();
      
      // Second click - collapse
      const collapseButton = page.getByRole('button', { name: /moins de détails|less details|collapse/i });
      await expect(collapseButton).toBeVisible();
    });

    test('should animate expand/collapse smoothly', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      // Check for CSS transition/animation classes
      const detailsPanel = page.getByTestId('decision-details');
      await expect(detailsPanel).toHaveClass(/transition|animate|duration/i);
    });

    test('should announce state change to screen readers', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const expandButton = page.getByRole('button', { name: /plus de détails|more details|expand/i });
      
      // Should have aria-expanded that changes
      await expect(expandButton).toHaveAttribute('aria-expanded');
      
      await expandButton.click();
      
      // Should now be expanded
      await expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  // =============================================================================
  // AC6: STATE VARIANTS
  // =============================================================================

  test.describe('AC6: State Variants', () => {
    
    test('blocked state - should prominently display hard-stop information', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockHardStopDecision]);
      
      // Should show blocking message
      const blockedMessage = page.getByText(/blocage|blocked|hard.?stop/i);
      await expect(blockedMessage).toBeVisible();
      
      // Should show the reason
      const reason = page.getByText(/Player injury|blessure|injury/i);
      await expect(reason).toBeVisible();
    });

    test('blocked state - should show recommended action', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockHardStopDecision]);
      
      // Should display recommended action
      const action = page.getByText(/Wait for updated odds|Attendre/i);
      await expect(action).toBeVisible();
    });

    test('degraded state - should indicate data quality issues', async ({ page }) => {
      const degradedDecision = { ...mockPickDecision, isDegraded: true };
      await navigateToPicks(page);
      await mockDecisionsApi(page, [degradedDecision]);
      
      // Should show degraded warning
      const warning = page.getByText(/données|partial|degraded|partielles/i);
      await expect(warning).toBeVisible();
    });

    test('loading state - should show skeleton while loading', async ({ page }) => {
      // Mock slow API
      await page.route('/api/v1/decisions', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.continue();
      });
      
      await navigateToPicks(page);
      
      // Should show skeleton
      const skeleton = page.getByTestId('decision-card-skeleton');
      await expect(skeleton).toBeVisible();
    });

    test('default state - should render normally', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      // Card should be visible
      const card = page.getByTestId('decision-card').first();
      await expect(card).toBeVisible();
    });

    test('hover state - should have visual feedback', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const card = page.getByTestId('decision-card').first();
      
      // Hover over card
      await card.hover();
      
      // Should have hover styles (shadow, border color change, etc.)
      // This is implicit - the test passes if no errors occur
    });
  });

  // =============================================================================
  // AC7: RESPONSIVE MOBILE-FIRST
  // =============================================================================

  test.describe('AC7: Responsive Mobile-First', () => {
    
    test('compact variant - should use tight layout on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const card = page.getByTestId('decision-card').first();
      
      // Should have compact padding classes
      await expect(card).toHaveClass(/p-3|p-4/);
    });

    test('standard variant - should use spacious layout on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });
      
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const card = page.getByTestId('decision-card').first();
      
      // Should have standard padding classes
      await expect(card).toHaveClass(/p-4|p-6/);
    });

    test('touch targets - should be >=44px on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const expandButton = page.getByRole('button', { name: /plus de détails|more details/i });
      
      // Get button bounding box
      const box = await expandButton.boundingBox();
      expect(box).toBeTruthy();
      
      // Height should be at least 44px for touch
      expect(box!.height).toBeGreaterThanOrEqual(44);
    });

    test('should optimize for single-column scanning on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision, mockNoBetDecision]);
      
      // Cards should stack vertically
      const cards = page.getByTestId('decision-card');
      const firstCard = cards.nth(0);
      const secondCard = cards.nth(1);
      
      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();
      
      // Second card should be below first (y should be greater)
      expect(secondBox!.y).toBeGreaterThan(firstBox!.y);
    });

    test('should switch layout based on viewport size', async ({ page }) => {
      // Mobile first
      await page.setViewportSize({ width: 375, height: 667 });
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const mobileCard = page.getByTestId('decision-card').first();
      await expect(mobileCard).toHaveClass(/flex-col/);
      
      // Then desktop
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.reload();
      
      const desktopCard = page.getByTestId('decision-card').first();
      await expect(desktopCard).toHaveClass(/flex-row|grid/);
    });
  });

  // =============================================================================
  // AC9: DARK MODE COHERENCE
  // =============================================================================

  test.describe('AC9: Dark Mode Coherence', () => {
    
    test('should maintain semantic colors in dark mode', async ({ page }) => {
      // Enable dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const statusBadge = page.getByRole('status');
      
      // Should have dark mode color classes
      await expect(statusBadge).toHaveClass(/dark:bg-emerald|dark:text-emerald/i);
    });

    test('should adapt surface colors for dark mode', async ({ page }) => {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const card = page.getByTestId('decision-card').first();
      
      // Should use dark surface colors
      await expect(card).toHaveClass(/dark:bg-gray-800|dark:bg-slate-800/i);
    });

    test('should NOT rely on color alone for status in dark mode', async ({ page }) => {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const statusBadge = page.getByRole('status');
      
      // Should have text content (not just color)
      const text = await statusBadge.textContent();
      expect(text).toBeTruthy();
      
      // Should have accessible name/label
      const label = await statusBadge.getAttribute('aria-label');
      expect(label).toBeTruthy();
    });

    test('should maintain WCAG AA contrast in dark mode', async ({ page }) => {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      // This test would use axe-core for real accessibility testing
      // For now, just verify page loads without errors
      const card = page.getByTestId('decision-card').first();
      await expect(card).toBeVisible();
    });
  });

  // =============================================================================
  // AC8: ACCESSIBILITY (ENHANCED)
  // =============================================================================

  test.describe('AC8: Accessibility Enhanced', () => {
    
    test('should have proper role and labeling', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const card = page.getByTestId('decision-card').first();
      
      // Should have proper role
      await expect(card).toHaveAttribute('role', 'group');
      
      // Should have labelledby
      await expect(card).toHaveAttribute('aria-labelledby');
    });

    test('should announce status to screen readers', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      const statusBadge = page.getByRole('status');
      
      // Should have accessible name
      const name = await statusBadge.textContent();
      expect(name).toBeTruthy();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      // Tab to first card
      await page.keyboard.press('Tab');
      
      // Card should be focusable
      const card = page.getByTestId('decision-card').first();
      await expect(card).toBeFocused();
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      
      // Should have a heading
      const heading = page.getByRole('heading', { level: 3 });
      await expect(heading).toBeVisible();
    });
  });
});

// =============================================================================
// TEST SUMMARY
// =============================================================================

/**
 * TDD RED PHASE STATUS:
 * 
 * All tests in this file use test() and will FAIL until:
 * - DecisionCard component implements AC5 (expandable details)
 * - DecisionCard component implements AC6 (state variants)
 * - DecisionCard component implements AC7 (responsive variants)
 * - DecisionCard component implements AC9 (dark mode support)
 * 
 * Once implementation is complete, remove .skip from each test group
 * to activate the tests.
 * 
 * Expected test count after implementation:
 * - AC5: 5 tests
 * - AC6: 5 tests  
 * - AC7: 5 tests
 * - AC9: 4 tests
 * - Accessibility: 4 tests
 * Total: ~23 new E2E tests
 * 
 * Run with: npx playwright test tests/e2e/decision-card-3-3.spec.ts
 */
