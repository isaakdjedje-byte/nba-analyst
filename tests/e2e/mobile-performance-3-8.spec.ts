/**
 * Mobile Performance E2E Tests - Story 3.8
 * ATDD Red Phase: Tests will FAIL until performance optimizations are implemented
 *
 * Story: 3.8 - Implémenter le responsive mobile-first (2-min parcours)
 * Epic: 3 - Experience Picks/No-Bet explicable (mobile-first)
 *
 * Coverage:
 * - AC4: Performance mobile (P0)
 *   - FCP < 1.5s sur 3G
 *   - TTI < 3s
 *   - CLS < 0.1
 *
 * @epic3 @story3-8 @atdd @red-phase @p0 @mobile @performance @web-vitals
 */

import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Viewport configurations for mobile devices
 */
const viewports = {
  iPhone12: { width: 390, height: 844 },
  Pixel5: { width: 393, height: 851 },
};

/**
 * Performance thresholds based on AC4 requirements
 */
const performanceThresholds = {
  fcp: 1500, // FCP < 1.5s
  tti: 3000, // TTI < 3s
  cls: 0.1, // CLS < 0.1
  lcp: 2500, // LCP < 2.5s (bonus)
  fid: 100, // FID < 100ms (bonus)
};

test.describe('Mobile Performance - Story 3.8 E2E Tests @e2e @epic3 @story3-8', () => {
  // ============================================
  // AC4: Performance mobile (P0)
  // ============================================

  test('[P0] [AC4] FCP is under 1.5 seconds on mobile 3G', async ({ page }) => {
    // Given: utilisateur sur mobile avec connexion 3G lente
    await page.setViewportSize(viewports.Pixel5);

    // Simulate slow 3G network
    await page.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.continue();
    });

    // Enable performance metrics
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    // When: page principale se charge
    const startTime = Date.now();
    await page.goto(`${baseUrl}/dashboard/picks`, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    // Collect Web Vitals metrics
    const metrics = await page.evaluate(() => {
      return {
        // @ts-ignore - PerformancePaintTiming is available in modern browsers
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        // @ts-ignore
        lcp: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0,
      };
    });

    // Then: FCP < 1.5s
    expect(metrics.fcp).toBeGreaterThan(0);
    expect(metrics.fcp).toBeLessThan(performanceThresholds.fcp);

    console.log(`FCP: ${metrics.fcp}ms (threshold: ${performanceThresholds.fcp}ms)`);
    console.log(`Page load time: ${loadTime}ms`);
  });

  test('[P0] [AC4] TTI is under 3 seconds on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhone12);

    // Network-first pattern: intercept API
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
    const startTime = Date.now();

    await page.goto(`${baseUrl}/dashboard/picks`);

    // Wait for page to be interactive
    await page.waitForLoadState('networkidle');

    // Check if main content is interactive
    const mainContent = page.getByTestId('main-content');
    await expect(mainContent).toBeVisible();

    // Try to interact with the page
    const hamburgerButton = page.getByTestId('mobile-hamburger-menu');
    if (await hamburgerButton.isVisible().catch(() => false)) {
      await hamburgerButton.click();
    }

    const tti = Date.now() - startTime;

    // Then: TTI < 3s
    expect(tti).toBeLessThan(performanceThresholds.tti);

    console.log(`TTI: ${tti}ms (threshold: ${performanceThresholds.tti}ms)`);
  });

  test('[P0] [AC4] CLS is under 0.1 on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.Pixel5);

    // Enable layout shift monitoring
    await page.evaluate(() => {
      // @ts-ignore
      window.clsValue = 0;
      // @ts-ignore
      window.clsEntries = [];

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // @ts-ignore
          if (!entry.hadRecentInput) {
            // @ts-ignore
            window.clsValue += entry.value;
            // @ts-ignore
            window.clsEntries.push(entry);
          }
        }
      });

      observer.observe({ entryTypes: ['layout-shift'] });
    });

    // Network-first pattern with delayed response to trigger layout shift
    await page.route('**/api/v1/decisions**', async (route) => {
      // Delay response to simulate slow loading
      await new Promise((resolve) => setTimeout(resolve, 500));
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

    // When: page se charge avec contenu dynamique
    await page.goto(`${baseUrl}/dashboard/picks`);

    // Wait for content to load
    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Scroll to trigger any lazy-loaded content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100); // Small delay for layout to settle

    // Get CLS value
    const clsMetrics = await page.evaluate(() => {
      // @ts-ignore
      return {
        // @ts-ignore
        cls: window.clsValue,
        // @ts-ignore
        entries: window.clsEntries.length,
      };
    });

    // Then: CLS < 0.1
    expect(clsMetrics.cls).toBeLessThan(performanceThresholds.cls);

    console.log(`CLS: ${clsMetrics.cls} (threshold: ${performanceThresholds.cls})`);
    console.log(`Layout shift entries: ${clsMetrics.entries}`);
  });

  test('[P0] [AC4] Page loads without excessive resource blocking on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhone12);

    // Track resource loading
    const resourceTimings: { url: string; duration: number }[] = [];

    await page.on('response', async (response) => {
      const timing = await response.request().timing();
      if (timing) {
        // @ts-ignore
        resourceTimings.push({
          url: response.url(),
          // @ts-ignore
          duration: timing.responseEnd - timing.startTime,
        });
      }
    });

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
    const startTime = Date.now();
    await page.goto(`${baseUrl}/dashboard/picks`, { waitUntil: 'networkidle' });
    const totalLoadTime = Date.now() - startTime;

    // Then: page charges rapidement
    expect(totalLoadTime).toBeLessThan(performanceThresholds.tti);

    // And: pas de ressources bloquantes excessives
    const slowResources = resourceTimings.filter(
      // @ts-ignore
      (r) => r.duration > 1000
    );

    expect(slowResources.length).toBeLessThanOrEqual(3); // Allow max 3 slow resources

    console.log(`Total load time: ${totalLoadTime}ms`);
    console.log(`Slow resources (>1s): ${slowResources.length}`);
  });

  test('[P1] [AC4] Images are optimized for mobile', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.Pixel5);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: [
            {
              id: 'd1',
              type: 'pick',
              match: 'Lakers vs Warriors',
              teamLogo: '/api/placeholder/400/320',
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        }),
      });
    });

    // Intercept image requests
    let imageRequests: { url: string; size: number }[] = [];
    await page.route('**/*.{png,jpg,jpeg,webp,avif}', async (route, request) => {
      const response = await route.fetch();
      const buffer = await response.body();
      imageRequests.push({
        url: request.url(),
        size: buffer.length,
      });
      await route.fulfill({ response });
    });

    // When: page avec images se charge
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Then: images sont optimisées (pas trop grandes)
    if (imageRequests.length > 0) {
      const largeImages = imageRequests.filter((img) => img.size > 100 * 1024); // > 100KB
      expect(largeImages.length).toBe(0);
    }

    console.log(`Images loaded: ${imageRequests.length}`);
    imageRequests.forEach((img) => {
      console.log(`  - ${img.url}: ${(img.size / 1024).toFixed(2)}KB`);
    });
  });

  test('[P1] [AC4] JavaScript bundles are not blocking on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhone12);

    // Track script loading
    const scriptRequests: { url: string; blocking: boolean }[] = [];

    await page.route('**/*.js', async (route, request) => {
      const headers = await request.allHeaders();
      scriptRequests.push({
        url: request.url(),
        blocking: headers['render-blocking'] === 'true' || !headers['async'],
      });
      await route.continue();
    });

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
    const startTime = Date.now();
    await page.goto(`${baseUrl}/dashboard/picks`, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    // Then: page charge rapidement malgré les scripts
    expect(loadTime).toBeLessThan(performanceThresholds.tti);

    // And: pas de scripts bloquants majeurs
    const blockingScripts = scriptRequests.filter((s) => s.blocking);
    expect(blockingScripts.length).toBeLessThanOrEqual(2);

    console.log(`Total scripts: ${scriptRequests.length}`);
    console.log(`Blocking scripts: ${blockingScripts.length}`);
  });

  test('[P1] [AC4] LCP is under 2.5 seconds on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.Pixel5);

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

    // Wait for largest contentful paint
    await page.waitForLoadState('networkidle');

    // Get LCP metric
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          // @ts-ignore
          resolve(lastEntry?.startTime || 0);
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });

        // Fallback if no LCP
        setTimeout(() => resolve(0), 5000);
      });
    });

    // Then: LCP < 2.5s
    if (lcp > 0) {
      expect(lcp).toBeLessThan(performanceThresholds.lcp);
    }

    console.log(`LCP: ${lcp}ms (threshold: ${performanceThresholds.lcp}ms)`);
  });

  test('[P2] [AC4] Performance is consistent across page navigations', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.iPhone12);

    const loadTimes: number[] = [];

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

    // When: utilisateur navigue plusieurs fois
    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      await page.goto(`${baseUrl}/dashboard/picks`, { waitUntil: 'networkidle' });
      loadTimes.push(Date.now() - startTime);

      // Clear cache between navigations
      await page.evaluate(() => {
        // @ts-ignore
        if (window.performance && window.performance.clearResourceTimings) {
          // @ts-ignore
          window.performance.clearResourceTimings();
        }
      });
    }

    // Then: les temps de chargement sont cohérents
    const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
    const maxLoadTime = Math.max(...loadTimes);
    const minLoadTime = Math.min(...loadTimes);

    expect(avgLoadTime).toBeLessThan(performanceThresholds.tti);

    // Variance should be reasonable (< 1s difference)
    expect(maxLoadTime - minLoadTime).toBeLessThan(1000);

    console.log(`Load times: ${loadTimes.join(', ')}ms`);
    console.log(`Average: ${avgLoadTime}ms`);
    console.log(`Variance: ${maxLoadTime - minLoadTime}ms`);
  });

  test('[P2] [AC4] Memory usage is reasonable on mobile', async ({ page }) => {
    // Given: utilisateur sur mobile
    await page.setViewportSize(viewports.Pixel5);

    // Network-first pattern
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          decisions: Array(20)
            .fill(null)
            .map((_, i) => ({
              id: `d${i}`,
              type: i % 2 === 0 ? 'pick' : 'no-bet',
              match: `Game ${i}`,
              createdAt: new Date().toISOString(),
            })),
          total: 20,
          page: 1,
          pageSize: 20,
        }),
      });
    });

    // When: page avec beaucoup de contenu se charge
    await page.goto(`${baseUrl}/dashboard/picks`);

    await page.waitForSelector('[data-testid="decision-card"]', { state: 'visible' });

    // Scroll through content
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(50);
    }

    // Get memory metrics (Chrome only)
    const memory = await page.evaluate(() => {
      // @ts-ignore
      return performance.memory
        ? {
            // @ts-ignore
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            // @ts-ignore
            totalJSHeapSize: performance.memory.totalJSHeapSize,
          }
        : null;
    });

    // Then: utilisation mémoire est raisonnable
    if (memory) {
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      expect(usedMB).toBeLessThan(100); // Less than 100MB
      console.log(`Memory used: ${usedMB.toFixed(2)}MB`);
    }
  });
});

/**
 * Test execution commands:
 *
 * Run performance tests:
 *   npx playwright test tests/e2e/mobile-performance-3-8.spec.ts
 *
 * Run P0 performance tests:
 *   npx playwright test tests/e2e/mobile-performance-3-8.spec.ts --grep @p0
 *
 * Run with mobile device:
 *   npx playwright test tests/e2e/mobile-performance-3-8.spec.ts --project="Mobile Chrome"
 *
 * Note: Performance tests may vary based on machine load and should be run in controlled environment
 */
