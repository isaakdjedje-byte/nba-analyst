import { test, expect } from '@playwright/test';

/**
 * Tests E2E pour le dashboard d'ingestion de données
 * Priorité: P0 - Critical (suivi des données en temps réel)
 */

test.describe('[P0] Ingestion Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Given: Admin user logged in
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('admin@nba-analyst.com');
    await page.getByRole('textbox', { name: /password/i }).fill('AdminPass123!');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('[P0] should display ingestion health status on dashboard', async ({ page }) => {
    // Given: Navigate to ingestion section
    await page.goto('/admin/ingestion');

    // When: Wait for health data to load
    await expect(page.getByText(/provider health|statut des fournisseurs/i)).toBeVisible();

    // Then: All providers should show status
    await expect(page.getByTestId('provider-odds-status')).toBeVisible();
    await expect(page.getByTestId('provider-nba-status')).toBeVisible();

    // Verify health indicators
    const oddsStatus = await page.getByTestId('provider-odds-status').textContent();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(oddsStatus?.toLowerCase());
  });

  test('[P0] should show drift alerts when data schema changes', async ({ page, context }) => {
    // Given: Mock drift detection
    await context.route('/api/ingestion/drift/recent', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          drifts: [
            {
              id: 'drift-001',
              schema: 'odds',
              detectedAt: new Date().toISOString(),
              severity: 'high',
              unexpectedFields: ['new_field_1', 'extra_data'],
            },
          ],
          count: 1,
        }),
      });
    });

    // When: Navigate to drift monitoring
    await page.goto('/admin/ingestion/drift');

    // Then: Drift alert should be visible
    await expect(page.getByText(/schema drift|changement de schéma/i)).toBeVisible();
    await expect(page.getByText('new_field_1')).toBeVisible();
    await expect(page.getByRole('button', { name: /review|examiner/i })).toBeVisible();
  });

  test('[P1] should allow manual trigger of data ingestion', async ({ page }) => {
    // Given: On ingestion dashboard
    await page.goto('/admin/ingestion');

    // When: Click manual trigger button
    await page.getByRole('button', { name: /trigger ingestion|lancer ingestion/i }).click();

    // Then: Should show loading state
    await expect(page.getByText(/ingestion in progress|ingestion en cours/i)).toBeVisible();

    // And: Should complete with success
    await expect(page.getByText(/completed|terminé/i)).toBeVisible({ timeout: 30000 });
  });

  test('[P1] should display ingestion logs with filtering', async ({ page }) => {
    // Given: On logs page
    await page.goto('/admin/ingestion/logs');

    // When: Wait for logs to load
    await expect(page.getByText(/ingestion logs|journaux/i)).toBeVisible();

    // Then: Log entries should be visible
    const logRows = page.getByTestId('log-row');
    await expect(logRows.first()).toBeVisible();

    // When: Filter by provider
    await page.getByRole('combobox', { name: /provider|fournisseur/i }).selectOption('odds');

    // Then: Filtered results should show
    await expect(page.getByText(/filtered|filtré/i)).toBeVisible();
  });

  test('[P1] should navigate to provider configuration', async ({ page }) => {
    // Given: On ingestion dashboard
    await page.goto('/admin/ingestion');

    // When: Click provider settings
    await page.getByRole('link', { name: /configure|configurer/i }).first().click();

    // Then: Should navigate to config page
    await expect(page).toHaveURL(/\/admin\/ingestion\/config/);
    await expect(page.getByText(/provider configuration|configuration/i)).toBeVisible();
  });
});

test.describe('[P0] Admin User Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Given: Super admin logged in
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('superadmin@nba-analyst.com');
    await page.getByRole('textbox', { name: /password/i }).fill('SuperAdmin123!');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('[P0] should create new user and assign role', async ({ page }) => {
    // Given: On user management page
    await page.goto('/admin/users');

    // When: Click add user
    await page.getByRole('button', { name: /add user|nouvel utilisateur/i }).click();

    // Then: Modal should open
    await expect(page.getByRole('dialog')).toBeVisible();

    // When: Fill user form
    const timestamp = Date.now();
    await page.getByLabel(/email/i).fill(`newuser${timestamp}@example.com`);
    await page.getByLabel(/name|nom/i).fill('Test User');
    await page.getByRole('combobox', { name: /role/i }).selectOption('analyst');

    // And: Submit form
    await page.getByRole('button', { name: /create|créer/i }).click();

    // Then: Success message should appear
    await expect(page.getByText(/user created|utilisateur créé/i)).toBeVisible();

    // And: New user should be in list
    await expect(page.getByText(`newuser${timestamp}@example.com`)).toBeVisible();
  });

  test('[P0] should change user role and verify permissions', async ({ page }) => {
    // Given: Existing user
    await page.goto('/admin/users');

    // When: Find user and open role editor
    await page.getByText('analyst@nba-analyst.com').click();
    await page.getByRole('button', { name: /edit role|modifier rôle/i }).click();

    // When: Change role
    await page.getByRole('combobox', { name: /role/i }).selectOption('admin');
    await page.getByRole('button', { name: /save|enregistrer/i }).click();

    // Then: Success confirmation
    await expect(page.getByText(/role updated|rôle mis à jour/i)).toBeVisible();

    // When: Verify in audit log
    await page.goto('/admin/audit');
    await expect(page.getByText(/role changed|rôle modifié/i)).toBeVisible();
  });
});

test.describe('[P1] Cache Monitoring E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('admin@nba-analyst.com');
    await page.getByRole('textbox', { name: /password/i }).fill('AdminPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('[P1] should display cache statistics', async ({ page }) => {
    // Given: Navigate to cache monitoring
    await page.goto('/admin/monitoring/cache');

    // When: Wait for metrics to load
    await expect(page.getByText(/cache statistics|statistiques cache/i)).toBeVisible();

    // Then: Metrics should be visible
    await expect(page.getByText(/hit rate|taux de réussite/i)).toBeVisible();
    await expect(page.getByText(/memory usage|mémoire utilisée/i)).toBeVisible();

    // Verify numeric values present
    const hitRateText = await page.getByTestId('hit-rate').textContent();
    expect(hitRateText).toMatch(/\d+%/);
  });

  test('[P1] should allow manual cache invalidation', async ({ page }) => {
    // Given: On cache admin page
    await page.goto('/admin/monitoring/cache');

    // When: Click invalidate cache
    await page.getByRole('button', { name: /invalidate|vider/i }).click();

    // Then: Confirmation dialog
    await expect(page.getByText(/confirm|confirmer/i)).toBeVisible();

    // When: Confirm
    await page.getByRole('button', { name: /yes|oui/i }).click();

    // Then: Success message
    await expect(page.getByText(/cache cleared|cache vidé/i)).toBeVisible();
  });
});
