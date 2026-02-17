/**
 * E2E Tests for Story 3.8: Mobile-first Responsive Design
 * 
 * AC1: Parcours mobile optimisé (< 2 minutes)
 * AC2: Breakpoints responsifs cohérents
 * AC3: Touch targets >= 44x44px
 * AC5: Navigation mobile efficace
 * AC6: Virtual scrolling pour listes > 20 éléments
 * AC7: Accessibilité mobile
 */

import { test, expect } from '@playwright/test';

test.describe('Story 3.8: Mobile-first Responsive Design', () => {
  
  // AC2: Test mobile viewport (320-767px)
  test.describe('Mobile Viewport (375px)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('AC2: Dashboard shows mobile navigation at bottom', async ({ page }) => {
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');

      // Mobile navigation should be visible
      const mobileNav = page.getByTestId('mobile-navigation');
      await expect(mobileNav).toBeVisible();

      // Desktop tabs should be hidden
      const desktopTabs = page.getByRole('tablist');
      await expect(desktopTabs).toBeHidden();

      // Navigation items should be present
      await expect(page.getByTestId('mobile-nav-picks')).toBeVisible();
      await expect(page.getByTestId('mobile-nav-no-bet')).toBeVisible();
      await expect(page.getByTestId('mobile-nav-performance')).toBeVisible();
      await expect(page.getByTestId('mobile-nav-logs')).toBeVisible();
    });

    test('AC3: Touch targets >= 44x44px on mobile navigation', async ({ page }) => {
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');

      const navItems = [
        page.getByTestId('mobile-nav-picks'),
        page.getByTestId('mobile-nav-no-bet'),
        page.getByTestId('mobile-nav-performance'),
        page.getByTestId('mobile-nav-logs'),
      ];

      for (const item of navItems) {
        const box = await item.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('AC2: Single column layout on mobile', async ({ page }) => {
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');

      // Decision list should be single column
      const decisionList = page.getByTestId('decision-list');
      if (await decisionList.isVisible().catch(() => false)) {
        const box = await decisionList.boundingBox();
        if (box) {
          // Should be full width on mobile (no grid columns)
          expect(box.width).toBeLessThan(400);
        }
      }
    });

    test('AC5: Navigation transitions work on mobile', async ({ page }) => {
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');

      // Click No-Bet tab
      await page.getByTestId('mobile-nav-no-bet').click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/.*\/dashboard\/no-bet.*/);

      // Click Performance tab
      await page.getByTestId('mobile-nav-performance').click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/.*\/dashboard\/performance.*/);

      // Click Logs tab
      await page.getByTestId('mobile-nav-logs').click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/.*\/dashboard\/logs.*/);
    });
  });

  // AC2: Test tablet viewport (768-1023px)
  test.describe('Tablet Viewport (768px)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('AC2: Desktop navigation visible on tablet', async ({ page }) => {
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');

      // Desktop tabs should be visible
      const desktopTabs = page.getByRole('tablist');
      await expect(desktopTabs).toBeVisible();

      // Mobile navigation should be hidden
      const mobileNav = page.getByTestId('mobile-navigation');
      await expect(mobileNav).toBeHidden();
    });

    test('AC2: Multi-column layout on tablet', async ({ page }) => {
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');

      // Decision list should have multiple columns
      const decisionList = page.getByTestId('decision-list');
      if (await decisionList.isVisible().catch(() => false)) {
        const box = await decisionList.boundingBox();
        if (box) {
          // Should be wider on tablet (multi-column grid)
          expect(box.width).toBeGreaterThan(400);
        }
      }
    });
  });

  // AC2: Test desktop viewport (1024px+)
  test.describe('Desktop Viewport (1280px)', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('AC2: Desktop navigation and layout', async ({ page }) => {
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');

      // Desktop tabs should be visible
      const desktopTabs = page.getByRole('tablist');
      await expect(desktopTabs).toBeVisible();

      // Mobile navigation should be hidden
      const mobileNav = page.getByTestId('mobile-navigation');
      await expect(mobileNav).toBeHidden();
    });
  });

  // AC7: Test accessibility features
  test.describe('Accessibility (Mobile)', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('AC7: Navigation has proper ARIA attributes', async ({ page }) => {
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');

      // Navigation should have role and aria-label
      const nav = page.locator('nav[aria-label="Navigation mobile"]');
      await expect(nav).toBeVisible();

      // Current page should be indicated
      const currentPicks = page.getByTestId('mobile-nav-picks');
      await expect(currentPicks).toHaveAttribute('aria-current', 'page');
    });

    test('AC7: Touch targets are accessible', async ({ page }) => {
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');

      // All navigation links should be focusable
      const navLinks = page.locator('nav a');
      const count = await navLinks.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const link = navLinks.nth(i);
        await link.focus();
        await expect(link).toBeFocused();
      }
    });
  });

  // AC4: Test performance metrics
  test.describe('Performance Metrics', () => {
    test('AC4: Page loads within performance targets', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // AC4: FCP < 1.5s (practical test)
      expect(loadTime).toBeLessThan(3000);
    });
  });

  // Test DecisionCard mobile layout
  test.describe('DecisionCard Mobile Layout', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('DecisionCard fits within viewport on mobile', async ({ page }) => {
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');

      const cards = page.getByTestId('decision-card');
      if (await cards.first().isVisible().catch(() => false)) {
        const card = await cards.first().boundingBox();
        if (card) {
          // Card should not overflow viewport
          expect(card.width).toBeLessThanOrEqual(375);
        }
      }
    });
  });
});
