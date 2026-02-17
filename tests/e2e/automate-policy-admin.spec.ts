import { test, expect } from '@playwright/test';
import { PolicyFactory } from '../factories/policy-factory';

/**
 * Configuration Admin Politique - Tests E2E
 * Story: Admin configure les seuils de politique
 * Priority: P0
 */

test.describe('Configuration Admin Politique @e2e @p0 @policy-admin', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test('[P0] devrait accéder à la page de configuration politique', async ({ page }) => {
    const policyConfig = PolicyFactory.createPolicyConfig();
    
    await page.route('**/api/policy/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          thresholds: {
            confidenceMin: policyConfig.confidence_threshold,
            edgeMin: policyConfig.edge_threshold,
            driftMax: policyConfig.drift_threshold,
          },
          hardStopEnabled: policyConfig.hard_stop_enabled,
          version: policyConfig.version,
        }),
      });
    });

    await page.goto(`${baseUrl}/admin/policy`);
    await page.waitForLoadState('networkidle');

    // Vérifier le titre de page
    await expect(page.getByRole('heading', { name: /configuration|politique|policy/i })).toBeVisible();
  });

  test('[P0] devrait afficher les valeurs de seuil actuelles', async ({ page }) => {
    const policyConfig = PolicyFactory.createPolicyConfig({
      confidence_threshold: 0.75,
      edge_threshold: 0.05,
      drift_threshold: 0.15,
    });
    
    await page.route('**/api/policy/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          thresholds: {
            confidenceMin: policyConfig.confidence_threshold,
            edgeMin: policyConfig.edge_threshold,
            driftMax: policyConfig.drift_threshold,
          },
          hardStopEnabled: policyConfig.hard_stop_enabled,
          version: policyConfig.version,
        }),
      });
    });

    await page.goto(`${baseUrl}/admin/policy`);
    await page.waitForLoadState('networkidle');

    // Vérifier les valeurs
    const confidenceInput = page.getByLabel(/seuil.*confiance|confidence.*threshold/i);
    await expect(confidenceInput).toHaveValue('0.75');
  });

  test('[P0] devrait modifier les seuils et persister les changements', async ({ page }) => {
    let saveRequestReceived = false;
    
    await page.route('**/api/policy/config', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            thresholds: { confidenceMin: 0.70, edgeMin: 0.05, driftMax: 0.15 },
            hardStopEnabled: true,
            version: '2.5.0',
          }),
        });
      } else if (route.request().method() === 'PUT') {
        saveRequestReceived = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, version: '2.5.1' }),
        });
      }
    });

    await page.goto(`${baseUrl}/admin/policy`);
    await page.waitForLoadState('networkidle');

    // Modifier les seuils
    const confidenceInput = page.getByLabel(/seuil.*confiance|confidence.*threshold/i);
    await confidenceInput.clear();
    await confidenceInput.fill('0.80');

    // Sauvegarder
    await page.getByRole('button', { name: /sauvegarder|save|enregistrer/i }).click();

    // Vérifier que la requête de sauvegarde a été reçue
    await expect(page.getByText(/succès|saved|enregistré/i)).toBeVisible({ timeout: 5000 });
    expect(saveRequestReceived).toBe(true);
  });

  test('[P1] devrait afficher une erreur de validation pour une valeur invalide', async ({ page }) => {
    await page.route('**/api/policy/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          thresholds: { confidenceMin: 0.70, edgeMin: 0.05, driftMax: 0.15 },
          hardStopEnabled: true,
          version: '2.5.0',
        }),
      });
    });

    await page.goto(`${baseUrl}/admin/policy`);
    await page.waitForLoadState('networkidle');

    // Essayer de mettre une valeur invalide (> 1)
    const confidenceInput = page.getByLabel(/seuil.*confiance|confidence.*threshold/i);
    await confidenceInput.clear();
    await confidenceInput.fill('1.5');
    
    // Déclencher la validation
    await page.getByRole('button', { name: /sauvegarder|save/i }).click();
    
    // Vérifier le message d'erreur
    await expect(page.getByText(/doit être entre|must be between|invalide/i)).toBeVisible();
  });
});
