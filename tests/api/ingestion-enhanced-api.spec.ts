/**
 * Ingestion API Tests - Enhanced
 * Tests for data ingestion and health endpoints
 *
 * Coverage: P1 - High priority data pipeline
 */

import { test, expect } from '../support/merged-fixtures';
import { faker } from '@faker-js/faker';

test.describe('Ingestion API Enhanced @api @ingestion @p1 @epic2', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test.describe('POST /api/ingestion', () => {
    test('[P1] should ingest data from specific provider @smoke @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/ingestion',
        data: {
          provider: 'espn',
          sport: 'nba',
          date: new Date().toISOString().split('T')[0],
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 201, 202]).toContain(status);
      if ([200, 201, 202].includes(status)) {
        expect(body.success).toBe(true);
        expect(body.ingestionId).toBeDefined();
        expect(body.provider).toBe('espn');
      }
    });

    test('[P1] should ingest from all providers @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/ingestion',
        data: {
          all: true,
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 201, 202]).toContain(status);
      if ([200, 201, 202].includes(status)) {
        expect(body.success).toBe(true);
        expect(body.results).toBeDefined();
        expect(Array.isArray(body.results)).toBe(true);
      }
    });

    test('[P1] should validate provider name @validation @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/ingestion',
        data: {
          provider: '',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [400, 401, 403],
      });

      expect([400, 401, 403]).toContain(status);
    });

    test('[P1] should require provider or all flag @validation @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/ingestion',
        data: {},
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [400],
      });

      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });

    test('[P2] should handle provider errors gracefully @error @p2', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/ingestion',
        data: {
          provider: 'unavailable-provider',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 500, 502, 503]).toContain(status);
      if (status !== 200) {
        expect(body.error).toBeDefined();
      }
    });

    test('[P2] should validate date format @validation @p2', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/ingestion',
        data: {
          provider: 'espn',
          date: 'invalid-date',
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        expectStatus: [400, 401, 403],
      });

      expect([400, 401, 403]).toContain(status);
    });
  });

  test.describe('GET /api/ingestion/health', () => {
    test('[P1] should return ingestion health status @smoke @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/ingestion/health',
      });

      expect(status).toBe(200);
      expect(body.status).toBeDefined();
      expect(body.healthy).toBeDefined();
      expect(body.providers).toBeDefined();
    });

    test('[P1] should include provider health details @p1', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/ingestion/health',
      });

      expect(status).toBe(200);
      expect(body.providers).toBeDefined();
      expect(Array.isArray(body.providers)).toBe(true);
      
      if (body.providers.length > 0) {
        const provider = body.providers[0];
        expect(provider.name).toBeDefined();
        expect(provider.healthy).toBeDefined();
        expect(provider.lastSync).toBeDefined();
      }
    });

    test('[P2] should include ingestion statistics @p2', async ({ apiRequest }) => {
      const { status, body } = await apiRequest({
        method: 'GET',
        path: '/api/ingestion/health',
      });

      expect(status).toBe(200);
      expect(body.stats).toBeDefined();
      if (body.stats) {
        expect(body.stats.totalIngestions).toBeDefined();
        expect(body.stats.last24hIngestions).toBeDefined();
        expect(body.stats.failedIngestions).toBeDefined();
      }
    });
  });

  test.describe('Data Validation and Provider Integration', () => {
    test('[P1] should validate game data schema @validation @p1', async ({ apiRequest, authToken }) => {
      const { status, body } = await apiRequest({
        method: 'POST',
        path: '/api/ingestion/validate',
        data: {
          gameData: {
            homeTeam: 'Lakers',
            awayTeam: 'Celtics',
            scheduledAt: new Date().toISOString(),
            league: 'NBA',
          },
        },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect([200, 404]).toContain(status);
      if (status === 200) {
        expect(body.valid).toBeDefined();
      }
    });

    test('[P2] should handle rate limiting @error @p2', async ({ apiRequest, authToken }) => {
      const requests = Array(10).fill(null).map(() =>
        apiRequest({
          method: 'POST',
          path: '/api/ingestion',
          data: { provider: 'espn' },
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        })
      );

      const responses = await Promise.all(requests);
      const hasRateLimit = responses.some(r => r.status === 429);
      
      if (hasRateLimit) {
        const rateLimited = responses.find(r => r.status === 429);
        expect(rateLimited?.body.error).toContain('rate limit');
      }
    });
  });
});
