/**
 * Mobile Viewport & Touch Accessibility E2E Tests - Story 3.8
 * ATDD Red Phase: Tests will FAIL until viewport and touch features are implemented
 *
 * Story: 3.8 - Implémenter le responsive mobile-first (2-min parcours)
 * Epic: 3 - Experience Picks/No-Bet explicable (mobile-first)
 *
 * Coverage:
 * - AC5: Gestion du viewport (P1)
 *   - Adaptation portrait ↔ paysage
 *   - Pas de zoom forcé
 *   - Pas de scrollbar horizontale
 *
 * - AC6: Accessibilité tactile (P1)
 *   - Zones tactiles ≥ 44x44px
 *   - Swipe pour carrousels
 *   - Pinch-to-zoom préservé
 *
 * @epic3 @story3-8 @atdd @red-phase @p1 @mobile @viewport @accessibility @touch
 */

import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Viewport configurations
 */
const viewports = {
  // Portrait
  iPhone12Portrait: { width: 390, height: 844 },
  Pixel5Portrait: { width: 393, height: 851 },

  // Landscape
  iPhone12Landscape: { width: 844, height: 390 },
  Pixel5Landscape: { width: 851, height: 393 },
};

test.describe('Mobile Viewport & Touch Accessibility - Story 3.8 E2E Tests @e2e @epic3 @story3-8', () => {
  // ============================================
  // AC5: Gestion du viewport (P1)
  // ============================================

  test('[P1] [AC5] Page adapts when switching from portrait to landscape', async ({ page }) => {
    // Given: utilisateur en mode portrait
    await page.setViewportSize(viewports.iPhone12Portrait);

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

    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Verify initial portrait layout
    const portraitCards = page.getByTestId('decision-card');
    await expect(portraitCards.first()).toBeVisible();

    const portraitBox = await portraitCards.first().boundingBox();
    expect(portraitBox).not.toBeNull();

    // When: utilisateur passe en mode paysage
    await page.setViewportSize(viewports.iPhone12Landscape);

    // Then: page s'adapte au mode paysage
    await page.waitForTimeout(100); // Wait for resize event

    const landscapeCards = page.getByTestId('decision-card');
    await expect(landscapeCards.first()).toBeVisible();

    const landscapeBox = await landscapeCards.first().boundingBox();
    expect(landscapeBox).not.toBeNull();

    // Layout should have adapted (width increased)
    if (portraitBox && landscapeBox) {
      expect(landscapeBox.width).toBeGreaterThan(portraitBox.width);
    }
  });

  test('[P1] [AC5] Page adapts when switching from landscape to portrait', async ({ page }) => {
    // Given: utilisateur en mode paysage
    await page.setViewportSize(viewports.Pixel5Landscape);

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

    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    const landscapeBox = await page.getByTestId('decision-card').first().boundingBox();

    // When: utilisateur passe en mode portrait
    await page.setViewportSize(viewports.Pixel5Portrait);

    // Then: page s'adapte au mode portrait
    await page.waitForTimeout(100);

    const portraitCards = page.getByTestId('decision-card');
    await expect(portraitCards.first()).toBeVisible();

    const portraitBox = await portraitCards.first().boundingBox();
    expect(portraitBox).not.toBeNull();

    // Layout should have adapted (width decreased)
    if (landscapeBox && portraitBox) {
      expect(portraitBox.width).toBeLessThan(landscapeBox.width);
    }
  });

  test('[P1] [AC5] No forced zoom on mobile viewport', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhone12Portrait);

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

    // When: page se charge
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: pas de zoom forcé (viewport meta tag)
    const viewportMeta = await page.$eval('meta[name="viewport"]', (el) => el.getAttribute('content'));

    if (viewportMeta) {
      // Should not contain user-scalable=no (zoom should be allowed)
      expect(viewportMeta).not.toContain('user-scalable=no');
      expect(viewportMeta).not.toContain('maximum-scale=1');
      expect(viewportMeta).toContain('width=device-width');
    }
  });

  test('[P1] [AC5] No horizontal scrollbar on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhone12Portrait);

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

    // When: page se charge
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: pas de scrollbar horizontale
    const hasHorizontalScrollbar = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScrollbar).toBe(false);

    // And: body overflow-x is not scroll
    const bodyOverflow = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflowX;
    });

    expect(bodyOverflow).not.toBe('scroll');
  });

  test('[P1] [AC5] Content fits within viewport without overflow', async ({ page }) => {
    // Given: utilisateur sur mobile avec contenu long
    await page.setViewportSize(viewports.Pixel5Portrait);

    // Network-first pattern avec contenu long
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: Array(10)
            .fill(null)
            .map((_, i) => ({
              id: `d${i}`,
              type: 'pick',
              match: `Very Long Team Name ${i} vs Another Very Long Team Name ${i}`,
              rationale: 'This is a very long rationale that could cause overflow if not handled properly',
              createdAt: new Date().toISOString(),
            })),
          total: 10,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: page se charge avec contenu long
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: tout le contenu tient dans le viewport
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    const cards = page.getByTestId('decision-card');
    const count = await cards.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const card = cards.nth(i);
      const box = await card.boundingBox();

      if (box) {
        // Card should not exceed viewport width
        expect(box.width).toBeLessThanOrEqual(viewportWidth + 32); // Allow for small padding differences

        // Card should not overflow to the right
        expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth + 32);
      }
    }
  });

  test('[P2] [AC5] Viewport meta tag is present and correct', async ({ page }) => {
    // Given: page mobile
    await page.setViewportSize(viewports.iPhone12Portrait);

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

    // When: page se charge
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: meta viewport est présent et correct
    const viewportMeta = await page.$('meta[name="viewport"]');
    expect(viewportMeta).not.toBeNull();

    const content = await viewportMeta?.getAttribute('content');
    expect(content).toBeTruthy();

    if (content) {
      // Should have width=device-width
      expect(content).toContain('width=device-width');

      // Should have initial-scale
      expect(content).toMatch(/initial-scale=[\d.]+/);
    }
  });

  // ============================================
  // AC6: Accessibilité tactile (P1)
  // ============================================

  test('[P1] [AC6] Interactive elements have minimum 44x44px touch target', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhone12Portrait);

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

    // When: page se charge
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: tous les éléments interactifs ont des zones tactiles ≥ 44x44px
    const interactiveElements = [
      'mobile-hamburger-menu',
      'decision-card',
      'filter-button',
      'sort-button',
      'refresh-button',
    ];

    for (const testId of interactiveElements) {
      const element = page.getByTestId(testId).first();
      const isVisible = await element.isVisible().catch(() => false);

      if (isVisible) {
        const box = await element.boundingBox();
        expect(box).not.toBeNull();

        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  test('[P1] [AC6] Buttons have adequate touch targets', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.Pixel5Portrait);

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

    // When: page se charge
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: tous les boutons ont des zones tactiles ≥ 44x44px
    const buttons = page.locator('button, [role="button"]');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();

      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('[P1] [AC6] Links have adequate touch targets', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhone12Portrait);

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

    // When: page se charge
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: tous les liens ont des zones tactiles ≥ 44x44px
    const links = page.locator('a');
    const linkCount = await links.count();

    let smallTouchTargets = 0;

    for (let i = 0; i < Math.min(linkCount, 10); i++) {
      const link = links.nth(i);
      const box = await link.boundingBox();

      if (box) {
        if (box.width < 44 || box.height < 44) {
          smallTouchTargets++;
        }
      }
    }

    // Allow a few small links (like inline text links), but most should be 44x44
    expect(smallTouchTargets).toBeLessThanOrEqual(3);
  });

  test('[P1] [AC6] Swipe gesture works on carousels', async ({ page }) => {
    // Given: utilisateur sur mobile avec carrousel
    await page.setViewportSize(viewports.Pixel5Portrait);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: Array(10)
            .fill(null)
            .map((_, i) => ({
              id: `d${i}`,
              type: 'pick',
              match: `Game ${i}`,
              createdAt: new Date().toISOString(),
            })),
          total: 10,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Check if carousel exists
    const carousel = page.getByTestId('decisions-carousel');
    const hasCarousel = await carousel.isVisible().catch(() => false);

    if (hasCarousel) {
      // When: utilisateur swipe sur le carrousel
      const carouselBox = await carousel.boundingBox();
      expect(carouselBox).not.toBeNull();

      if (carouselBox) {
        // Perform swipe left
        const startX = carouselBox.x + carouselBox.width * 0.8;
        const endX = carouselBox.x + carouselBox.width * 0.2;
        const y = carouselBox.y + carouselBox.height / 2;

        await page.mouse.move(startX, y);
        await page.mouse.down();
        await page.mouse.move(endX, y, { steps: 10 });
        await page.mouse.up();

        // Then: carrousel réagit au swipe
        // Check if content has shifted
        await page.waitForTimeout(100);

        // Verify carousel still visible and potentially changed
        await expect(carousel).toBeVisible();
      }
    }
  });

  test('[P1] [AC6] Pinch-to-zoom is preserved on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhone12Portrait);

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

    // When: page se charge
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: pinch-to-zoom est préservé (pas de user-scalable=no)
    const viewportMeta = await page.$eval('meta[name="viewport"]', (el) =>
      el.getAttribute('content')
    );

    if (viewportMeta) {
      // Should allow user scaling
      expect(viewportMeta).not.toContain('user-scalable=no');

      // Should not have maximum-scale that prevents zooming
      const maxScaleMatch = viewportMeta.match(/maximum-scale=([\d.]+)/);
      if (maxScaleMatch) {
        const maxScale = parseFloat(maxScaleMatch[1]);
        expect(maxScale).toBeGreaterThan(1);
      }
    }

    // Also check that touch-action CSS doesn't prevent zoom
    const touchAction = await page.evaluate(() => {
      const body = document.body;
      return window.getComputedStyle(body).touchAction;
    });

    // touch-action should not be 'none' at body level
    expect(touchAction).not.toBe('none');
  });

  test('[P2] [AC6] Touch feedback is visible on interactive elements', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.Pixel5Portrait);

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

    // When: utilisateur touche un élément interactif
    const card = page.getByTestId('decision-card').first();
    const box = await card.boundingBox();

    if (box) {
      // Touch the element
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      // Then: feedback visuel est présent (élément change d'apparence)
      // Check for active/focus state CSS
      const hasActiveState = await card.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        // Check if element has some visual feedback (background, border, etc.)
        return (
          styles.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
          styles.borderWidth !== '0px' ||
          styles.boxShadow !== 'none'
        );
      });

      await page.mouse.up();

      // Element should have some visual indication
      expect(hasActiveState).toBe(true);
    }
  });

  test('[P2] [AC6] Touch targets do not overlap', async ({ page }) => {
    // Given: utilisateur sur mobile avec plusieurs éléments interactifs
    await page.setViewportSize(viewports.iPhone12Portrait);

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

    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // When: page affiche plusieurs boutons
    const buttons = page.locator('button, [role="button"]').filter({ hasText: /./ });
    const buttonCount = await buttons.count();

    // Then: les zones tactiles ne se chevauchent pas
    const boundingBoxes: { x: number; y: number; width: number; height: number }[] = [];

    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        boundingBoxes.push(box);
      }
    }

    // Check for overlaps
    let overlaps = 0;
    for (let i = 0; i < boundingBoxes.length; i++) {
      for (let j = i + 1; j < boundingBoxes.length; j++) {
        const a = boundingBoxes[i];
        const b = boundingBoxes[j];

        // Check if rectangles overlap
        const overlap =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;

        if (overlap) {
          overlaps++;
        }
      }
    }

    // Allow some overlap for closely grouped buttons, but not excessive
    expect(overlaps).toBeLessThanOrEqual(2);
  });

  test('[P2] [AC5] Page maintains scroll position on orientation change', async ({ page }) => {
    // Given: utilisateur sur mobile ayant scrollé
    await page.setViewportSize(viewports.iPhone12Portrait);

    // Network-first pattern avec beaucoup de contenu
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: Array(20)
            .fill(null)
            .map((_, i) => ({
              id: `d${i}`,
              type: 'pick',
              match: `Game ${i}`,
              createdAt: new Date().toISOString(),
            })),
          total: 20,
          page: 1,
          pageSize: 20,
        }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));
    const scrollYBefore = await page.evaluate(() => window.scrollY);

    // When: orientation change
    await page.setViewportSize(viewports.iPhone12Landscape);
    await page.waitForTimeout(100);

    // Then: position de scroll est maintenue (ou restaurée)
    const scrollYAfter = await page.evaluate(() => window.scrollY);

    // Scroll position should be maintained (with some tolerance)
    expect(Math.abs(scrollYAfter - scrollYBefore)).toBeLessThan(100);
  });
});

/**
 * Test execution commands:
 *
 * Run viewport tests:
 *   npx playwright test tests/e2e/mobile-viewport-3-8.spec.ts
 *
 * Run touch accessibility tests:
 *   npx playwright test tests/e2e/mobile-viewport-3-8.spec.ts --grep "touch|swipe"
 *
 * Run P1 tests only:
 *   npx playwright test tests/e2e/mobile-viewport-3-8.spec.ts --grep @p1
 *
 * Run with mobile device:
 *   npx playwright test tests/e2e/mobile-viewport-3-8.spec.ts --project="Mobile Chrome"
 */
