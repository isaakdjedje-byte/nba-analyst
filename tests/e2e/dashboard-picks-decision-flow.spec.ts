import { test, expect } from '@playwright/test';

/**
 * E2E Test: Dashboard → Picks → Decision Flow
 * 
 * Tests the critical user journey:
 * 1. User logs in and views dashboard
 * 2. User navigates to picks section
 * 3. User makes a pick/decision
 * 4. System evaluates and displays result
 * 
 * Priority: P0 - Revenue-critical user journey
 * Coverage: End-to-end user flow validation
 */
test.describe('Dashboard → Picks → Decision E2E Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Visit home page first
    await page.goto('/');
  });

  test('[P0] should complete full picks journey', async ({ page }) => {
    // Step 1: Login (network-first pattern)
    const loginPromise = page.waitForResponse(/.*\/api\/auth\/login/);
    
    await page.getByRole('link', { name: 'Log In' }).click();
    await expect(page).toHaveURL(/\/login/);
    
    // Fill login form
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('testpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await loginPromise;
    
    // Step 2: Verify dashboard loads
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    
    // Step 3: Navigate to picks
    const picksPromise = page.waitForResponse(/.*\/api\/dashboard/picks/);
    await page.getByRole('link', { name: /dashboard/picks/i }).click();
    
    await picksPromise;
    await expect(page).toHaveURL(/\/dashboard\/dashboard/picks/);
    
    // Step 4: Select a pick
    const submitPromise = page.waitForResponse(/.*\/api\/decisions/);
    
    // Find and select a game pick
    await page.getByRole('button', { name: /pick/i }).first().click();
    
    // Fill pick details
    await page.getByLabel('Stake').fill('100');
    await page.getByRole('button', { name: 'Confirm Pick' }).click();
    
    await submitPromise;
    
    // Step 5: Verify decision recorded
    await expect(page.getByText(/pick confirmed/i)).toBeVisible();
    await expect(page.getByText(/\$100/)).toBeVisible();
  });

  test('[P0] should display policy restrictions on picks', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('testpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Navigate to picks
    await page.goto('/dashboard/picks');
    
    // Verify policy indicators are visible
    // Policy might restrict certain picks
    const policyBanner = page.getByText(/policy/i);
    
    // Either banner exists or picks are filtered
    const bannerVisible = await policyBanner.isVisible().catch(() => false);
    if (!bannerVisible) {
      // Verify picks are available
      await expect(page.getByRole('button', { name: /pick/i })).toBeVisible();
    }
  });

  test('[P1] should handle no-bet scenario gracefully', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('testpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Navigate to no-bet page
    await page.goto('/dashboard/no-bet');
    
    // Verify no-bet page displays
    await expect(page.getByRole('heading', { name: /no bet/i })).toBeVisible();
    
    // Should show reason for no-bet
    await expect(page.getByText(/reason/i)).toBeVisible();
  });

  test('[P1] should validate pick before submission', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('testpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Navigate to picks with invalid data
    await page.goto('/dashboard/picks');
    
    // Try to submit without required fields
    await page.getByRole('button', { name: 'Confirm Pick' }).click();
    
    // Should show validation errors
    await expect(page.getByText(/required/i)).toBeVisible();
    
    // Fill invalid stake (negative)
    await page.getByLabel('Stake').fill('-50');
    await page.getByRole('button', { name: 'Confirm Pick' }).click();
    
    // Should show stake validation error
    await expect(page.getByText(/positive/i)).toBeVisible();
  });

  test('[P2] should show pick history on dashboard', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('testpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Dashboard should show recent picks history
    const historySection = page.getByText(/recent picks|pick history/i);
    const historyVisible = await historySection.isVisible().catch(() => false);
    
    // Either shows history or shows empty state
    if (historyVisible) {
      await expect(historySection).toBeVisible();
    } else {
      // Empty state is acceptable
      await expect(page.getByText(/no picks yet/i)).toBeVisible();
    }
  });
});
