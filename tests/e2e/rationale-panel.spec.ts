/**
 * RationalePanel E2E Tests - Story 3.4 (ATDD RED PHASE)
 * 
 * These tests verify the RationalePanel UI feature requirements:
 * - AC1: Short rationale visible by default (FR3)
 * - AC2: Rationale explains edge, confidence, and relevant gates
 * - AC3: No need to leave platform to understand (FR6)
 * 
 * TDD RED PHASE: These tests WILL FAIL until RationalePanel is implemented.
 * Once implemented, remove test.skip() to activate tests.
 */

import { test, expect, type Page } from '@playwright/test';

// =============================================================================
// TEST FIXTURES & HELPERS
// =============================================================================

test.describe('RationalePanel - Story 3.4 E2E Tests @epic3', () => {
  
  // Test data matching the Decision type with complete rationale info
  const mockPickDecision = {
    id: 'dec-123',
    match: {
      homeTeam: 'Lakers',
      awayTeam: 'Warriors',
      startTime: '2026-02-14T20:00:00Z',
      league: 'NBA',
    },
    status: 'PICK' as const,
    edge: 0.052,
    confidence: 0.78,
    rationale: 'Strong favorite with home court advantage. Edge 5.2% due to key player returning. Confidence 78% passes all gates.',
    gates: [
      { name: 'min_confidence', passed: true, value: 0.78, threshold: 0.60 },
      { name: 'min_edge', passed: true, value: 0.052, threshold: 0.03 },
      { name: 'data_quality', passed: true, value: 0.95, threshold: 0.80 },
    ],
    recommendedPick: 'Lakers -5.5',
  };

  const mockNoBetDecision = {
    id: 'dec-456',
    match: {
      homeTeam: 'Bulls',
      awayTeam: 'Knicks',
      startTime: '2026-02-14T19:00:00Z',
      league: 'NBA',
    },
    status: 'NO_BET' as const,
    edge: 0.02,
    confidence: 0.42,
    rationale: 'Confidence below threshold at 42%. Edge too low at 2%. Recommend waiting for better opportunity.',
    gates: [
      { name: 'min_confidence', passed: false, value: 0.42, threshold: 0.60 },
      { name: 'min_edge', passed: false, value: 0.02, threshold: 0.03 },
      { name: 'data_quality', passed: true, value: 0.90, threshold: 0.80 },
    ],
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
        body: JSON.stringify({ decisions }),
      });
    });
  }

  // =============================================================================
  // AC1: SHORT RATIONALE VISIBLE BY DEFAULT (FR3)
  // =============================================================================

  test.describe('AC1: Rationale Visible by Default', () => {
    
    test.skip('[P0] should display rationale text on DecisionCard', async ({ page }) => {
      // THIS TEST WILL FAIL - RationalePanel not implemented
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      // Should show rationale text
      const rationaleText = page.getByTestId('decision-rationale');
      await expect(rationaleText).toBeVisible();
      
      // Should contain rationale content
      const rationale = await rationaleText.textContent();
      expect(rationale).toContain('Strong favorite');
    });

    test.skip('[P0] rationale should be visible without user interaction', async ({ page }) => {
      // THIS TEST WILL FAIL - Rationale not visible by default
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      // Rationale should be immediately visible, not hidden behind expand
      const rationale = page.getByTestId('decision-rationale');
      await expect(rationale).toBeVisible();
      
      // Should NOT require clicking to see rationale
      const expandButton = page.getByRole('button', { name: /expand|plus/i });
      if (await expandButton.isVisible()) {
        // If expand exists, rationale should be visible before clicking
        await expect(rationale).toBeVisible();
      }
    });

    test.skip('[P1] rationale should not be truncated unnecessarily', async ({ page }) => {
      // THIS TEST WILL FAIL - Truncation not implemented
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      const rationale = page.getByTestId('decision-rationale');
      
      // Should show enough content to understand (not overly truncated)
      const text = await rationale.textContent();
      expect(text?.length).toBeGreaterThan(30);
    });
  });

  // =============================================================================
  // AC2: RATIONALE EXPLAINS EDGE, CONFIDENCE, AND GATES
  // =============================================================================

  test.describe('AC2: Rationale Explains Key Factors', () => {
    
    test.skip('[P0] should explain edge in rationale', async ({ page }) => {
      // THIS TEST WILL FAIL - Edge explanation not in UI
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      // Should show edge explanation
      const rationale = page.getByTestId('decision-rationale');
      await expect(rationale).toBeVisible();
      
      // Should contain edge information
      const text = await rationale.textContent();
      expect(text).toMatch(/edge|5\.2%|0\.0[0-9]/i);
      
      // Should also show edge value visually
      const edgeValue = page.getByText(/Edge.*5\.2%/i);
      await expect(edgeValue).toBeVisible();
    });

    test.skip('[P0] should explain confidence in rationale', async ({ page }) => {
      // THIS TEST WILL FAIL - Confidence explanation not in UI
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      // Should show confidence explanation
      const rationale = page.getByTestId('decision-rationale');
      const text = await rationale.textContent();
      expect(text).toMatch(/confidence|confiance|78%|0\.7[0-9]/i);
      
      // Should also show confidence value visually
      const confidenceValue = page.getByText(/Confiance.*78%/i);
      await expect(confidenceValue).toBeVisible();
    });

    test.skip('[P1] should display gate information in rationale panel', async ({ page }) => {
      // THIS TEST WILL FAIL - Gate display not implemented
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      // Should show gate information section
      const gatesSection = page.getByTestId('decision-gates');
      await expect(gatesSection).toBeVisible();
    });

    test.skip('[P1] should show which gates passed for PICK decisions', async ({ page }) => {
      // THIS TEST WILL FAIL - Gate pass/fail display not implemented
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      // Should show passed gates
      const passedGate = page.getByTestId('gate-min_confidence-passed');
      await expect(passedGate).toBeVisible();
      
      // Should show green checkmark or similar indicator
      const checkmark = passedGate.locator('svg, [class*="text-emerald"]');
      await expect(checkmark.first()).toBeVisible();
    });

    test.skip('[P1] should show which gates failed for NO_BET decisions', async ({ page }) => {
      // THIS TEST WILL FAIL - Gate failure display not implemented
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockNoBetDecision]);
      await page.reload();

      // Should show failed gates
      const failedGate = page.getByTestId('gate-min_confidence-failed');
      await expect(failedGate).toBeVisible();
      
      // Should show red X or similar indicator
      const failureIndicator = failedGate.locator('svg, [class*="text-red"]');
      await expect(failureIndicator.first()).toBeVisible();
    });

    test.skip('[P2] should display gate threshold values', async ({ page }) => {
      // THIS TEST WILL FAIL - Threshold display not implemented
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      // Should show threshold values
      const threshold = page.getByText(/threshold.*0\.60/i);
      await expect(threshold).toBeVisible();
    });

    test.skip('[P2] rationale should reference gates contextually', async ({ page }) => {
      // THIS TEST WILL FAIL - Gate context in rationale not implemented
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      const rationale = page.getByTestId('decision-rationale');
      const text = await rationale.textContent();
      
      // Rationale should mention gates or their outcomes
      expect(text).toMatch(/gate|passe|passes|threshold/i);
    });
  });

  // =============================================================================
  // AC3: NO NEED TO LEAVE PLATFORM (FR6)
  // =============================================================================

  test.describe('AC3: Self-Contained Understanding', () => {
    
    test.skip('[P0] rationale should be comprehensive without external links', async ({ page }) => {
      // THIS TEST WILL FAIL - Self-contained rationale not implemented
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      // Should NOT have external links in rationale
      const rationale = page.getByTestId('decision-rationale');
      const link = rationale.locator('a[href]');
      
      // Should not contain click-out links
      const linkCount = await link.count();
      expect(linkCount).toBe(0);
    });

    test.skip('[P0] user should understand decision without clicking away', async ({ page }) => {
      // THIS TEST WILL FAIL - Self-contained understanding not verified
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      // Should show teams
      const teams = page.getByText(/Lakers.*Warriors/i);
      await expect(teams).toBeVisible();

      // Should show status
      const status = page.getByRole('status');
      await expect(status).toBeVisible();

      // Should show rationale
      const rationale = page.getByTestId('decision-rationale');
      await expect(rationale).toBeVisible();

      // Should show metrics
      const metrics = page.getByText(/Edge.*Confiance/i);
      await expect(metrics).toBeVisible();
    });

    test.skip('[P1] for PICK: should show recommended action', async ({ page }) => {
      // THIS TEST WILL FAIL - Recommended action not shown
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      // Should show what to bet
      const recommendation = page.getByTestId('decision-recommendation');
      await expect(recommendation).toBeVisible();
      await expect(recommendation).toContainText('Lakers');
    });

    test.skip('[P1] for NO_BET: should explain why not to bet', async ({ page }) => {
      // THIS TEST WILL FAIL - NO_BET explanation not shown
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockNoBetDecision]);
      await page.reload();

      // Should show clear NO_BET status
      const status = page.getByRole('status');
      await expect(status).toContainText(/no.?bet|pas de pari/i);

      // Should explain why
      const rationale = page.getByTestId('decision-rationale');
      const text = await rationale.textContent();
      expect(text).toMatch(/confidence|threshold|low|basse/i);
    });
  });

  // =============================================================================
  // RESPONSIVE & ACCESSIBILITY TESTS
  // =============================================================================

  test.describe('Responsive & Accessibility', () => {
    
    test.skip('[P2] rationale should display correctly on mobile', async ({ page }) => {
      // THIS TEST WILL FAIL - Mobile rationale display not implemented
      await page.setViewportSize({ width: 375, height: 667 });
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      // Should show rationale on mobile
      const rationale = page.getByTestId('decision-rationale');
      await expect(rationale).toBeVisible();
      
      // Should be readable (not cut off)
      const box = await rationale.boundingBox();
      expect(box?.height).toBeGreaterThan(20);
    });

    test.skip('[P2] rationale should be accessible to screen readers', async ({ page }) => {
      // THIS TEST WILL FAIL - Accessibility not implemented
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      const rationale = page.getByTestId('decision-rationale');
      
      // Should have proper ARIA labeling
      await expect(rationale).toHaveAttribute('aria-label');
      
      // Should have role
      await expect(rationale).toHaveAttribute('role');
    });

    test.skip('[P2] gate information should be accessible', async ({ page }) => {
      // THIS TEST WILL FAIL - Gate accessibility not implemented
      await navigateToPicks(page);
      await mockDecisionsApi(page, [mockPickDecision]);
      await page.reload();

      const gatesSection = page.getByTestId('decision-gates');
      
      // Should have accessible description
      await expect(gatesSection).toHaveAttribute('aria-label', /gate|policy/i);
    });
  });

  // =============================================================================
  // EDGE CASES
  // =============================================================================

  test.describe('Edge Cases', () => {
    
    test.skip('[P2] should handle decision without rationale gracefully', async ({ page }) => {
      // THIS TEST WILL FAIL - Missing rationale handling not implemented
      const decisionWithoutRationale = {
        ...mockPickDecision,
        rationale: '',
      };
      
      await navigateToPicks(page);
      await mockDecisionsApi(page, [decisionWithoutRationale]);
      await page.reload();

      // Should show fallback message or default rationale
      const rationale = page.getByTestId('decision-rationale');
      const text = await rationale.textContent();
      expect(text?.length).toBeGreaterThan(0);
    });

    test.skip('[P2] should handle decision without gates gracefully', async ({ page }) => {
      // THIS TEST WILL FAIL - Missing gates handling not implemented
      const decisionWithoutGates = {
        ...mockPickDecision,
        gates: [],
      };
      
      await navigateToPicks(page);
      await mockDecisionsApi(page, [decisionWithoutGates]);
      await page.reload();

      // Should not crash
      const rationale = page.getByTestId('decision-rationale');
      await expect(rationale).toBeVisible();
    });
  });
});

// =============================================================================
// TEST SUMMARY
// =============================================================================

/**
 * TDD RED PHASE STATUS:
 * 
 * All tests in this file use test.skip() and will FAIL until:
 * - RationalePanel component implements AC1 (visible by default)
 * - RationalePanel component implements AC2 (explains edge, confidence, gates)
 * - RationalePanel component implements AC3 (self-contained understanding)
 * - API returns complete rationale data with gates
 * 
 * Once implementation is complete, remove .skip from each test group
 * to activate the tests.
 * 
 * Expected test count after implementation:
 * - AC1: 3 tests
 * - AC2: 7 tests
 * - AC3: 4 tests
 * - Responsive/Accessibility: 3 tests
 * - Edge Cases: 2 tests
 * Total: ~19 new E2E tests
 * 
 * Run with: npx playwright test tests/e2e/rationale-panel.spec.ts
 */
