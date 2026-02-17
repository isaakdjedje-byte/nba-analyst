import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { PolicyFactory } from '../factories/policy-factory';

/**
 * Tests API pour les endpoints V1 de décisions
 * API Version 1 - Filtres avancés et pagination
 */

test.describe('V1 Decisions API @api @decisions-v1 @p0 @p1', () => {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  // P0: Récupération avec filtres de date
  test('[P0] should filter decisions by date range @smoke', async ({ request }) => {
    const startDate = faker.date.past({ years: 1 }).toISOString().split('T')[0];
    const endDate = faker.date.recent({ days: 7 }).toISOString().split('T')[0];

    const response = await request.get(
      `${baseUrl}/api/v1/decisions?startDate=${startDate}&endDate=${endDate}`
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.decisions).toBeDefined();
    expect(Array.isArray(body.decisions)).toBe(true);
  });

  // P0: Filtre par statut de décision
  test('[P0] should filter decisions by status', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/v1/decisions?status=Pick`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.decisions).toBeDefined();
    for (const decision of body.decisions) {
      expect(decision.final_decision).toBe('Pick');
    }
  });

  // P0: Création via V1 API
  test('[P0] should create decision via V1 API', async ({ request }) => {
    const decision = PolicyFactory.createPolicyEvaluationResult(faker.string.uuid(), 'Pick');
    const response = await request.post(`${baseUrl}/api/v1/decisions`, {
      data: decision,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-token' }
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.evaluation_id).toBeDefined();
  });

  // P1: Pagination
  test('[P1] should support pagination', async ({ request }) => {
    const page1Response = await request.get(`${baseUrl}/api/v1/decisions?page=1&limit=5`);
    expect(page1Response.status()).toBe(200);
    const page1Body = await page1Response.json();
    expect(page1Body.meta.page).toBe(1);
    expect(page1Body.decisions.length).toBeLessThanOrEqual(5);
  });

  // P1: Erreur 400 - Paramètres de requête invalides
  test('[P1] should return 400 for invalid query parameters @error', async ({ request }) => {
    const response = await request.get(
      `${baseUrl}/api/v1/decisions?startDate=invalid-date`
    );
    expect(response.status()).toBe(400);
  });
});
