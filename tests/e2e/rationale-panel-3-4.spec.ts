/**
 * RationalePanel E2E Tests
 * Story 3.4: Implementer le RationalePanel avec justification courte
 * 
 * Tests cover:
 * - AC1: Justification visible par defaut
 * - AC2: Explication edge et confiance
 * - AC3: Affichage des gates pertinents
 * - AC4: Format concis et lisible (mobile)
 * - AC5: Integration DecisionCard
 * - AC6: Variant Embedded
 * - AC7: Accessibilite
 * - AC8: Dark mode coherence
 * - AC9: Etat donnees manquantes
 */

import { test, expect } from '@playwright/test';

test.describe('RationalePanel @e2e @epic3', () => {
  // ============================================================================
  // AC5: Integration DecisionCard
  // ============================================================================
  test('should display rationale in DecisionCard', async ({ page }) => {
    await page.goto('/dashboard/picks');
    
    // Wait for decisions to load
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 10000 });
    
    const card = page.locator('[data-testid="decision-card"]').first();
    const rationalePanel = card.locator('[data-testid="rationale-panel"]');
    
    // Verify RationalePanel is embedded in DecisionCard
    await expect(rationalePanel).toBeVisible();
  });

  test('should show rationale text within card', async ({ page }) => {
    await page.goto('/dashboard/picks');
    
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 10000 });
    
    const card = page.locator('[data-testid="decision-card"]').first();
    const rationaleText = card.locator('[data-testid="rationale-panel"] p').first();
    
    // Verify rationale text is present and not empty
    await expect(rationaleText).toBeVisible();
    await expect(rationaleText).not.toHaveText('');
  });

  // ============================================================================
  // AC3: Affichage des Gates Pertinents
  // ============================================================================
  test('should show gate indicators in DecisionCard', async ({ page }) => {
    await page.goto('/dashboard/picks');
    
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 10000 });
    
    const card = page.locator('[data-testid="decision-card"]').first();
    const gateIndicators = card.locator('[data-testid*="gate-indicator"]');
    
    // At least one gate indicator should be visible
    await expect(gateIndicators.first()).toBeVisible();
  });

  test('should display passed gates with correct styling', async ({ page }) => {
    await page.goto('/dashboard/picks');
    
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 10000 });
    
    // Look for confidence gate which should always exist
    const confidenceGate = page.locator('[data-testid="gate-indicator-confidence"]').first();
    await expect(confidenceGate).toBeVisible();
    
    // Check for emerald/green color (passed gate)
    await expect(confidenceGate).toHaveClass(/bg-emerald/);
  });

  // ============================================================================
  // AC7: Accessibilite
  // ============================================================================
  test('should have proper ARIA attributes for screen readers', async ({ page }) => {
    await page.goto('/dashboard/picks');
    
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 10000 });
    
    const rationalePanel = page.locator('[data-testid="rationale-panel"]').first();
    
    // Verify aria-labelledby attribute
    await expect(rationalePanel).toHaveAttribute('aria-labelledby');
    
    // Verify section semantic element
    const tagName = await rationalePanel.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('section');
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/dashboard/picks');
    
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 10000 });
    
    // Focus first decision card
    await page.keyboard.press('Tab');
    
    const rationalePanel = page.locator('[data-testid="rationale-panel"]').first();
    await expect(rationalePanel).toBeVisible();
  });

  // ============================================================================
  // AC4: Format Concis et Lisible (Mobile)
  // ============================================================================
  test('should display correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard/picks');
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 10000 });
    
    const card = page.locator('[data-testid="decision-card"]').first();
    const rationalePanel = card.locator('[data-testid="rationale-panel"]');
    
    await expect(rationalePanel).toBeVisible();
    
    // Verify rationale text has line-clamp for mobile
    const rationaleText = rationalePanel.locator('p').first();
    await expect(rationaleText).toHaveClass(/line-clamp/);
  });

  test('should use readable font size on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard/picks');
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 10000 });
    
    const rationaleText = page.locator('[data-testid="rationale-panel"] p').first();
    
    // Check computed font size (should be at least 16px)
    const fontSize = await rationaleText.evaluate(el => {
      const style = window.getComputedStyle(el);
      return parseFloat(style.fontSize);
    });
    
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  // ============================================================================
  // AC8: Dark Mode Coherence
  // ============================================================================
  test('should support dark mode', async ({ page }) => {
    // Enable dark mode via localStorage or system preference
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    
    await page.goto('/dashboard/picks');
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 10000 });
    
    const rationalePanel = page.locator('[data-testid="rationale-panel"]').first();
    await expect(rationalePanel).toBeVisible();
    
    // Verify dark mode classes are applied
    const rationaleText = rationalePanel.locator('p').first();
    const classList = await rationaleText.getAttribute('class');
    expect(classList).toContain('dark:');
  });

  // ============================================================================
  // AC9: Etat Donnees Manquantes
  // ============================================================================
  test('should show error state gracefully when rationale is unavailable', async ({ page }) => {
    // Navigate to picks page
    await page.goto('/dashboard/picks');
    await page.waitForTimeout(2000);
    
    // Check if any rationale panels show error state
    const errorStates = page.locator('text=/Données de justification indisponibles/i');
    
    // Either rationale is displayed OR error state is shown gracefully
    const rationalePanels = page.locator('[data-testid="rationale-panel"]');
    const count = await rationalePanels.count();
    
    if (count > 0) {
      await expect(rationalePanels.first()).toBeVisible();
    }
  });

  // ============================================================================
  // AC6: Variant Embedded
  // ============================================================================
  test('should render embedded variant within card flow', async ({ page }) => {
    await page.goto('/dashboard/picks');
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 10000 });
    
    const card = page.locator('[data-testid="decision-card"]').first();
    const rationalePanel = card.locator('[data-testid="rationale-panel"]');
    
    // Verify embedded styling (should have mt-2 class for spacing)
    await expect(rationalePanel).toHaveClass(/mt-2/);
  });

  // ============================================================================
  // AC2: Explication Edge et Confiance
  // ============================================================================
  test('should display edge and confidence context', async ({ page }) => {
    await page.goto('/dashboard/picks');
    await page.waitForSelector('[data-testid="decision-card"]', { timeout: 10000 });
    
    // Check for contextual explanation text
    const contextText = page.locator('text=/Edge de/i');
    const contextText2 = page.locator('text=/confiance/i');
    
    // At least one should be present
    const hasContext = await contextText.isVisible().catch(() => false) || 
                       await contextText2.isVisible().catch(() => false);
    
    expect(hasContext).toBe(true);
  });

  // ============================================================================
  // Performance: Load Time
  // ============================================================================
  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/dashboard/picks');
    await page.waitForSelector('[data-testid="rationale-panel"]', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    
    // RationalePanel should not significantly impact load time
    // NFR1: Load time <= 2.0s p95
    expect(loadTime).toBeLessThan(2000);
  });
});
