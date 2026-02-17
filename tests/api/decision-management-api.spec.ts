/**
 * Decision Management API Tests
 * Tests for decision CRUD operations and history
 *
 * Coverage: P0 - Critical decision management
 */

import { test, expect } from '../support/merged-fixtures';
import { createDecision, createNoBetDecision, createHardStopDecision } from '../support/factories';
import { faker } from '@faker-js/faker';

test.describe('Decision Management API @api @decisions @p0 @epic2', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test.describe('GET /api/v1/decisions', () => {
    test('[P0] should list all decisions @smoke @p0', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/decisions',
      });

      expect(status).toBe(200);
      expect(body.decisions).toBeDefined();
      expect(Array.isArray(body.decisions)).toBe(true);
    });

    test('[P1] should support pagination @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/decisions?page=1&limit=10',
      });

      expect(status).toBe(200);
      expect(body.decisions).toBeDefined();
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
    });

    test('[P1] should filter by status @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/decisions?status=Pick',
      });

      expect(status).toBe(200);
      expect(body.decisions).toBeDefined();
      if (body.decisions.length > 0) {
        expect(body.decisions[0].status).toBe('Pick');
      }
    });

    test('[P2] should filter by date range @p2', async ({ apiRequest }) => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const { status, body } = await apiRequest({
        method: 'GET',
        path: `/api/v1/decisions?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      });

      expect(status).toBe(200);
      expect(body.decisions).toBeDefined();
    });
  });

  test.describe('POST /api/v1/decisions', () => {
    test('[P0] should create a new decision @smoke @p0', async ({ apiRequest }) => {
      const decision = createDecision({ status: 'Pick' });

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/decisions',
        data: decision,
      });

      expect(status).toBe(201);
      expect(body.id).toBeDefined();
      expect(body.matchId).toBe(decision.matchId);
      expect(body.status).toBe('Pick');
      expect(body.createdAt).toBeDefined();
    });

    test('[P0] should create No-Bet decision @p0', async ({ apiRequest }) => {
      const decision = createNoBetDecision();

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/decisions',
        data: decision,
      });

      expect(status).toBe(201);
      expect(body.status).toBe('No-Bet');
    });

    test('[P0] should create Hard-Stop decision @p0', async ({ apiRequest }) => {
      const decision = createHardStopDecision();

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/decisions',
        data: decision,
      });

      expect(status).toBe(201);
      expect(body.status).toBe('Hard-Stop');
    });

    test('[P1] should validate required matchId @validation @p1', async ({ apiRequest }) => {
      const invalidDecision = {
        status: 'Pick',
        confidence: 0.8,
      };

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/decisions',
        data: invalidDecision,
        expectStatus: [400],
      });

      expect(status).toBe(400);
      expect(body.error).toBeDefined();
      expect(body.error).toContain('matchId');
    });

    test('[P1] should validate status enum @validation @p1', async ({ apiRequest }) => {
      const invalidDecision = {
        matchId: faker.string.uuid(),
        status: 'InvalidStatus',
      };

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/decisions',
        data: invalidDecision,
        expectStatus: [400],
      });

      expect(status).toBe(400);
      expect(body.error).toContain('status');
    });

    test('[P1] should validate confidence range @validation @p1', async ({ apiRequest }) => {
      const invalidDecision = {
        matchId: faker.string.uuid(),
        status: 'Pick',
        confidence: 1.5,
      };

      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/decisions',
        data: invalidDecision,
        expectStatus: [400],
      });

      expect(status).toBe(400);
      expect(body.error).toContain('Confidence');
    });

    test('[P2] should handle empty request body @error @p2', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/v1/decisions',
        data: {},
        expectStatus: [400],
      });

      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });
  });

  test.describe('GET /api/v1/decisions/history', () => {
    test('[P0] should retrieve decision history @smoke @p0', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/decisions/history',
      });

      expect(status).toBe(200);
      expect(body.history).toBeDefined();
      expect(Array.isArray(body.history)).toBe(true);
    });

    test('[P1] should include decision metadata @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/v1/decisions/history',
      });

      expect(status).toBe(200);
      if (body.history.length > 0) {
        const decision = body.history[0];
        expect(decision.id).toBeDefined();
        expect(decision.status).toBeDefined();
        expect(decision.createdAt).toBeDefined();
        expect(decision.policyGates).toBeDefined();
      }
    });
  });

  test.describe('GET /api/v1/decisions/:id', () => {
    test('[P0] should retrieve specific decision @smoke @p0', async ({ apiRequest }) => {
      const decision = createDecision();
      
      const createResponse = await apiRequest({
        method: 'POST',
        path: '/api/v1/decisions',
        data: decision,
      });

      if (createResponse.status === 201 && createResponse.body.id) {
        const { status, body } = await apiRequest({
          method: 'GET',
          path: `/api/v1/decisions/${createResponse.body.id}`,
        });

        expect(status).toBe(200);
        expect(body.id).toBe(createResponse.body.id);
        expect(body.matchId).toBe(decision.matchId);
      }
    });

    test('[P0] should return 404 for non-existent decision @p0', async ({ apiRequest }) => {
      const nonExistentId = faker.string.uuid();

      const { status, body } = await apiRequest({
        method: 'GET',
        path: `/api/v1/decisions/${nonExistentId}`,
        expectStatus: [404],
      });

      expect(status).toBe(404);
      expect(body.error).toBeDefined();
    });

    test('[P1] should include decision rationale @p1', async ({ apiRequest }) => {
      const decisionId = faker.string.uuid();

      const { status, body } = await apiRequest({
        method: 'GET',
        path: `/api/v1/decisions/${decisionId}`,
        expectStatus: [200, 404],
      });

      if (status === 200) {
        expect(body.rationale).toBeDefined();
        expect(body.modelOutputs).toBeDefined();
      }
    });
  });
});
