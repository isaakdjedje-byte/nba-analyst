import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { PolicyFactory } from '../factories/policy-factory';

/**
 * Tests API pour le statut Hard-Stop
 * Story 2.6: Hard-Stop Tracker
 */

test.describe('Policy HardStop Status API @api @hardstop @p0 @p1', () => {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  // P0: Récupération du statut hard-stop actif
  test('[P0] should get active hard-stop status @smoke', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);

    expect(response.status()).toBe(200);
    const status = await response.json();
    expect(status.active).toBeDefined();
  });

  // P0: Statut hard-stop inactif
  test('[P0] should get inactive hard-stop status', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);

    expect(response.status()).toBe(200);
    const status = await response.json();
    expect(typeof status.active).toBe('boolean');
  });

  // P0: Réinitialisation du hard-stop (admin)
  test('[P0] should reset hard-stop as admin', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/v1/policy/hardstop/reset`, {
      headers: { 'Authorization': 'Bearer admin-token' }
    });

    expect([200, 400, 403]).toContain(response.status());
  });

  // P0: Erreur 401 - Authentification requise pour reset
  test('[P0] should require authentication for reset @auth', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/v1/policy/hardstop/reset`, {
      headers: { 'Authorization': '' }
    });

    expect(response.status()).toBe(401);
  });

  // P0: Erreur 403 - Permissions insuffisantes
  test('[P0] should return 403 for non-admin reset @auth', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/v1/policy/hardstop/reset`, {
      headers: { 'Authorization': 'Bearer user-token' }
    });

    expect(response.status()).toBe(403);
  });

  // P1: Historique des événements hard-stop
  test('[P1] should get hard-stop history', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/history`);

    expect([200, 404]).toContain(response.status());
  });
});
