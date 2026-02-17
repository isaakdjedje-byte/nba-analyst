import { test, expect } from '@playwright/test';

/**
 * Ingestion Provider Integration Tests
 * Tests for ESPN, NBA CDN, and Odds providers
 */

test.describe('Ingestion Provider Integration @integration @p1', () => {
  const baseUrl = '/api/v1/ingestion';

  test.describe('ESPN Provider', () => {
    test('[P1] should fetch NBA data from ESPN API', async ({ request }) => {
      // When: Trigger ESPN data fetch
      const response = await request.post(`${baseUrl}/providers/espn/fetch`, {
        data: {
          endpoint: '/nba/scoreboard',
          date: new Date().toISOString().split('T')[0],
        },
      });

      // Then: Should return data successfully
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.source).toBe('espn');
    });

    test('[P1] should handle ESPN API rate limiting', async ({ request }) => {
      // When: Making multiple rapid requests
      const requests = Array(5).fill(null).map(() =>
        request.post(`${baseUrl}/providers/espn/fetch`, {
          data: { endpoint: '/nba/scoreboard' },
        })
      );

      const responses = await Promise.all(requests);

      // Then: Some may be rate limited
      const statusCodes = responses.map(r => r.status());
      expect(statusCodes).toContain(200);
      
      // And: Rate limited responses should be handled gracefully
      const rateLimitedResponse = responses.find(r => r.status() === 429);
      if (rateLimitedResponse) {
        const body = await rateLimitedResponse.json();
        expect(body.retryAfter).toBeDefined();
      }
    });

    test('[P2] should validate ESPN data schema', async ({ request }) => {
      const response = await request.post(`${baseUrl}/providers/espn/fetch`, {
        data: {
          endpoint: '/nba/teams',
          validateSchema: true,
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.schemaValid).toBe(true);
    });
  });

  test.describe('NBA CDN Provider', () => {
    test('[P1] should fetch player data from NBA CDN', async ({ request }) => {
      const response = await request.post(`${baseUrl}/providers/nba-cdn/fetch`, {
        data: {
          resource: 'player',
          playerId: '2544', // LeBron James
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.player).toBeDefined();
    });

    test('[P1] should fetch team statistics from NBA CDN', async ({ request }) => {
      const response = await request.post(`${baseUrl}/providers/nba-cdn/fetch`, {
        data: {
          resource: 'team-stats',
          teamId: '1610612747', // Lakers
          season: '2023-24',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.stats).toBeDefined();
    });

    test('[P2] should handle CDN cache misses', async ({ request }) => {
      const response = await request.post(`${baseUrl}/providers/nba-cdn/fetch`, {
        data: {
          resource: 'player',
          playerId: 'invalid-id',
          bypassCache: true,
        },
      });

      // Should handle gracefully
      expect([200, 404]).toContain(response.status());
    });
  });

  test.describe('Odds Provider', () => {
    test('[P0] should fetch current odds from odds provider', async ({ request }) => {
      const response = await request.post(`${baseUrl}/providers/odds/fetch`, {
        data: {
          sport: 'basketball',
          league: 'nba',
          market: 'h2h',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.odds).toBeInstanceOf(Array);
      expect(body.data.odds.length).toBeGreaterThan(0);
    });

    test('[P0] should validate odds data freshness', async ({ request }) => {
      const response = await request.post(`${baseUrl}/providers/odds/fetch`, {
        data: {
          sport: 'basketball',
          league: 'nba',
          maxAgeMinutes: 5,
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data.timestamp).toBeDefined();
      
      // Verify data is within acceptable age
      const dataAge = Date.now() - new Date(body.data.timestamp).getTime();
      expect(dataAge).toBeLessThan(5 * 60 * 1000); // 5 minutes
    });

    test('[P1] should handle multiple odds markets', async ({ request }) => {
      const markets = ['h2h', 'spreads', 'totals'];
      
      for (const market of markets) {
        const response = await request.post(`${baseUrl}/providers/odds/fetch`, {
          data: {
            sport: 'basketball',
            league: 'nba',
            market,
          },
        });

        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.data.market).toBe(market);
      }
    });
  });

  test.describe('Provider Health Checks', () => {
    test('[P1] should return health status for all providers', async ({ request }) => {
      const response = await request.get(`${baseUrl}/providers/health`);

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.providers).toBeInstanceOf(Array);
      
      // Each provider should have health info
      body.providers.forEach((provider: { name: string; status: string; latency: number }) => {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('status');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(provider.status);
      });
    });

    test('[P1] should detect unhealthy providers', async ({ request }) => {
      // Trigger health check
      const response = await request.post(`${baseUrl}/providers/health/check`, {
        data: { provider: 'espn' },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.checked).toBe(true);
      expect(body.status).toBeDefined();
    });
  });

  test.describe('Provider Fallback Chain', () => {
    test('[P0] should fallback when primary provider fails', async ({ request }) => {
      // When: Primary provider is set to fail
      const response = await request.post(`${baseUrl}/providers/fallback`, {
        data: {
          resource: 'odds',
          primary: 'odds-provider-primary',
          fallback: 'odds-provider-secondary',
          forceFailure: true, // Test mode
        },
      });

      // Then: Should succeed via fallback
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.usedFallback).toBe(true);
      expect(body.provider).toBe('odds-provider-secondary');
    });

    test('[P1] should track provider fallback metrics', async ({ request }) => {
      const response = await request.get(`${baseUrl}/providers/fallback-metrics`);

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.metrics).toBeDefined();
      expect(body.metrics.fallbackCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Data Validation', () => {
    test('[P0] should validate fetched data against schema', async ({ request }) => {
      const response = await request.post(`${baseUrl}/validate`, {
        data: {
          source: 'espn',
          data: {
            gameId: '12345',
            homeTeam: 'LAL',
            awayTeam: 'GSW',
            odds: { home: 1.5, away: 2.8 },
          },
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.valid).toBe(true);
    });

    test('[P0] should reject invalid data', async ({ request }) => {
      const response = await request.post(`${baseUrl}/validate`, {
        data: {
          source: 'espn',
          data: {
            // Missing required fields
            odds: { home: 1.5 },
          },
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.valid).toBe(false);
      expect(body.errors).toBeInstanceOf(Array);
    });
  });
});
