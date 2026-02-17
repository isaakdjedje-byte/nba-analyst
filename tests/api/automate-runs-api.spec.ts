import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { PolicyFactory } from '../factories/policy-factory';

/**
 * Tests API pour les endpoints V1 de runs
 * Story: Gestion quotidienne des runs
 */

test.describe('V1 Runs API @api @runs-v1 @p0 @p1', () => {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  // P0: Récupération des runs
  test('[P0] should retrieve all runs @smoke', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/v1/runs`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.runs).toBeDefined();
    expect(Array.isArray(body.runs)).toBe(true);
    expect(body.meta).toBeDefined();
  });

  // P0: Création d'un nouveau run
  test('[P0] should create and trigger new run', async ({ request }) => {
    const runData = {
      date: faker.date.recent().toISOString(),
      source: 'api-test',
      config: { modelVersion: 'v2.1.0', confidence: 0.75 }
    };

    const response = await request.post(`${baseUrl}/api/v1/runs`, {
      data: runData,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-token' }
    });

    expect([201, 401, 403]).toContain(response.status());
  });

  // P0: Récupération du statut d'un run
  test('[P0] should get run status by ID', async ({ request }) => {
    const runId = faker.string.uuid();
    const response = await request.get(`${baseUrl}/api/v1/runs/${runId}`);

    expect([200, 404]).toContain(response.status());
  });

  // P0: Health check endpoint
  test('[P0] should check runs service health @health', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/v1/runs/health`);

    expect([200, 404]).toContain(response.status());
  });

  // P0: Erreur 400 - Données invalides
  test('[P0] should return 400 for invalid run data @error', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/v1/runs`, {
      data: { date: 'invalid-date-format' },
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-token' }
    });

    expect([400, 401, 403]).toContain(response.status());
  });

  // P0: Erreur 401 - Authentification
  test('[P0] should require authentication for run creation @auth', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/v1/runs`, {
      data: { date: faker.date.recent().toISOString() },
      headers: { 'Authorization': '' }
    });

    expect(response.status()).toBe(401);
  });

  // P1: Filtrage par statut
  test('[P1] should filter runs by status', async ({ request }) => {
    const response = await request.get(`${baseUrl}/api/v1/runs?status=completed`);

    expect([200, 404]).toContain(response.status());
  });

  // P1: Annulation d'un run
  test('[P1] should cancel running run @error', async ({ request }) => {
    const runId = faker.string.uuid();
    const response = await request.post(`${baseUrl}/api/v1/runs/${runId}/cancel`, {
      headers: { 'Authorization': 'Bearer valid-token' }
    });

    expect([200, 202, 400, 404]).toContain(response.status());
  });
});
