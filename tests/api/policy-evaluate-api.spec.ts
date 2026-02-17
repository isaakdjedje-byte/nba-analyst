/**
 * Policy Evaluation API Tests
 * Tests for /api/policy/evaluate and /api/v1/policy/evaluate endpoints
 *
 * Coverage: P0 - Critical betting decision evaluation
 * Gates: confidence, drift, edge, hard-stop
 */

import { test, expect } from '../support/merged-fixtures';
import { PolicyFactory } from '../factories/policy-factory';
import { faker } from '@faker-js/faker';

test.describe('Policy Evaluation API @api @policy @evaluation @p0 @epic5', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test.describe('POST /api/policy/evaluate', () => {
    test('[P0] should evaluate prediction and return decision @smoke @p0', async ({ apiRequest }) => {
      const prediction = PolicyFactory.createValidPrediction();

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/policy/evaluate',
        data: prediction,
      });

      expect(status).toBe(200);
      expect(body.final_decision).toBeDefined();
      expect(['Pick', 'No-Bet', 'Hard-Stop']).toContain(body.final_decision);
      expect(body.evaluation_id).toBeDefined();
      expect(body.gate_results).toBeDefined();
      expect(Array.isArray(body.gate_results)).toBe(true);
    });

    test('[P0] should return Hard-Stop when thresholds exceeded @p0', async ({ apiRequest }) => {
      const prediction = PolicyFactory.createHardStopPrediction();

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/policy/evaluate',
        data: prediction,
      });

      expect(status).toBe(200);
      expect(body.final_decision).toBe('Hard-Stop');
      expect(body.hard_stop_triggered).toBe(true);
      expect(body.hard_stop_cause).toBeDefined();
    });

    test('[P0] should return No-Bet when edge below threshold @p0', async ({ apiRequest }) => {
      const prediction = PolicyFactory.createNoBetPrediction();

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/policy/evaluate',
        data: prediction,
      });

      expect(status).toBe(200);
      expect(body.final_decision).toBe('No-Bet');
    });

    test('[P0] should return Pick for valid prediction @p0', async ({ apiRequest }) => {
      const prediction = PolicyFactory.createValidPrediction();

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/policy/evaluate',
        data: prediction,
      });

      expect(status).toBe(200);
      expect(body.final_decision).toBe('Pick');
    });

    test('[P0] should evaluate all gates independently @p0', async ({ apiRequest }) => {
      const prediction = PolicyFactory.createPrediction({
        edge: 0.08,
        confidence: 0.65,
        drift_score: 0.05,
      });

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/policy/evaluate',
        data: prediction,
      });

      expect(status).toBe(200);
      expect(body.gate_results).toHaveLength(3);
      
      const edgeGate = body.gate_results.find((g: any) => g.gate_name === 'edge_gate');
      const confidenceGate = body.gate_results.find((g: any) => g.gate_name === 'confidence_gate');
      const driftGate = body.gate_results.find((g: any) => g.gate_name === 'drift_gate');

      expect(edgeGate?.passed).toBe(true);
      expect(confidenceGate?.passed).toBe(false);
      expect(driftGate?.passed).toBe(true);
    });

    test('[P1] should return 400 for missing required fields @validation @p1', async ({ apiRequest }) => {
      const invalidPrediction = {
        prediction_id: faker.string.uuid(),
      };

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/policy/evaluate',
        data: invalidPrediction,
        expectStatus: [400],
      });

      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });

    test('[P1] should return 400 for invalid data types @validation @p1', async ({ apiRequest }) => {
      const invalidPrediction = {
        prediction_id: faker.string.uuid(),
        model_version: 'v1.0',
        edge: 'not-a-number',
        confidence: 0.8,
        drift_score: 0.1,
      };

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/policy/evaluate',
        data: invalidPrediction,
        expectStatus: [400],
      });

      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });

    test('[P2] should include trace ID in response @observability @p2', async ({ apiRequest }) => {
      const prediction = PolicyFactory.createValidPrediction();

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/policy/evaluate',
        data: prediction,
      });

      expect(status).toBe(200);
      expect(body.traceId).toBeDefined();
    });

    test('[P2] should handle server errors gracefully @error @p2', async ({ apiRequest }) => {
      const invalidPrediction = {
        simulation: 'server_error',
      };

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/policy/evaluate',
        data: invalidPrediction,
        expectStatus: [400, 500],
      });

      expect([400, 500]).toContain(status);
      expect(body.error).toBeDefined();
    });
  });

  test.describe('POST /api/v1/policy/evaluate', () => {
    test('[P0] V1 should evaluate prediction with enhanced response @smoke @p0', async ({ apiRequest }) => {
      const prediction = PolicyFactory.createValidPrediction();

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/policy/evaluate',
        data: prediction,
      });

      expect(status).toBe(200);
      expect(body.final_decision).toBeDefined();
      expect(body.evaluation_id).toBeDefined();
      expect(body.gate_results).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });

    test('[P1] V1 should include detailed gate metadata @p1', async ({ apiRequest }) => {
      const prediction = PolicyFactory.createValidPrediction();

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/policy/evaluate',
        data: prediction,
      });

      expect(status).toBe(200);
      for (const gate of body.gate_results) {
        expect(gate.gate_name).toBeDefined();
        expect(gate.passed).toBeDefined();
        expect(gate.score).toBeDefined();
        expect(gate.threshold).toBeDefined();
        expect(typeof gate.passed).toBe('boolean');
        expect(typeof gate.score).toBe('number');
        expect(typeof gate.threshold).toBe('number');
      }
    });
  });
});
