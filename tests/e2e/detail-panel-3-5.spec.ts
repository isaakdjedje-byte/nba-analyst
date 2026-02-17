/**
 * DetailPanel E2E Tests - Story 3.5 (ACTIVE)
 *
 * Ces tests vérifient les fonctionnalités de Story 3.5 dans un contexte end-to-end:
 * - AC1: Expansion déclenchée par interaction
 * - AC2: Contenu détails complet (confidence, edge, gates)
 * - AC3: Affichage gate outcomes détaillé
 * - AC4: Data signals et métadonnées
 * - AC5: Rétraction du panneau
 * - AC6: État persistant par session
 * - AC7: Performance expansion (mobile)
 * - AC8: Accessibilité expansion
 * - AC9: États dégradés et erreurs
 *
 * Statut: ACTIVE - Tests activés après implémentation Story 3.5
 * Date d'activation: 2026-02-14
 */

import { test, expect, type Page } from '@playwright/test';

// =============================================================================
// TEST FIXTURES & HELPERS
// =============================================================================

test.describe('DetailPanel - Story 3.5 E2E Tests @epic3', () => {
  
  // Test data matching DecisionDetail type from the story
  const mockDecisionWithDetails = {
    id: 'dec-123',
    match: {
      homeTeam: 'Lakers',
      awayTeam: 'Warriors',
      startTime: '2026-02-14T20:00:00Z',
    },
    status: 'PICK' as const,
    edge: 0.052,
    confidence: 0.78,
    rationale: 'Strong favorite with home court advantage',
    
    // Detailed content (AC2, AC3, AC4)
    confidenceBreakdown: {
      mlConfidence: 0.85,
      historicalAccuracy: 0.72,
      sampleSize: 1500,
      adjustedConfidence: 0.78,
    },
    edgeCalculation: {
      impliedProbability: 0.45,
      predictedProbability: 0.52,
      edge: 0.052,
      marketOdds: 2.22,
      fairOdds: 1.92,
    },
    gates: [
      {
        name: 'Minimum Edge',
        passed: true,
        threshold: 0.03,
        actual: 0.052,
        description: 'Edge must exceed 3%',
        evaluatedAt: '2026-02-14T18:00:00Z',
      },
      {
        name: 'Confidence Threshold',
        passed: true,
        threshold: 0.60,
        actual: 0.78,
        description: 'Confidence must exceed 60%',
        evaluatedAt: '2026-02-14T18:00:00Z',
      },
      {
        name: 'Data Freshness',
        passed: false,
        threshold: 3600,
        actual: 7200,
        description: 'Data must be less than 1 hour old',
        evaluatedAt: '2026-02-14T18:00:00Z',
      },
    ],
    dataSignals: {
      sources: [
        {
          name: 'Odds API',
          freshness: '2026-02-14T17:30:00Z',
          reliability: 0.95,
        },
        {
          name: 'Injury Report',
          freshness: '2026-02-14T16:00:00Z',
          reliability: 0.88,
        },
      ],
      mlModelVersion: 'v2.3.1',
      trainingDate: '2026-01-15T00:00:00Z',
    },
    metadata: {
      traceId: 'trace-abc123-def456',
      timestamp: '2026-02-14T18:00:00Z',
      policyVersion: 'policy-v3',
      runId: 'run-20260214-001',
      createdBy: 'policy-engine',
    },
  };

  // Helper to navigate to picks page
  async function navigateToPicks(page: Page) {
    await page.goto('/dashboard/picks');
    await page.waitForLoadState('networkidle');
  }

  // Helper to mock API response with decision details
  async function mockDecisionDetailsApi(page: Page, decision: unknown) {
    await page.route('/api/v1/decisions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(decision),
      });
    });
  }

  // =============================================================================
  // AC1: EXPANSION DÉCLENCHÉE PAR INTERACTION
  // =============================================================================

  test.describe('AC1: Expansion déclenchée par interaction', () => {

    test('[P0] should expand card on click', async ({ page }) => {
      // CE TEST VA ÉCHOUER - DetailPanel non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      // Trouver le bouton d'expansion
      const expandButton = page.getByRole('button', { name: /voir plus|more details|expand/i });
      await expect(expandButton).toBeVisible();
      
      // Cliquer pour expanser
      await expandButton.click();
      
      // Le panneau détaillé devrait être visible
      const detailPanel = page.getByTestId('detail-panel');
      await expect(detailPanel).toBeVisible();
    });

    test('[P0] should expand card on card click', async ({ page }) => {
      // CE TEST VA ÉCHOUER - DetailPanel non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      // Cliquer sur la carte elle-même
      const card = page.getByTestId('decision-card').first();
      await card.click();
      
      // Le panneau détaillé devrait être visible
      const detailPanel = page.getByTestId('detail-panel');
      await expect(detailPanel).toBeVisible();
    });

    test('[P1] should expand with smooth animation', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Animation non implémentée
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      const detailPanel = page.getByTestId('detail-panel');
      
      // Cliquer et vérifier l'animation
      await expandButton.click();
      
      // Devrait avoir des classes de transition
      await expect(detailPanel).toHaveClass(/transition|animate|duration-300/i);
    });

    test('[P1] should move focus to expanded content', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Gestion du focus non implémentée
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Le focus devrait se déplacer vers le contenu expansé
      const detailPanel = page.getByTestId('detail-panel');
      await expect(detailPanel).toBeFocused();
    });
  });

  // =============================================================================
  // AC2: CONTENU DÉTAILS COMPLET
  // =============================================================================

  test.describe('AC2: Contenu détails complet', () => {

    test('[P0] should display confidence breakdown', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Confidence breakdown non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Devrait afficher la répartition de confiance
      const confidenceSection = page.getByText(/confidence.*breakdown|répartition.*confiance/i);
      await expect(confidenceSection).toBeVisible();
      
      // Devrait afficher les valeurs détaillées
      await expect(page.getByText(/mlConfidence|ML Confidence/i)).toBeVisible();
      await expect(page.getByText(/78%|0.78/)).toBeVisible();
    });

    test('[P0] should display edge calculation breakdown', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Edge calculation non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Devrait afficher le calcul d'edge
      const edgeSection = page.getByText(/edge.*calculation|calcul.*avantage/i);
      await expect(edgeSection).toBeVisible();
      
      // Devrait afficher les valeurs
      await expect(page.getByText(/5.2%|0.052/)).toBeVisible();
    });

    test('[P1] should explain technical terms with tooltips', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Tooltips non implémentés
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Devrait avoir des tooltips sur les termes techniques
      const tooltipIcon = page.locator('[data-testid="tooltip-icon"]').first();
      await expect(tooltipIcon).toBeVisible();
    });
  });

  // =============================================================================
  // AC3: AFFICHAGE GATE OUTCOMES DÉTAILLÉ
  // =============================================================================

  test.describe('AC3: Affichage gate outcomes détaillé', () => {

    test('[P0] should display all gates with threshold and actual values', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Gates détaillées non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Devrait afficher chaque gate
      await expect(page.getByText('Minimum Edge')).toBeVisible();
      await expect(page.getByText('Confidence Threshold')).toBeVisible();
      await expect(page.getByText('Data Freshness')).toBeVisible();
      
      // Devrait afficher les seuils et valeurs réelles
      await expect(page.getByText(/Seuil:|Threshold:/i)).toBeVisible();
      await expect(page.getByText(/Réel:|Actual:/i)).toBeVisible();
    });

    test('[P0] should visually distinguish failed gates', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Visualisation des gates échoués non implémentée
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Le gate Data Freshness a échoué - devrait être visuellement distinct
      const failedGate = page.getByText('Data Freshness').locator('../..');
      await expect(failedGate).toHaveClass(/text-red|red-|failed|échoué/i);
    });

    test('[P1] should order gates by evaluation sequence', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Ordonnancement des gates non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Les gates devraient être dans l'ordre d'évaluation
      const gates = page.getByTestId('gate-item');
      const firstGate = await gates.nth(0).textContent();
      expect(firstGate).toContain('Minimum Edge');
    });

    test('[P1] should show gate descriptions', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Descriptions des gates non implémentées
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Devrait afficher les descriptions
      await expect(page.getByText(/Edge must exceed 3%/i)).toBeVisible();
    });
  });

  // =============================================================================
  // AC4: DATA SIGNALS ET MÉTADONNÉES
  // =============================================================================

  test.describe('AC4: Data signals et métadonnées', () => {

    test('[P1] should display data source signatures', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Data signals non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Devrait afficher les sources de données
      await expect(page.getByText('Odds API')).toBeVisible();
      await expect(page.getByText('Injury Report')).toBeVisible();
    });

    test('[P1] should display ML model version', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Version ML non affichée
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Devrait afficher la version du modèle ML
      await expect(page.getByText(/ML.*version|model.*v2/i)).toBeVisible();
    });

    test('[P1] should display timestamp and traceId', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Métadonnées non affichées
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Devrait afficher le timestamp
      await expect(page.getByText(/2026-02-14|timestamp/i)).toBeVisible();
      
      // Devrait afficher le traceId
      await expect(page.getByText(/trace-abc123/)).toBeVisible();
    });

    test('[P2] should allow copying traceId to clipboard', async ({ page, context }) => {
      // CE TEST VA ÉCHOUER - Fonctionnalité copy non implémentée
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Cliquer sur le bouton de copie
      const copyButton = page.getByRole('button', { name: /copy|copier/i });
      await copyButton.click();
      
      // Vérifier le contenu du presse-papiers
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardContent).toContain('trace-abc123');
    });
  });

  // =============================================================================
  // AC5: RÉTRACTION DU PANNEAU
  // =============================================================================

  test.describe('AC5: Rétraction du panneau', () => {

    test('[P0] should collapse on collapse button click', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Collapse non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      // D'abord expanser
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Vérifier que le panneau est visible
      const detailPanel = page.getByTestId('detail-panel');
      await expect(detailPanel).toBeVisible();
      
      // Cliquer sur le bouton de collapse
      const collapseButton = page.getByRole('button', { name: /voir moins|collapse|less/i });
      await collapseButton.click();
      
      // Le panneau ne devrait plus être visible
      await expect(detailPanel).not.toBeVisible();
    });

    test('[P0] should collapse when clicking outside the card', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Collapse outside non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      // Expanser la carte
      const card = page.getByTestId('decision-card').first();
      await card.click();
      
      // Cliquer à l'extérieur
      await page.click('body');
      
      // Le panneau devrait se fermer
      const detailPanel = page.getByTestId('detail-panel');
      await expect(detailPanel).not.toBeVisible();
    });

    test('[P1] should return focus to card header on collapse', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Focus management non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Collapse
      const collapseButton = page.getByRole('button', { name: /voir moins|collapse/i });
      await collapseButton.click();
      
      // Le focus devrait revenir au bouton d'expansion
      await expect(expandButton).toBeFocused();
    });

    test('[P1] should maintain scroll position on collapse', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Scroll position non gérée
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      // Scroll à une position
      await page.evaluate(() => window.scrollTo(0, 500));
      
      // Expanser et collapse
      const card = page.getByTestId('decision-card').first();
      await card.click();
      await page.waitForTimeout(500);
      await page.click('body');
      
      // La position de scroll devrait être maintenue
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBe(500);
    });
  });

  // =============================================================================
  // AC6: ÉTAT PERSISTANT PAR SESSION
  // =============================================================================

  test.describe('AC6: État persistant par session', () => {

    test('[P1] should persist expansion state within session', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Persistence session non implémentée
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      // Expanser la première carte
      const card = page.getByTestId('decision-card').first();
      await card.click();
      
      // Vérifier l'expansion
      const detailPanel = page.getByTestId('detail-panel');
      await expect(detailPanel).toBeVisible();
      
      // Naviguer vers une autre page
      await page.goto('/dashboard/no-bet');
      await page.waitForLoadState('networkidle');
      
      // Revenir à picks
      await page.goto('/dashboard/picks');
      await page.waitForLoadState('networkidle');
      
      // L'état d'expansion devrait être persisté
      await expect(detailPanel).toBeVisible();
    });

    test('[P1] should allow multiple cards expanded simultaneously', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Multiple expansions non supportées
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, [mockDecisionWithDetails, mockDecisionWithDetails]);
      
      // Expanser deux cartes
      const cards = page.getByTestId('decision-card');
      await cards.nth(0).click();
      await cards.nth(1).click();
      
      // Les deux devraient être expansées
      const detailPanels = page.getByTestId('detail-panel');
      await expect(detailPanels).toHaveCount(2);
    });

    test('[P2] should clear expansion state on page reload', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Clear state on reload non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      // Expanser une carte
      const card = page.getByTestId('decision-card').first();
      await card.click();
      
      // Recharger la page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // L'état devrait être réinitialisé
      const detailPanel = page.getByTestId('detail-panel');
      await expect(detailPanel).not.toBeVisible();
    });
  });

  // =============================================================================
  // AC7: PERFORMANCE EXPANSION (MOBILE)
  // =============================================================================

  test.describe('AC7: Performance expansion (mobile)', () => {

    test('[P2] should expand within 300ms on mobile', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Performance non optimisée
      await page.setViewportSize({ width: 375, height: 667 });
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      
      // Mesurer le temps d'expansion
      const startTime = Date.now();
      await expandButton.click();
      const detailPanel = page.getByTestId('detail-panel');
      await expect(detailPanel).toBeVisible();
      const endTime = Date.now();
      
      // Devrait être inférieur à 300ms
      expect(endTime - startTime).toBeLessThan(300);
    });

    test('[P2] should not cause layout shift on other cards', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Layout shift non géré
      await page.setViewportSize({ width: 375, height: 667 });
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, [mockDecisionWithDetails, mockDecisionWithDetails]);
      
      // Obtenir la position de la deuxième carte avant expansion
      const secondCard = page.getByTestId('decision-card').nth(1);
      const boxBefore = await secondCard.boundingBox();
      
      // Expanser la première carte
      const firstCard = page.getByTestId('decision-card').nth(0);
      await firstCard.click();
      
      // Obtenir la position après
      const boxAfter = await secondCard.boundingBox();
      
      // Ne devrait pas y avoir de shift significatif
      expect(boxAfter!.y).toBeCloseTo(boxBefore!.y, 0);
    });

    test('[P2] should use lazy loading for heavy content', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Lazy loading non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Le contenu lourd devrait être chargé de manière paresseuse
      const heavyContent = page.getByTestId('metadata-section');
      await expect(heavyContent).toHaveAttribute('loading', 'lazy');
    });
  });

  // =============================================================================
  // AC8: ACCESSIBILITÉ EXPANSION
  // =============================================================================

  test.describe('AC8: Accessibilité expansion', () => {

    test('[P1] should announce state change to screen readers', async ({ page }) => {
      // CE TEST VA ÉCHOUER - ARIA non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      
      // Devrait avoir aria-expanded qui change
      await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      
      await expandButton.click();
      
      await expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });

    test('[P1] should be keyboard accessible', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Navigation clavier non implémentée
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      // Tab jusqu'au bouton d'expansion
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Appuyer sur Entrée pour expanser
      await page.keyboard.press('Enter');
      
      // Le panneau devrait être visible
      const detailPanel = page.getByTestId('detail-panel');
      await expect(detailPanel).toBeVisible();
    });

    test('[P1] should not trap focus in expanded content', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Focus trap non géré
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Devrait pouvoir sortir du panneau expansé avec Tab
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Le focus ne devrait pas être piégé
      const activeElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(activeElement).not.toBe('BODY');
    });

    test('[P2] should have proper ARIA attributes on detail panel', async ({ page }) => {
      // CE TEST VA ÉCHOUER - ARIA sur panneau non implémenté
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, mockDecisionWithDetails);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      const detailPanel = page.getByTestId('detail-panel');
      
      // Devrait avoir les attributs ARIA appropriés
      await expect(detailPanel).toHaveAttribute('role', 'region');
      await expect(detailPanel).toHaveAttribute('aria-labelledby');
    });
  });

  // =============================================================================
  // AC9: ÉTATS DÉGRADÉS ET ERREURS
  // =============================================================================

  test.describe('AC9: États dégradés et erreurs', () => {

    test('[P1] should display available data when some is missing', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Graceful degradation non implémentée
      const partialDecision = {
        ...mockDecisionWithDetails,
        confidenceBreakdown: undefined,
      };
      
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, partialDecision);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Les données disponibles devraient être affichées
      await expect(page.getByText('Minimum Edge')).toBeVisible();
      
      // Les données manquantes devraient être indiquées
      await expect(page.getByText(/données.*non disponibles|unavailable/i)).toBeVisible();
    });

    test('[P1] should show error state for each section', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Error states non implémentés
      const decisionWithErrors = {
        ...mockDecisionWithDetails,
        gates: undefined,
      };
      
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, decisionWithErrors);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Devrait afficher un état d'erreur pour la section gates
      const gatesError = page.getByTestId('gates-error');
      await expect(gatesError).toBeVisible();
      await expect(gatesError).toHaveText(/erreur.*gate|gate.*error/i);
    });

    test('[P2] should allow interaction with available content when partial', async ({ page }) => {
      // CE TEST VA ÉCHOUER - Interaction partial non supportée
      const partialDecision = {
        ...mockDecisionWithDetails,
        metadata: undefined,
      };
      
      await navigateToPicks(page);
      await mockDecisionDetailsApi(page, partialDecision);
      
      const expandButton = page.getByRole('button', { name: /voir plus|expand/i });
      await expandButton.click();
      
      // Devrait pouvoir copier le traceId même si les métadonnées sont partielles
      // (la section devrait être présente mais vide ou avec message)
      const metadataSection = page.getByTestId('metadata-section');
      await expect(metadataSection).toBeVisible();
    });
  });
});

// =============================================================================
// RÉSUMÉ DES TESTS
// =============================================================================

/**
 * STATUT: TESTS ACTIFS
 *
 * Tous les tests sont maintenant activés après implémentation de Story 3.5.
 * Date d'activation: 2026-02-14
 *
 * Tests actifs par AC:
 * - AC1: 4 tests (expansion par interaction)
 * - AC2: 3 tests (contenu complet)
 * - AC3: 4 tests (gates détaillés)
 * - AC4: 4 tests (data signals)
 * - AC5: 4 tests (rétraction)
 * - AC6: 3 tests (persistance session)
 * - AC7: 3 tests (performance mobile)
 * - AC8: 4 tests (accessibilité)
 * - AC9: 3 tests (états dégradés)
 * Total: 32 tests E2E actifs
 *
 * Exécuter avec: npx playwright test tests/e2e/detail-panel-3-5.spec.ts
 */
