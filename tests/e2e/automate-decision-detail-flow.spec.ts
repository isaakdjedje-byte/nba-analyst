import { test, expect } from '@playwright/test';
import { PolicyFactory } from '../factories/policy-factory';
import { faker } from '@faker-js/faker';

/**
 * Flux Détail Décision - Tests E2E
 * Story: Parcours utilisateur critique pour visualiser les détails d'une décision
 * Priority: P0
 * URL: /dashboard/picks/[id]
 */

test.describe('Flux Détail Décision @e2e @p0 @decision-detail', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('[P0] devrait naviguer vers la page picks et afficher les cartes de décision', async ({ page }) => {
    // Intercepter l'API des décisions avant navigation
    const decisions = [
      PolicyFactory.createPolicyEvaluationResult(faker.string.uuid(), 'Pick'),
      PolicyFactory.createPolicyEvaluationResult(faker.string.uuid(), 'No-Bet'),
      PolicyFactory.createPolicyEvaluationResult(faker.string.uuid(), 'Hard-Stop'),
    ];
    
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: decisions }),
      });
    });

    // Navigation vers la page picks
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Vérifier que les cartes sont présentes
    const cards = page.getByTestId('decision-card');
    await expect(cards).toHaveCount(3);
    
    // Vérifier la visibilité des badges de statut
    const statusBadges = page.getByTestId('status-badge');
    await expect(statusBadges.first()).toBeVisible();
  });

  test('[P0] devrait ouvrir le panneau de détails en cliquant sur une carte', async ({ page }) => {
    const decisionId = faker.string.uuid();
    const evaluationResult = PolicyFactory.createPolicyEvaluationResult(decisionId, 'Pick');
    
    // Intercepter les APIs avant navigation
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [evaluationResult] }),
      });
    });

    // Navigation
    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Cliquer sur la première carte
    const firstCard = page.getByTestId('decision-card').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    // Vérifier que le panneau de détail s'ouvre
    const detailPanel = page.getByTestId('decision-detail');
    await expect(detailPanel).toBeVisible({ timeout: 5000 });
  });

  test('[P0] devrait afficher les métadonnées correctement dans le panneau de détail', async ({ page }) => {
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [PolicyFactory.createPolicyEvaluationResult(faker.string.uuid(), 'Pick')]
        }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Ouvrir le détail
    await page.getByTestId('decision-card').first().click();
    
    // Vérifier la section métadonnées
    const metadataSection = page.getByTestId('decision-metadata');
    await expect(metadataSection).toBeVisible();
  });

  test('[P0] devrait afficher les signaux et portes de politique', async ({ page }) => {
    const decisionId = faker.string.uuid();
    const evaluationResult = PolicyFactory.createPolicyEvaluationResult(decisionId, 'Pick');
    
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [evaluationResult] }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('decision-card').first().click();
    
    // Vérifier les sections
    const signalsSection = page.getByTestId('decision-signals');
    await expect(signalsSection).toBeVisible();
    
    const gatesSection = page.getByTestId('decision-gates');
    await expect(gatesSection).toBeVisible();
  });

  test('[P1] devrait fermer le panneau de détail en cliquant sur le bouton de fermeture', async ({ page }) => {
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [PolicyFactory.createPolicyEvaluationResult(faker.string.uuid(), 'Pick')]
        }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Ouvrir puis fermer
    await page.getByTestId('decision-card').first().click();
    await page.getByRole('button', { name: /fermer|close/i }).click();
    
    // Vérifier que le panneau est fermé
    await expect(page.getByTestId('decision-detail')).not.toBeVisible();
  });

  test('[P2] devrait naviguer au clavier entre les cartes', async ({ page }) => {
    await page.route('**/api/v1/decisions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            PolicyFactory.createPolicyEvaluationResult(faker.string.uuid(), 'Pick'),
            PolicyFactory.createPolicyEvaluationResult(faker.string.uuid(), 'No-Bet'),
          ]
        }),
      });
    });

    await page.goto(`${baseUrl}/dashboard/picks`);
    await page.waitForLoadState('networkidle');

    // Navigation clavier
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Vérifier que le détail s'ouvre
    await expect(page.getByTestId('decision-detail')).toBeVisible();
  });
});
