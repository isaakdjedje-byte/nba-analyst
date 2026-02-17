import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { PolicyFactory } from '../factories/policy-factory';

/**
 * Tests API pour l'évaluation des politiques
 * Story 2.5: Policy Engine - Évaluation des prédictions
 */

test.describe('Policy Evaluate API @api @policy-evaluate @p0 @p1', () => {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

  // P0: Évaluation d'une prédiction valide (Pick)
  test('[P0] should evaluate valid prediction and return Pick decision @smoke', async ({ request }) => {
    const prediction = PolicyFactory.createValidPrediction();

    const response = await request.post(`${baseUrl}/api/v1/policy/evaluate`, {
      data: prediction,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-token' }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.final_decision).toBe('Pick');
    expect(result.evaluation_id).toBeDefined();
    expect(result.hard_stop_triggered).toBe(false);
  });

  // P0: Évaluation retournant No-Bet
  test('[P0] should evaluate prediction and return No-Bet decision', async ({ request }) => {
    const prediction = PolicyFactory.createNoBetPrediction();

    const response = await request.post(`${baseUrl}/api/v1/policy/evaluate`, {
      data: prediction,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-token' }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.final_decision).toBe('No-Bet');
    expect(result.hard_stop_triggered).toBe(false);
  });

  // P0: Évaluation retournant Hard-Stop
  test('[P0] should evaluate prediction and return Hard-Stop decision', async ({ request }) => {
    const prediction = PolicyFactory.createHardStopPrediction();

    const response = await request.post(`${baseUrl}/api/v1/policy/evaluate`, {
      data: prediction,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-token' }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.final_decision).toBe('Hard-Stop');
    expect(result.hard_stop_triggered).toBe(true);
    expect(result.hard_stop_cause).toBeDefined();
  });

  // P0: Validation des gate results
  test('[P0] should return complete gate results', async ({ request }) => {
    const prediction = PolicyFactory.createValidPrediction();

    const response = await request.post(`${baseUrl}/api/v1/policy/evaluate`, {
      data: prediction,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.gate_results).toBeDefined();
    expect(Array.isArray(result.gate_results)).toBe(true);
    expect(result.gate_results.length).toBeGreaterThanOrEqual(3);

    for (const gate of result.gate_results) {
      expect(gate).toHaveProperty('gate_name');
      expect(gate).toHaveProperty('passed');
      expect(gate).toHaveProperty('score');
      expect(gate).toHaveProperty('threshold');
    }
  });

  // P0: Erreur 400 - Données de prédiction manquantes
  test('[P0] should return 400 for missing prediction data @error', async ({ request }) => {
    const response = await request.post(`${baseUrl}/api/v1/policy/evaluate`, {
      data: { prediction_id: 'test-id' },
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Bad Request');
  });

  // P0: Erreur 401 - Authentification requise
  test('[P0] should require authentication @auth', async ({ request }) => {
    const prediction = PolicyFactory.createValidPrediction();

    const response = await request.post(`${baseUrl}/api/v1/policy/evaluate`, {
      data: prediction,
      headers: { 'Authorization': '' }
    });

    expect(response.status()).toBe(401);
  });

  // P1: Évaluation parallèle
  test('[P1] should handle multiple predictions in parallel', async ({ request }) => {
    const predictions = Array(5).fill(null).map(() => PolicyFactory.createValidPrediction());

    const responses = await Promise.all(
      predictions.map(pred => 
        request.post(`${baseUrl}/api/v1/policy/evaluate`, {
          data: pred,
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-token' }
        })
      )
    );

    for (const response of responses) {
      expect(response.status()).toBe(200);
    }
  });

  // P1: Rate limiting
  test('[P1] should enforce rate limiting @error', async ({ request }) => {
    const prediction = PolicyFactory.createValidPrediction();
    const requests = Array(200).fill(null).map(() => 
      request.post(`${baseUrl}/api/v1/policy/evaluate`, {
        data: prediction,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-token' }
      })
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status() === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
