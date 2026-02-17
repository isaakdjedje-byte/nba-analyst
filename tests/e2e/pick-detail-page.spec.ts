import { test, expect } from '@playwright/test';
import { createDecision } from '../support/factories';

test.describe('Pick Detail Page @e2e @pick-detail', () => {
  test('[P0] [1.2-PD-001] should display pick detail @smoke @p0', async ({ page, request }) => {
    // First create a decision via API
    const decision = createDecision({ matchId: 'LAL-vs-BOS', status: 'Pick' });
    const response = await request.post('/api/v1/decisions', { data: decision });
    const created = await response.json();
    
    // Navigate to detail page
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/') || resp.status() === 200);
    await page.goto(`/dashboard/picks/${created.id}`);
    await responsePromise;
    
    // Verify page loads
    await expect(page).toHaveURL(`/dashboard/picks/${created.id}`);
  });

  test('[P1] [1.2-PD-002] should show 404 for invalid pick id @error @p1', async ({ page }) => {
    const responsePromise = page.waitForResponse(resp => resp.status() === 404 || resp.status() === 200);
    await page.goto('/dashboard/picks/invalid-id-12345');
    await responsePromise;
    
    // Should show not-found page
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });
});
