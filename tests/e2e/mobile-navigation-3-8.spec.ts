/**
 * Mobile Navigation E2E Tests - Story 3.8
 * ATDD Red Phase: Tests will FAIL until mobile navigation is implemented
 *
 * Story: 3.8 - Implémenter le responsive mobile-first (2-min parcours)
 * Epic: 3 - Experience Picks/No-Bet explicable (mobile-first)
 *
 * Coverage:
 * - AC1: Navigation hamburger mobile (P0)
 *   - Given: utilisateur sur écran < 768px
 *   - When: visualise la page principale
 *   - Then: navigation via menu hamburger
 *   - And: zones tactiles ≥ 44x44px
 *
 * @epic3 @story3-8 @atdd @red-phase @p0 @mobile
 */

import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Viewport configurations for mobile devices
 */
const viewports = {
  iPhone12: { width: 390, height: 844 },
  Pixel5: { width: 393, height: 851 },
  mobileThreshold: { width: 767, height: 800 }, // Just under 768px
};

test.describe('Mobile Navigation - Story 3.8 E2E Tests @e2e @epic3 @story3-8', () => {
  // ============================================
  // AC1: Navigation hamburger mobile (P0)
  // ============================================

  test('[P0] [AC1] Menu hamburger is visible on mobile viewport (< 768px)', async ({ page }) => {
    // Given: utilisateur sur écran < 768px
    await page.setViewportSize(viewports.Pixel5);

    // Network-first pattern: Intercept API calls before navigation
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [],
          total: 0,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: visualise la page principale
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: navigation via menu hamburger
    const hamburgerButton = page.getByTestId('mobile-hamburger-menu');
    await expect(hamburgerButton).toBeVisible();

    // And: hamburger button has accessible label (in French)
    await expect(hamburgerButton).toHaveAttribute('aria-label', expect.stringContaining('Menu'));
  });

  test('[P0] [AC1] Menu hamburger opens navigation menu when clicked', async ({ page }) => {
    // Given: utilisateur sur écran < 768px avec menu hamburger visible
    await page.setViewportSize(viewports.iPhone12);

    // Network-first pattern: Intercept API calls
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [],
          total: 0,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);

    const hamburgerButton = page.getByTestId('mobile-hamburger-menu');
    await expect(hamburgerButton).toBeVisible();

    // When: utilisateur clique sur le menu hamburger
    await hamburgerButton.click();

    // Then: le menu de navigation s'ouvre
    const mobileNavMenu = page.getByTestId('mobile-navigation-menu');
    await expect(mobileNavMenu).toBeVisible();

    // And: les liens de navigation sont visibles
    const navLinks = page.getByTestId('mobile-nav-link');
    await expect(navLinks.first()).toBeVisible();
  });

  test('[P0] [AC1] Hamburger menu touch target is at least 44x44px', async ({ page }) => {
    // Given: utilisateur sur écran < 768px
    await page.setViewportSize(viewports.mobileThreshold);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [],
          total: 0,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: visualise la page principale
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: zones tactiles ≥ 44x44px
    const hamburgerButton = page.getByTestId('mobile-hamburger-menu');
    await expect(hamburgerButton).toBeVisible();

    const box = await hamburgerButton.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('[P0] [AC1] Navigation links in mobile menu have adequate touch targets', async ({ page }) => {
    // Given: utilisateur sur écran < 768px avec menu ouvert
    await page.setViewportSize(viewports.Pixel5);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [],
          total: 0,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);

    const hamburgerButton = page.getByTestId('mobile-hamburger-menu');
    await hamburgerButton.click();

    const mobileNavMenu = page.getByTestId('mobile-navigation-menu');
    await expect(mobileNavMenu).toBeVisible();

    // When: utilisateur voit les liens de navigation
    const navLinks = page.getByTestId('mobile-nav-link');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);

    // Then: chaque lien a une zone tactile ≥ 44x44px
    for (let i = 0; i < count; i++) {
      const link = navLinks.nth(i);
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('[P0] [AC1] Mobile navigation menu closes when clicking outside', async ({ page }) => {
    // Given: utilisateur sur mobile avec menu ouvert
    await page.setViewportSize(viewports.iPhone12);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [],
          total: 0,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);

    const hamburgerButton = page.getByTestId('mobile-hamburger-menu');
    await hamburgerButton.click();

    const mobileNavMenu = page.getByTestId('mobile-navigation-menu');
    await expect(mobileNavMenu).toBeVisible();

    // When: utilisateur clique en dehors du menu
    await page.mouse.click(50, 50); // Click outside the menu

    // Then: le menu se ferme
    await expect(mobileNavMenu).not.toBeVisible();
  });

  test('[P0] [AC1] Hamburger menu is hidden on desktop viewport (≥ 768px)', async ({ page }) => {
    // Given: utilisateur sur écran ≥ 768px
    await page.setViewportSize({ width: 1024, height: 768 });

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [],
          total: 0,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: visualise la page principale
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: le menu hamburger n'est pas visible
    const hamburgerButton = page.getByTestId('mobile-hamburger-menu');
    await expect(hamburgerButton).not.toBeVisible();

    // And: la navigation desktop est visible
    const desktopNav = page.getByTestId('desktop-navigation');
    await expect(desktopNav).toBeVisible();
  });

  test('[P1] [AC1] Mobile navigation is accessible with keyboard', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.Pixel5);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [],
          total: 0,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);

    // When: utilisateur navigue au clavier
    const hamburgerButton = page.getByTestId('mobile-hamburger-menu');
    await hamburgerButton.focus();
    await page.keyboard.press('Enter');

    // Then: le menu s'ouvre et est accessible
    const mobileNavMenu = page.getByTestId('mobile-navigation-menu');
    await expect(mobileNavMenu).toBeVisible();

    // And: les liens sont focusables
    const firstLink = page.getByTestId('mobile-nav-link').first();
    await firstLink.focus();
    await expect(firstLink).toBeFocused();
  });

  test('[P1] [AC1] Mobile navigation has proper ARIA attributes', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhone12);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [],
          total: 0,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);

    // When: visualise le menu hamburger
    const hamburgerButton = page.getByTestId('mobile-hamburger-menu');

    // Then: le bouton a les attributs ARIA appropriés
    await expect(hamburgerButton).toHaveAttribute('aria-expanded', 'false');
    await expect(hamburgerButton).toHaveAttribute('aria-controls', expect.stringContaining('mobile-navigation'));

    // When: utilisateur clique sur le bouton
    await hamburgerButton.click();

    // Then: aria-expanded passe à true
    await expect(hamburgerButton).toHaveAttribute('aria-expanded', 'true');
  });
});

/**
 * Test execution commands:
 *
 * Run mobile navigation tests:
 *   npx playwright test tests/e2e/mobile-navigation-3-8.spec.ts
 *
 * Run with mobile device:
 *   npx playwright test tests/e2e/mobile-navigation-3-8.spec.ts --project="Mobile Chrome"
 *
 * Run P0 tests only:
 *   npx playwright test tests/e2e/mobile-navigation-3-8.spec.ts --grep @p0
 */
