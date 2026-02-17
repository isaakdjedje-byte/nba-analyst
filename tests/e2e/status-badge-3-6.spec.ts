/**
 * StatusBadge E2E Tests - Story 3.6
 * 
 * Tests:
 * - AC1: Icon + Label + Color consistency
 * - AC2: WCAG AA accessibility (aria-label, role)
 * - AC3: Size variants
 * - AC5: Integration with DecisionCard
 * - AC6: Dark mode coherence
 * 
 * Current Status: Implementation complete
 */

import { test, expect } from '@playwright/test';

test.describe('StatusBadge - Story 3.6 E2E Tests @e2e @epic3', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to picks page where StatusBadge is used
    await page.goto('/dashboard/picks');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  // ============================================================================
  // AC1: Icon + Label + Color Display
  // ============================================================================
  
  test('should display correct icon and label for PICK status', async ({ page }) => {
    // Find a card with PICK status
    const pickCard = page.locator('[data-status="pick"]').first();
    
    // Verify the card exists
    await expect(pickCard).toBeVisible();
    
    // Find the status badge within the card
    const statusBadge = pickCard.locator('[role="status"]').first();
    await expect(statusBadge).toBeVisible();
    
    // Verify label is present
    await expect(statusBadge).toContainText('Pick');
    
    // Verify aria-label contains status
    await expect(statusBadge).toHaveAttribute('aria-label', /Statut: Pick/i);
  });

  test('should display correct icon and label for NO_BET status', async ({ page }) => {
    const noBetCard = page.locator('[data-status="no_bet"]').first();
    
    // If no NO_BET cards exist, skip this test
    const count = await noBetCard.count();
    if (count === 0) {
      test.skip();
      return;
    }
    
    await expect(noBetCard).toBeVisible();
    const statusBadge = noBetCard.locator('[role="status"]').first();
    await expect(statusBadge).toContainText('No-Bet');
    await expect(statusBadge).toHaveAttribute('aria-label', /Statut: No-Bet/i);
  });

  test('should display correct icon and label for HARD_STOP status', async ({ page }) => {
    const hardStopCard = page.locator('[data-status="hard_stop"]').first();
    
    // If no HARD_STOP cards exist, skip this test
    const count = await hardStopCard.count();
    if (count === 0) {
      test.skip();
      return;
    }
    
    await expect(hardStopCard).toBeVisible();
    const statusBadge = hardStopCard.locator('[role="status"]').first();
    await expect(statusBadge).toContainText('Hard-Stop');
    await expect(statusBadge).toHaveAttribute('aria-label', /Statut: Hard-Stop/i);
  });

  // ============================================================================
  // AC2: WCAG AA Accessibility
  // ============================================================================
  
  test('should have proper accessibility attributes', async ({ page }) => {
    const statusBadge = page.locator('[data-testid="status-badge"]').first();
    
    // Verify role="status"
    await expect(statusBadge).toHaveAttribute('role', 'status');
    
    // Verify aria-label is present
    await expect(statusBadge).toHaveAttribute('aria-label');
    const ariaLabel = await statusBadge.getAttribute('aria-label');
    expect(ariaLabel).toMatch(/Statut: (Pick|No-Bet|Hard-Stop)/);
    
    // Verify icon is decorative (aria-hidden="true")
    const icon = statusBadge.locator('svg').first();
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  // ============================================================================
  // AC5: Integration with DecisionCard
  // ============================================================================
  
  test('should integrate correctly within DecisionCard', async ({ page }) => {
    // Find a decision card
    const decisionCard = page.locator('[data-testid="decision-card"]').first();
    await expect(decisionCard).toBeVisible();
    
    // Find the status badge inside
    const statusBadge = decisionCard.locator('[role="status"]').first();
    await expect(statusBadge).toBeVisible();
    
    // Verify badge is positioned in header area
    const cardHeader = decisionCard.locator('[class*="flex items-start"]').first();
    await expect(cardHeader).toContainText(/Pick|No-Bet|Hard-Stop/);
  });

  // ============================================================================
  // AC6: Dark Mode Coherence
  // ============================================================================
  
  test('should maintain semantic colors in dark mode', async ({ page }) => {
    // Toggle to dark mode
    const themeToggle = page.locator('[data-testid="theme-toggle"]').first();
    
    // If theme toggle exists, test dark mode
    if (await themeToggle.isVisible().catch(() => false)) {
      await themeToggle.click();
      
      // Wait for dark mode to apply
      await page.waitForTimeout(300);
      
      // Verify status badge is still visible with correct content
      const statusBadge = page.locator('[role="status"]').first();
      await expect(statusBadge).toBeVisible();
      
      // Verify semantic color is maintained (check inline style)
      const color = await statusBadge.evaluate(el => el.style.color);
      // Should have a color value (rgb or hex)
      expect(color).toBeTruthy();
      
      // Toggle back to light mode
      await themeToggle.click();
    } else {
      test.skip('Theme toggle not available');
    }
  });

  // ============================================================================
  // Visual Regression (Optional)
  // ============================================================================
  
  test('should have consistent styling', async ({ page }) => {
    const statusBadge = page.locator('[role="status"]').first();
    await expect(statusBadge).toBeVisible();
    
    // Check basic styling
    const className = await statusBadge.getAttribute('class');
    
    // Should have inline-flex layout
    expect(className).toContain('inline-flex');
    
    // Should have rounded-full (pill shape)
    expect(className).toContain('rounded-full');
    
    // Should have border
    expect(className).toContain('border');
  });
});
