/**
 * Mobile Responsive Layout E2E Tests - Story 3.8
 * ATDD Red Phase: Tests will FAIL until responsive layout is implemented
 *
 * Story: 3.8 - Implémenter le responsive mobile-first (2-min parcours)
 * Epic: 3 - Experience Picks/No-Bet explicable (mobile-first)
 *
 * Coverage:
 * - AC2: Liste des décisions responsive (P0)
 *   - Given: utilisateur sur mobile portrait
 *   - When: visualise liste picks/no-bets
 *   - Then: cards empilées verticalement
 *   - And: 100% largeur, texte lisible
 *
 * - AC3: Breakpoints cohérents (P1)
 *   - Mobile: < 640px (sm)
 *   - Tablette: 640px - 1024px (md/lg)
 *   - Desktop: > 1024px (xl)
 *
 * @epic3 @story3-8 @atdd @red-phase @p0 @p1 @mobile @responsive
 */

import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Viewport configurations for different breakpoints
 */
const viewports = {
  // Mobile: < 640px (sm)
  iPhoneSE: { width: 375, height: 667 },
  iPhone12: { width: 390, height: 844 },
  Pixel5: { width: 393, height: 851 },

  // Tablette: 640px - 1024px (md/lg)
  iPadMini: { width: 768, height: 1024 },
  iPadPro: { width: 1024, height: 1366 },

  // Desktop: > 1024px (xl)
  desktop: { width: 1280, height: 800 },
  large: { width: 1440, height: 900 },
};

test.describe('Mobile Responsive Layout - Story 3.8 E2E Tests @e2e @epic3 @story3-8', () => {
  // ============================================
  // AC2: Liste des décisions responsive (P0)
  // ============================================

  test('[P0] [AC2] Decision cards stack vertically on mobile portrait', async ({ page }) => {
    // Given: utilisateur sur mobile portrait
    await page.setViewportSize(viewports.iPhone12);

    // Network-first pattern: Intercept API calls before navigation
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            {
              id: 'decision-1',
              type: 'pick',
              match: 'Lakers vs Warriors',
              confidence: 0.85,
              createdAt: new Date().toISOString(),
            },
            {
              id: 'decision-2',
              type: 'no-bet',
              match: 'Celtics vs Heat',
              reason: 'Low confidence',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'decision-3',
              type: 'pick',
              match: 'Nets vs Bulls',
              confidence: 0.78,
              createdAt: new Date().toISOString(),
            },
          ],
          total: 3,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: visualise liste picks/no-bets
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Wait for decisions to load (no hard waits, use waitForSelector)
    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: cards empilées verticalement
    const cards = page.getByTestId('decision-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Verify vertical stacking by checking Y positions
    const firstCard = cards.nth(0);
    const secondCard = cards.nth(1);

    const firstBox = await firstCard.boundingBox();
    const secondBox = await secondCard.boundingBox();

    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();

    if (firstBox && secondBox) {
      // Second card should be below first card (vertical stacking)
      expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height - 10);
    }
  });

  test('[P0] [AC2] Decision cards use 100% width on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.Pixel5);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            {
              id: 'decision-1',
              type: 'pick',
              match: 'Lakers vs Warriors',
              confidence: 0.85,
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: visualise la liste
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: cards utilisent 100% de la largeur
    const card = page.getByTestId('decision-card').first();
    await expect(card).toBeVisible();

    const cardBox = await card.boundingBox();
    const viewportSize = await page.viewportSize();

    expect(cardBox).not.toBeNull();
    expect(viewportSize).not.toBeNull();

    if (cardBox && viewportSize) {
      // Card should take most of the viewport width (allowing for padding)
      expect(cardBox.width).toBeGreaterThanOrEqual(viewportSize.width * 0.85);
    }
  });

  test('[P0] [AC2] Text is readable on mobile (no overflow)', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhoneSE);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            {
              id: 'decision-1',
              type: 'pick',
              match: 'Los Angeles Lakers vs Golden State Warriors',
              confidence: 0.85,
              rationale: 'Strong edge based on recent performance metrics and defensive efficiency ratings',
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: visualise la liste avec texte long
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: texte est lisible (pas de overflow horizontal)
    const card = page.getByTestId('decision-card').first();
    await expect(card).toBeVisible();

    // Check for horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);

    // And: text content is visible
    const cardText = page.getByTestId('decision-card-text');
    await expect(cardText).toBeVisible();
  });

  test('[P0] [AC2] Pick cards display correctly on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile avec des picks
    await page.setViewportSize(viewports.Pixel5);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            {
              id: 'pick-1',
              type: 'pick',
              match: 'Lakers vs Warriors',
              confidence: 0.85,
              odds: 1.75,
              stake: 2,
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: visualise la liste des picks
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: les éléments du pick sont visibles et lisibles
    const pickCard = page.getByTestId('decision-card').first();
    await expect(pickCard).toBeVisible();

    // Check pick-specific elements
    const confidenceBadge = page.getByTestId('confidence-badge');
    const oddsDisplay = page.getByTestId('odds-display');

    await expect(confidenceBadge).toBeVisible();
    await expect(oddsDisplay).toBeVisible();
  });

  test('[P0] [AC2] No-bet cards display correctly on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile avec des no-bets
    await page.setViewportSize(viewports.iPhone12);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            {
              id: 'no-bet-1',
              type: 'no-bet',
              match: 'Celtics vs Heat',
              reason: 'Low confidence score',
              confidence: 0.45,
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: visualise la liste des no-bets
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: les éléments du no-bet sont visibles
    const noBetCard = page.getByTestId('decision-card').first();
    await expect(noBetCard).toBeVisible();

    // Check no-bet specific elements
    const noBetReason = page.getByTestId('no-bet-reason');
    await expect(noBetReason).toBeVisible();

    // And: reason text is readable
    await expect(noBetReason).toContainText('Low confidence');
  });

  // ============================================
  // AC3: Breakpoints cohérents (P1)
  // ============================================

  test('[P1] [AC3] Layout adapts at mobile breakpoint (< 640px)', async ({ page }) => {
    // Given: viewport mobile < 640px
    await page.setViewportSize(viewports.iPhoneSE);

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

    // When: visualise la page
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: layout mobile est appliqué (sm breakpoint)
    const mobileLayout = page.getByTestId('layout-mobile');
    await expect(mobileLayout).toBeVisible();

    // Grid should be single column
    const grid = page.getByTestId('decisions-grid');
    const gridBox = await grid.boundingBox();
    expect(gridBox).not.toBeNull();

    if (gridBox) {
      // On mobile, grid should be narrow (single column)
      expect(gridBox.width).toBeLessThanOrEqual(400);
    }
  });

  test('[P1] [AC3] Layout adapts at tablet breakpoint (640px - 1024px)', async ({ page }) => {
    // Given: viewport tablette 640px - 1024px
    await page.setViewportSize(viewports.iPadMini);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            { id: 'd1', type: 'pick', match: 'Game 1', createdAt: new Date().toISOString() },
            { id: 'd2', type: 'pick', match: 'Game 2', createdAt: new Date().toISOString() },
          ],
          total: 2,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: visualise la page
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: layout tablette est appliqué (md/lg breakpoints)
    const tabletLayout = page.getByTestId('layout-tablet');
    const isTabletLayout = await tabletLayout.isVisible().catch(() => false);

    // Or check if cards are in multiple columns
    const cards = page.getByTestId('decision-card');
    const firstCard = cards.nth(0);
    const secondCard = cards.nth(1);

    const firstBox = await firstCard.boundingBox();
    const secondBox = await secondCard.boundingBox();

    if (firstBox && secondBox) {
      // On tablet, cards may be side by side or stacked depending on design
      // At minimum, they should be visible
      await expect(firstCard).toBeVisible();
      await expect(secondCard).toBeVisible();
    }
  });

  test('[P1] [AC3] Layout adapts at desktop breakpoint (> 1024px)', async ({ page }) => {
    // Given: viewport desktop > 1024px
    await page.setViewportSize(viewports.desktop);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            { id: 'd1', type: 'pick', match: 'Game 1', createdAt: new Date().toISOString() },
            { id: 'd2', type: 'pick', match: 'Game 2', createdAt: new Date().toISOString() },
            { id: 'd3', type: 'pick', match: 'Game 3', createdAt: new Date().toISOString() },
          ],
          total: 3,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: visualise la page
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: layout desktop est appliqué (xl breakpoint)
    const desktopLayout = page.getByTestId('layout-desktop');
    await expect(desktopLayout).toBeVisible();

    // Cards should be in multi-column grid
    const cards = page.getByTestId('decision-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // On desktop, multiple cards should be visible simultaneously
    const grid = page.getByTestId('decisions-grid');
    const gridBox = await grid.boundingBox();
    expect(gridBox).not.toBeNull();

    if (gridBox) {
      expect(gridBox.width).toBeGreaterThan(800);
    }
  });

  test('[P1] [AC3] Breakpoints transition smoothly without layout shift', async ({ page }) => {
    // Given: page loaded at mobile size
    await page.setViewportSize(viewports.iPhone12);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            { id: 'd1', type: 'pick', match: 'Game 1', createdAt: new Date().toISOString() },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // When: viewport passe à tablette
    await page.setViewportSize(viewports.iPadMini);

    // Then: pas de scrollbar horizontal (pas de layout shift majeur)
    const hasHorizontalScrollbar = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScrollbar).toBe(false);

    // When: viewport passe à desktop
    await page.setViewportSize(viewports.desktop);

    // Then: pas de scrollbar horizontal
    const hasHorizontalScrollbarDesktop = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScrollbarDesktop).toBe(false);
  });

  test('[P1] [AC3] Container max-width is applied correctly on desktop', async ({ page }) => {
    // Given: viewport desktop
    await page.setViewportSize(viewports.large);

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

    // When: visualise la page
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: container a une largeur maximale
    const mainContainer = page.getByTestId('main-container');
    await expect(mainContainer).toBeVisible();

    const containerBox = await mainContainer.boundingBox();
    expect(containerBox).not.toBeNull();

    if (containerBox) {
      // Container should have reasonable max-width (e.g., 1200-1400px)
      expect(containerBox.width).toBeGreaterThanOrEqual(1000);
      expect(containerBox.width).toBeLessThanOrEqual(1440);
    }
  });

  test('[P2] [AC2] Empty state displays correctly on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile avec liste vide
    await page.setViewportSize(viewports.Pixel5);

    // Network-first pattern: return empty list
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

    // When: visualise la liste vide
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: message vide est visible et lisible
    const emptyState = page.getByTestId('empty-state');
    await expect(emptyState).toBeVisible();

    // Check text is readable (not cut off)
    const emptyBox = await emptyState.boundingBox();
    const viewportSize = await page.viewportSize();

    if (emptyBox && viewportSize) {
      expect(emptyBox.width).toBeLessThanOrEqual(viewportSize.width);
    }
  });

  test('[P2] [AC2] Loading state displays correctly on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhone12);

    // Network-first pattern: slow response to show loading
    await page.route('**/api/v1/decisions**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
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

    // When: visualise la page pendant le chargement
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: indicateur de chargement est visible
    const loadingSpinner = page.getByTestId('loading-spinner');
    await expect(loadingSpinner).toBeVisible();

    // And: spinner is centered and visible on mobile
    const spinnerBox = await loadingSpinner.boundingBox();
    const viewportSize = await page.viewportSize();

    expect(spinnerBox).not.toBeNull();
    expect(viewportSize).not.toBeNull();

    if (spinnerBox && viewportSize) {
      // Spinner should be within viewport
      expect(spinnerBox.x).toBeGreaterThanOrEqual(0);
      expect(spinnerBox.x + spinnerBox.width).toBeLessThanOrEqual(viewportSize.width);
    }
  });
});

/**
 * Test execution commands:
 *
 * Run responsive layout tests:
 *   npx playwright test tests/e2e/mobile-responsive-layout-3-8.spec.ts
 *
 * Run P0 tests only:
 *   npx playwright test tests/e2e/mobile-responsive-layout-3-8.spec.ts --grep @p0
 *
 * Run responsive tests:
 *   npx playwright test tests/e2e/mobile-responsive-layout-3-8.spec.ts --grep @responsive
 *
 * Run with specific viewport:
 *   npx playwright test tests/e2e/mobile-responsive-layout-3-8.spec.ts --project="Mobile Chrome"
 */
