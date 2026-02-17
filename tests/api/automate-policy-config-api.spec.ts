import { test, expect } from '@playwright/test';
import { PolicyFactory } from '../factories/policy-factory';

/**
 * Tests API pour la configuration des politiques
 * Story 2.5: Policy Engine - Configuration
 */

test.describe('Policy Config API @api @policy-config @p0 @p1', () => {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  // P0: Récupération de la configuration
  test('[P0] should get current policy configuration @smoke', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/v1/policy/config`);

    expect(response.status()).toBe(200);
    const config = await response.json();
    expect(config).toHaveProperty('edge_threshold');
    expect(config).toHaveProperty('confidence_threshold');
    expect(config).toHaveProperty('drift_threshold');
    expect(config).toHaveProperty('hard_stop_enabled');
    expect(config).toHaveProperty('version');
  });

  // P0: Validation des plages de seuils
  test('[P0] should return valid threshold ranges', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/v1/policy/config`);
    const config = await response.json();

    expect(config.edge_threshold).toBeGreaterThanOrEqual(0);
    expect(config.edge_threshold).toBeLessThanOrEqual(1);
    expect(config.confidence_threshold).toBeGreaterThanOrEqual(0);
    expect(config.confidence_threshold).toBeLessThanOrEqual(1);
    expect(config.drift_threshold).toBeGreaterThanOrEqual(0);
    expect(config.drift_threshold).toBeLessThanOrEqual(1);
  });

  // P0: Mise à jour de la configuration (admin)
  test('[P0] should update policy configuration as admin', async ({ request }) => {
    const newConfig = PolicyFactory.createPolicyConfig({
      edge_threshold: 0.06,
      confidence_threshold: 0.80,
      drift_threshold: 0.12
    });

    const response = await request.put(`${baseUrl}/api/v1/policy/config`, {
      data: newConfig,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer admin-token'
      }
    });

    expect(response.status()).toBe(200);
    const updatedConfig = await response.json();
    expect(updatedConfig.edge_threshold).toBe(0.06);
    expect(updatedConfig.confidence_threshold).toBe(0.80);
  });

  // P0: Erreur 401 - Authentification requise pour PUT
  test('[P0] should require authentication for config update @auth', async ({ request }) => {
    const config = PolicyFactory.createPolicyConfig();

    const response = await request.put(`${baseUrl}/api/v1/policy/config`, {
      data: config,
      headers: { 'Authorization': '' }
    });

    expect(response.status()).toBe(401);
  });

  // P1: Erreur 403 - Rôle non-admin
  test('[P1] should return 403 for non-admin users @auth', async ({ request }) => {
    const config = PolicyFactory.createPolicyConfig();

    const response = await request.put(`${baseUrl}/api/v1/policy/config`, {
      data: config,
      headers: { 'Authorization': 'Bearer user-token' }
    });

    expect(response.status()).toBe(403);
  });

  // P1: Erreur 400 - Seuils invalides
  test('[P1] should return 400 for invalid threshold values @error', async ({ request }) => {
    const invalidConfig = PolicyFactory.createPolicyConfig({
      edge_threshold: -0.1,
      confidence_threshold: 1.5
    });

    const response = await request.put(`${baseUrl}/api/v1/policy/config`, {
      data: invalidConfig,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer admin-token' }
    });

    expect(response.status()).toBe(400);
  });
});
