import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { PolicyFactory } from '../factories/policy-factory';

/**
 * Tests API pour les endpoints de décisions
 * Stories: 2.x - Gestion des décisions
 * 
 * Couverture:
 * - POST /api/v1/decisions - Création de décision
 * - GET /api/v1/decisions - Récupération des décisions
 * - Validation des erreurs (400, 401, 429, 500)
 */

test.describe('Decisions API @api @decisions @p0 @p1', () => {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  // P0: Happy path - Création et récupération de décision
  test('[P0] should create and retrieve decision successfully @smoke', async ({ request }) => {
    const decision = PolicyFactory.createPolicyEvaluationResult(faker.string.uuid(), 'Pick');

    const createResponse = await request.post(`${baseUrl}/api/v1/decisions`, {
      data: decision,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(createResponse.status()).toBe(201);
    const createdBody = await createResponse.json();
    expect(createdBody.evaluation_id).toBeDefined();

    const getResponse = await request.get(`${baseUrl}/api/v1/decisions`);
    expect(getResponse.status()).toBe(200);
  });

  // P0: Erreur 400 - JSON invalide
  test('[P0] should return 400 for invalid JSON @error', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/v1/decisions`, {
      data: 'invalid-json-data',
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  // P0: Erreur 401 - Authentification manquante
  test('[P0] should return 401 without authentication @auth @error', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/v1/decisions`, {
      data: PolicyFactory.createPolicyEvaluationResult(faker.string.uuid(), 'Pick'),
      headers: { 'Content-Type': 'application/json', 'Authorization': '' }
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  // P0: Erreur 429 - Rate limit exceeded
  test('[P0] should return 429 when rate limit exceeded @error', async ({ request }) => {
    const decision = PolicyFactory.createPolicyEvaluationResult(faker.string.uuid(), 'Pick');
    const requests = Array(150).fill(null).map(() => 
      request.post(`${baseUrl}/api/v1/decisions`, {
        data: decision,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-token' }
      })
    );

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(r => r.status() === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });

  // P1: Erreur 404 - Décision non trouvée
  test('[P1] should return 404 for non-existent decision @error', async ({ request }) => {
    const nonExistentId = faker.string.uuid();
    const response = await request.get(`${baseUrl}/api/v1/decisions/${nonExistentId}`);
    expect(response.status()).toBe(404);
  });
});
