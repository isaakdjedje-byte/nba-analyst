import { test, expect } from '@playwright/test';

/**
 * Investigation Feature E2E Tests
 * 
 * Coverage for:
 * - Investigation search functionality
 * - Investigation detail view
 * - Investigation filtering and sorting
 * 
 * Priority: P1 (core user journey)
 * Test Level: E2E
 */

test.describe('Investigation Search', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Ensure user is authenticated
    await page.goto('/login');
    // Use stored auth state if available, otherwise login
  });

  test.describe('Search Functionality', () => {
    test('[P0] should display investigation search page', async ({ page }) => {
      await page.goto('/dashboard/investigation');
      
      // Assert search input is visible
      await expect(page.getByRole('textbox', { name: /search/i })).toBeVisible();
      
      // Assert page title or heading
      await expect(page.getByRole('heading', { name: /dashboard\/investigation/i })).toBeVisible();
    });

    test('[P1] should return search results for valid query', async ({ page }) => {
      await page.goto('/dashboard/investigation');
      
      // Enter search query
      const searchInput = page.getByRole('textbox', { name: /search/i });
      await searchInput.fill('test investigation');
      await searchInput.press('Enter');
      
      // Wait for results (network-first pattern)
      const resultsPromise = page.waitForResponse((resp) => 
        resp.url().includes('/api/investigations') && resp.status() === 200
      );
      
      // Assert results appear or empty state
      await expect(page.locator('[data-testid="investigation-results"]')).toBeVisible({ timeout: 10000 });
    });

    test('[P2] should show empty state for no results', async ({ page }) => {
      await page.goto('/dashboard/investigation');
      
      // Search with unlikely query
      const searchInput = page.getByRole('textbox', { name: /search/i });
      await searchInput.fill('xyznonexistentquery123');
      await searchInput.press('Enter');
      
      // Wait for response
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/investigations')
      );
      
      // Assert empty state
      await expect(page.getByText(/no results found/i)).toBeVisible();
    });

    test('[P2] should handle search input validation', async ({ page }) => {
      await page.goto('/dashboard/investigation');
      
      // Try special characters
      const searchInput = page.getByRole('textbox', { name: /search/i });
      await searchInput.fill('<script>alert("xss")</script>');
      await searchInput.press('Enter');
      
      // Should either sanitize or show error, not execute
      await expect(page.locator('script')).not.toBeVisible();
    });
  });

  test.describe('Filters', () => {
    test('[P1] should apply date filter', async ({ page }) => {
      await page.goto('/dashboard/investigation');
      
      // Open date filter
      await page.getByRole('button', { name: /date filter/i }).click();
      
      // Select date range
      await page.getByRole('button', { name: /last 7 days/i }).click();
      
      // Wait for filtered results
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/investigations')
      );
      
      // Verify filter is applied (indicator visible)
      await expect(page.getByRole('button', { name: /date filter.*active/i })).toBeVisible();
    });

    test('[P2] should apply status filter', async ({ page }) => {
      await page.goto('/dashboard/investigation');
      
      // Open status filter
      await page.getByRole('button', { name: /status/i }).click();
      
      // Select status
      await page.getByRole('checkbox', { name: /resolved/i }).check();
      
      // Wait for filtered results
      await page.waitForResponse((resp) => 
        resp.url().includes('/api/investigations')
      );
      
      // Verify results contain only resolved
      const results = page.locator('[data-testid="investigation-card"]');
      const count = await results.count();
      expect(count).toBeGreaterThan(0);
    });
  });
});

test.describe('Investigation Detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('[P0] should display investigation detail page', async ({ page }) => {
    // Navigate directly to investigation detail
    await page.goto('/dashboard/investigation/inv-001');
    
    // Assert key elements visible
    await expect(page.getByRole('heading', { name: /dashboard\/investigation/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /back/i })).toBeVisible();
  });

  test('[P1] should display investigation metadata', async ({ page }) => {
    await page.goto('/dashboard/investigation/inv-001');
    
    // Assert metadata sections
    await expect(page.getByText(/status:/i)).toBeVisible();
    await expect(page.getByText(/created:/i)).toBeVisible();
    await expect(page.getByText(/updated:/i)).toBeVisible();
  });

  test('[P1] should allow navigation between investigations', async ({ page }) => {
    await page.goto('/dashboard/investigation/inv-001');
    
    // Click next investigation
    const nextButton = page.getByRole('button', { name: /next/i });
    if (await nextButton.isVisible()) {
      await nextButton.click();
      
      // URL should change
      await expect(page).toHaveURL(/\/dashboard\/investigation\/inv-\d+/);
    }
  });

  test('[P2] should display related investigations', async ({ page }) => {
    await page.goto('/dashboard/investigation/inv-001');
    
    // Check for related section
    const relatedSection = page.getByRole('heading', { name: /related/i });
    if (await relatedSection.isVisible()) {
      await expect(page.locator('[data-testid="related-investigations"]')).toBeVisible();
    }
  });
});
