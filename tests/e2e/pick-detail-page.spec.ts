import { test, expect } from '@playwright/test';
import { createDecision } from '../support/factories';

test.describe('Pick Detail Page @e2e @pick-detail', () => {
  test('[P0] should display pick detail @smoke @p0', async ({ page, request }) => {
    // First create a decision via API
    const decision = createDecision({ matchId: 'LAL-vs-BOS', status: 'Pick' });
    const response = await request.post('/api/decisions', { data: decision });
    const created = await response.json();
    
    // Navigate to detail page
    await page.goto(`/dashboard/picks/${created.id}`);
    
    // Verify page loads
    await expect(page).toHaveURL(`/dashboard/picks/${created.id}`);
  });

  test('[P1] should show 404 for invalid pick id @error @p1', async ({ page }) => {
    await page.goto('/dashboard/picks/invalid-id-12345');
    
    // Should show not-found page
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });
});
