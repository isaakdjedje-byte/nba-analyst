/**
 * Visual Regression Tests
 * Tests for UI consistency across browsers
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage Visual Regression', () => {
  test('homepage should match snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot and compare with baseline
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('homepage on mobile should match snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});

test.describe('Dashboard Visual Regression', () => {
  test('picks page should match snapshot', async ({ page }) => {
    await page.goto('/dashboard/picks');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('picks-page.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('no-bet page should match snapshot', async ({ page }) => {
    await page.goto('/dashboard/no-bet');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('no-bet-page.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('logs page should match snapshot', async ({ page }) => {
    await page.goto('/dashboard/logs');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('logs-page.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});

test.describe('Modal Visual Regression', () => {
  test('pick detail modal should match snapshot', async ({ page }) => {
    await page.goto('/dashboard/picks');
    await page.waitForLoadState('networkidle');
    
    // Click on first pick to open modal
    const firstPick = page.getByTestId('pick-card').first();
    await firstPick.click();

    // Wait for modal to appear (deterministic wait for element state)
    const modal = page.getByTestId('pick-detail-modal');
    await modal.waitFor({ state: 'visible' });
    await expect(modal).toHaveScreenshot('pick-detail-modal.png', {
      threshold: 0.2,
    });
  });
});

test.describe('404 Page Visual Regression', () => {
  test('404 page should match snapshot', async ({ page }) => {
    await page.goto('/non-existent-page');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('404-page.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});
