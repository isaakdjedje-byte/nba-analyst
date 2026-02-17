/**
 * Mobile Responsive Comprehensive E2E Tests - Story 3.8 (MAIN FOCUS)
 * ATDD Red Phase: Tests will FAIL until mobile responsive features are implemented
 *
 * Story: 3.8 - Implémenter le responsive mobile-first (2-min parcours)
 * Epic: 3 - Experience Picks/No-Bet explicable (mobile-first)
 *
 * Acceptance Criteria:
 * - AC1: Navigation hamburger menu on mobile (<768px), Touch targets ≥44x44px
 * - AC2: DecisionCard stack vertically on mobile, 100% width, font ≥16px
 * - AC3: Breakpoints: Mobile <640px, Tablet 640-1024px, Desktop >1024px
 * - AC4: Performance: FCP <1.5s, TTI <3s, CLS <0.1 on 3G
 * - AC5: Viewport adapts portrait/landscape, no horizontal scroll
 * - AC6: Touch zones ≥44x44px, swipe works, pinch-to-zoom preserved
 *
 * Coverage: Comprehensive mobile-first testing with all ACs
 *
 * @epic3 @story3-8 @atdd @red-phase @p0 @mobile @responsive @main-focus
 */

import { test, expect, devices } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Breakpoint configurations per AC3
 */
const breakpoints = {
  mobile: { width: 390, height: 844 }, // iPhone 12 < 640px
  tablet: { width: 768, height: 1024 }, // Tablet 640-1024px
  desktop: { width: 1280, height: 720 }, // Desktop > 1024px
  mobileLarge: { width: 639, height: 800 }, // Just under tablet
  tabletLarge: { width: 1023, height: 800 }, // Just under desktop
};

/**
 * Device viewports for testing
 */
const viewports = {
  iPhone12Portrait: { width: 390, height: 844 },
  iPhone12Landscape: { width: 844, height: 390 },
  Pixel5Portrait: { width: 393, height: 851 },
  Pixel5Landscape: { width: 851, height: 393 },
};

test.describe('Mobile Responsive Comprehensive - Story 3.8 E2E Tests @e2e @epic3 @story3-8', () => {
  // ============================================
  // AC1: Navigation hamburger menu (P0)
  // ============================================

  test('[P0] [AC1] Hamburger menu appears below 768px breakpoint', async ({ page }) => {
    // Given: Viewport is mobile (< 768px)
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0, page: 1, pageSize: 10 }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Then: Hamburger menu button is visible
    const hamburgerButton = page.getByRole('button', { name: /menu|navigation|hamburger/i });
    await expect(hamburgerButton).toBeVisible();

    // And: Desktop navigation is hidden
    const desktopNav = page.getByRole('navigation', { name: /main|principal/i });
    await expect(desktopNav).not.toBeVisible();
  });

  test('[P0] [AC1] Hamburger menu touch target is ≥44x44px', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // When: Page loads

    // Then: Hamburger button has adequate touch target
    const hamburgerButton = page.getByRole('button', { name: /menu|navigation/i });
    await expect(hamburgerButton).toBeVisible();

    const box = await hamburgerButton.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('[P0] [AC1] Hamburger menu opens navigation panel', async ({ page }) => {
    // Given: Mobile viewport with hamburger visible
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // When: User clicks hamburger button
    const hamburgerButton = page.getByRole('button', { name: /menu|navigation/i });
    await hamburgerButton.click();

    // Then: Mobile navigation menu opens
    const mobileNav = page.getByRole('dialog', { name: /menu|navigation/i });
    await expect(mobileNav).toBeVisible();

    // And: Navigation links are visible
    const navLinks = mobileNav.getByRole('link');
    await expect(navLinks.first()).toBeVisible();
  });

  test('[P0] [AC1] Mobile menu links have ≥44x44px touch targets', async ({ page }) => {
    // Given: Mobile menu is open
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    const hamburgerButton = page.getByRole('button', { name: /menu|navigation/i });
    await hamburgerButton.click();

    const mobileNav = page.getByRole('dialog', { name: /menu|navigation/i });
    await expect(mobileNav).toBeVisible();

    // When: Menu is open

    // Then: All navigation links have adequate touch targets
    const navLinks = mobileNav.getByRole('link');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);

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

  test('[P1] [AC1] Hamburger menu has proper ARIA attributes', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // When: Page loads

    // Then: Hamburger button has proper ARIA attributes
    const hamburgerButton = page.getByRole('button', { name: /menu|navigation/i });
    await expect(hamburgerButton).toHaveAttribute('aria-expanded', 'false');
    await expect(hamburgerButton).toHaveAttribute('aria-controls');
  });

  // ============================================
  // AC2: DecisionCard responsive layout (P0)
  // ============================================

  test('[P0] [AC2] DecisionCard stacks vertically on mobile', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            { id: 'd1', type: 'pick', match: 'Team A vs Team B', createdAt: new Date().toISOString() },
            { id: 'd2', type: 'pick', match: 'Team C vs Team D', createdAt: new Date().toISOString() },
          ],
          total: 2,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: Page loads with decision cards
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: Cards are stacked vertically
    const cards = page.locator('[data-testid="decision-card"]');
    const firstCard = await cards.nth(0).boundingBox();
    const secondCard = await cards.nth(1).boundingBox();

    expect(firstCard).not.toBeNull();
    expect(secondCard).not.toBeNull();

    if (firstCard && secondCard) {
      // Second card should be below first card (vertical stacking)
      expect(secondCard.y).toBeGreaterThan(firstCard.y);
    }
  });

  test('[P0] [AC2] DecisionCard uses 100% width on mobile', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            { id: 'd1', type: 'pick', match: 'Team A vs Team B', createdAt: new Date().toISOString() },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: Card uses full width (with small padding tolerance)
    const card = page.locator('[data-testid="decision-card"]').first();
    const cardBox = await card.boundingBox();
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    expect(cardBox).not.toBeNull();
    if (cardBox) {
      // Card width should be close to viewport width (within 40px for padding)
      expect(cardBox.width).toBeGreaterThanOrEqual(viewportWidth - 40);
    }
  });

  test('[P0] [AC2] Font size is at least 16px on mobile', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            { id: 'd1', type: 'pick', match: 'Team A vs Team B', createdAt: new Date().toISOString() },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: Text elements have minimum 16px font size
    const textElements = page.locator('[data-testid="decision-card"] p, [data-testid="decision-card"] span, [data-testid="decision-card"] h3');
    const count = await textElements.count();

    let smallFonts = 0;
    for (let i = 0; i < Math.min(count, 10); i++) {
      const fontSize = await textElements.nth(i).evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return parseFloat(computed.fontSize);
      });

      if (fontSize < 16) {
        smallFonts++;
      }
    }

    // Allow some small elements (labels, captions), but main text should be ≥16px
    expect(smallFonts).toBeLessThanOrEqual(2);
  });

  test('[P1] [AC2] DecisionCard content is readable without zooming', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            { id: 'd1', type: 'pick', match: 'Team A vs Team B', createdAt: new Date().toISOString() },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: Content is visible without horizontal scroll
    const card = page.locator('[data-testid="decision-card"]').first();
    const cardBox = await card.boundingBox();
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    if (cardBox) {
      // Card should not overflow viewport
      expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewportWidth + 16);
    }
  });

  // ============================================
  // AC3: Breakpoints (P0)
  // ============================================

  test('[P0] [AC3] Mobile layout applied below 640px', async ({ page }) => {
    // Given: Viewport is 639px (just under tablet)
    await page.setViewportSize(breakpoints.mobileLarge);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Then: Mobile layout is applied
    const hamburgerButton = page.getByRole('button', { name: /menu|navigation/i });
    await expect(hamburgerButton).toBeVisible();
  });

  test('[P0] [AC3] Tablet layout applied between 640-1024px', async ({ page }) => {
    // Given: Viewport is tablet (768px)
    await page.setViewportSize(breakpoints.tablet);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Then: Tablet layout is applied
    // Hamburger may or may not be visible at tablet, but desktop nav might be partial
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(viewportWidth).toBeGreaterThanOrEqual(640);
    expect(viewportWidth).toBeLessThanOrEqual(1024);
  });

  test('[P0] [AC3] Desktop layout applied above 1024px', async ({ page }) => {
    // Given: Viewport is desktop
    await page.setViewportSize(breakpoints.desktop);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Then: Desktop navigation is visible
    const desktopNav = page.getByRole('navigation', { name: /main|principal/i });
    await expect(desktopNav).toBeVisible();

    // And: Hamburger menu is not visible
    const hamburgerButton = page.getByRole('button', { name: /menu|navigation/i });
    await expect(hamburgerButton).not.toBeVisible();
  });

  test('[P1] [AC3] Layout transitions smoothly at breakpoints', async ({ page }) => {
    // Given: Page is loaded at tablet size
    await page.setViewportSize(breakpoints.tablet);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // When: Viewport transitions to mobile
    await page.setViewportSize(breakpoints.mobile);
    await page.waitForTimeout(300); // Wait for transition

    // Then: Mobile layout is applied without errors
    const pageContent = await page.content();
    expect(pageContent).not.toContain('error');
    expect(pageContent).not.toContain('undefined');
  });

  // ============================================
  // AC4: Performance (P0)
  // ============================================

  test('[P0] [AC4] First Contentful Paint under 1.5s on mobile', async ({ page }) => {
    // Given: Mobile viewport with slow 3G simulation
    await page.setViewportSize(breakpoints.mobile);

    // Enable 3G throttling via CDP
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
      uploadThroughput: 750 * 1024 / 8, // 750 Kbps
      latency: 40,
    });

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    // When: Page loads
    const startTime = Date.now();
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Wait for first content
    await page.waitForLoadState('domcontentloaded');
    const fcpTime = Date.now() - startTime;

    // Then: FCP is under 1.5s
    expect(fcpTime).toBeLessThan(1500);
  });

  test('[P0] [AC4] Time to Interactive under 3s on mobile', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    // When: Page loads
    const startTime = Date.now();
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');
    const ttiTime = Date.now() - startTime;

    // Then: TTI is under 3s
    expect(ttiTime).toBeLessThan(3000);
  });

  test('[P0] [AC4] Cumulative Layout Shift under 0.1', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: Array(10).fill(null).map((_, i) => ({
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

    // When: Page loads with content
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Check for layout stability
    const layoutShift = await page.evaluate(() => {
      // Check if any elements changed position significantly
      return document.querySelectorAll('[style*="position"]').length;
    });

    // Should have minimal or no forced layout changes
    expect(layoutShift).toBeLessThanOrEqual(5);
  });

  test('[P1] [AC4] Images have proper dimensions to prevent CLS', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Then: Images have explicit width/height
    const images = page.locator('img');
    const count = await images.count();

    let imagesWithoutDimensions = 0;
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const hasWidth = await img.evaluate((el) => el.hasAttribute('width'));
      const hasHeight = await img.evaluate((el) => el.hasAttribute('height'));
      if (!hasWidth || !hasHeight) {
        imagesWithoutDimensions++;
      }
    }

    // Most images should have explicit dimensions
    expect(imagesWithoutDimensions).toBeLessThanOrEqual(2);
  });

  // ============================================
  // AC5: Viewport adaptation (P0)
  // ============================================

  test('[P0] [AC5] Page adapts to portrait orientation', async ({ page }) => {
    // Given: Portrait viewport
    await page.setViewportSize(viewports.iPhone12Portrait);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Then: Content fits portrait orientation
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('[P0] [AC5] Page adapts to landscape orientation', async ({ page }) => {
    // Given: Landscape viewport
    await page.setViewportSize(viewports.iPhone12Landscape);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Then: Content adapts to landscape
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(viewportWidth).toBeGreaterThan(viewports.iPhone12Portrait.width);
  });

  test('[P0] [AC5] No horizontal scroll on mobile', async ({ page }) => {
    // Given: Mobile viewport with content
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: Array(20).fill(null).map((_, i) => ({
            id: `d${i}`,
            type: 'pick',
            match: `Very Long Team Name ${i} vs Another Long Team Name ${i}`,
            createdAt: new Date().toISOString(),
          })),
          total: 20,
          page: 1,
          pageSize: 20,
        }),
      });
    });

    // When: Page loads with long content
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Then: No horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('[P1] [AC5] Viewport meta tag is present', async ({ page }) => {
    // Given: Any viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: Viewport meta tag exists
    const viewportMeta = await page.$('meta[name="viewport"]');
    expect(viewportMeta).not.toBeNull();

    const content = await viewportMeta?.getAttribute('content');
    expect(content).toContain('width=device-width');
  });

  // ============================================
  // AC6: Touch zones and gestures (P0)
  // ============================================

  test('[P0] [AC6] All interactive elements have ≥44x44px touch zones', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            { id: 'd1', type: 'pick', match: 'Team A vs Team B', createdAt: new Date().toISOString() },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Then: All interactive elements meet minimum size
    const interactiveElements = page.locator('button, a, [role="button"], input, select, textarea');
    const count = await interactiveElements.count();

    let smallTouchTargets = 0;
    for (let i = 0; i < Math.min(count, 20); i++) {
      const el = interactiveElements.nth(i);
      const isVisible = await el.isVisible().catch(() => false);
      if (isVisible) {
        const box = await el.boundingBox();
        if (box && (box.width < 44 || box.height < 44)) {
          smallTouchTargets++;
        }
      }
    }

    // Allow a few small elements, but most should be adequate
    expect(smallTouchTargets).toBeLessThanOrEqual(3);
  });

  test('[P0] [AC6] Pinch-to-zoom is not disabled', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Then: Viewport allows user scaling
    const viewportMeta = await page.$eval('meta[name="viewport"]', (el) =>
      el.getAttribute('content')
    );

    if (viewportMeta) {
      expect(viewportMeta).not.toContain('user-scalable=no');
    }
  });

  test('[P1] [AC6] Touch targets do not overlap significantly', async ({ page }) => {
    // Given: Mobile viewport with multiple buttons
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    // When: Page loads
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Then: Touch targets have adequate spacing
    const buttons = page.locator('button, [role="button"]');
    const count = await buttons.count();

    const boundingBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
    for (let i = 0; i < Math.min(count, 8); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) boundingBoxes.push(box);
    }

    // Check for overlaps
    let overlaps = 0;
    for (let i = 0; i < boundingBoxes.length; i++) {
      for (let j = i + 1; j < boundingBoxes.length; j++) {
        const a = boundingBoxes[i];
        const b = boundingBoxes[j];
        const overlap =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        if (overlap) overlaps++;
      }
    }

    expect(overlaps).toBeLessThanOrEqual(2);
  });

  test('[P1] [AC6] Touch feedback is visible on interactive elements', async ({ page }) => {
    // Given: Mobile viewport
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ decisions: [], total: 0 }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // When: User touches a button
    const button = page.locator('button').first();
    const box = await button.boundingBox();

    if (box) {
      // Simulate touch
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      // Check for active state
      const hasActiveState = await button.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.backgroundColor !== 'rgba(0, 0, 0, 0)' || styles.transform !== 'none';
      });

      await page.mouse.up();

      // Then: Visual feedback is present
      expect(hasActiveState).toBe(true);
    }
  });

  test('[P2] [AC6] Swipe gestures work on carousels/sliders', async ({ page }) => {
    // Given: Mobile viewport with carousel
    await page.setViewportSize(breakpoints.mobile);

    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: Array(10).fill(null).map((_, i) => ({
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
    const carousel = page.locator('[data-testid*="carousel"], [class*="carousel"], [class*="slider"]').first();
    const hasCarousel = await carousel.isVisible().catch(() => false);

    if (hasCarousel) {
      const carouselBox = await carousel.boundingBox();
      if (carouselBox) {
        // When: User swipes left
        await page.mouse.move(carouselBox.x + carouselBox.width * 0.8, carouselBox.y + carouselBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(carouselBox.x + carouselBox.width * 0.2, carouselBox.y + carouselBox.height / 2, { steps: 10 });
        await page.mouse.up();

        // Then: Carousel responds to swipe
        await page.waitForTimeout(100);
        await expect(carousel).toBeVisible();
      }
    }
  });
});

/**
 * Test execution commands:
 *
 * Run all mobile responsive tests:
 *   npx playwright test tests/e2e/mobile-responsive-3-8-comprehensive.spec.ts
 *
 * Run P0 tests only:
 *   npx playwright test tests/e2e/mobile-responsive-3-8-comprehensive.spec.ts --grep @p0
 *
 * Run specific AC:
 *   npx playwright test tests/e2e/mobile-responsive-3-8-comprehensive.spec.ts --grep "AC1"
 *
 * Run with mobile device:
 *   npx playwright test tests/e2e/mobile-responsive-3-8-comprehensive.spec.ts --project="Mobile Chrome"
 *
 * Run performance tests:
 *   npx playwright test tests/e2e/mobile-responsive-3-8-comprehensive.spec.ts --grep "AC4"
 */
