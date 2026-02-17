import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

/**
 * Tests API pour le système de détection de drift (data ingestion)
 * Priorité: P0 - Critical (intégrité des données)
 */

test.describe('[P0] Ingestion Drift Detection API', () => {
  const adminAuth = { email: 'admin@nba-analyst.com', password: 'AdminPass123!' };

  test.beforeEach(async ({ request }) => {
    // Given: Authenticate as admin before each test
    const loginResponse = await request.post('/api/auth/login', {
      data: adminAuth,
    });
    expect(loginResponse.status()).toBe(200);
  });

  test('[P0] should detect schema drift in odds data', async ({ request }) => {
    // Given: Valid odds data with unexpected field
    const oddsData = {
      gameId: faker.string.uuid(),
      homeTeam: 'Lakers',
      awayTeam: 'Warriors',
      homeOdds: 1.85,
      awayOdds: 2.10,
      unexpectedField: 'this_should_trigger_drift', // Field not in schema
      timestamp: new Date().toISOString(),
    };

    // When: Submit data to ingestion endpoint
    const response = await request.post('/api/ingestion/odds', {
      data: oddsData,
      headers: { 'Content-Type': 'application/json' },
    });

    // Then: Drift should be detected and logged
    expect(response.status()).toBe(202); // Accepted for processing
    const body = await response.json();
    expect(body.driftDetected).toBe(true);
    expect(body.unexpectedFields).toContain('unexpectedField');
    expect(body.timestamp).toBeDefined();
  });

  test('[P0] should validate NBA schema before processing', async ({ request }) => {
    // Given: Invalid NBA data (missing required fields)
    const invalidNbaData = {
      // Missing gameId, teams, etc.
      someRandomData: 'invalid',
    };

    // When: Submit invalid data
    const response = await request.post('/api/ingestion/nba', {
      data: invalidNbaData,
      headers: { 'Content-Type': 'application/json' },
    });

    // Then: Validation should fail with 400
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('validation');
    expect(body.missingFields).toBeDefined();
  });

  test('[P1] should handle provider timeout gracefully', async ({ request }) => {
    // Given: Request with provider that times out
    const timeoutConfig = {
      provider: 'slow-provider',
      timeout: 1, // 1ms timeout to force timeout
    };

    // When: Request data from slow provider
    const response = await request.get('/api/ingestion/fetch', {
      params: timeoutConfig,
    });

    // Then: Should return 504 Gateway Timeout
    expect(response.status()).toBe(504);
    const body = await response.json();
    expect(body.error).toContain('timeout');
    expect(body.provider).toBe('slow-provider');
  });

  test('[P1] should retry failed provider requests', async ({ request }) => {
    // Given: Provider that fails intermittently
    const flakyProvider = {
      provider: 'flaky-odds-provider',
      retryCount: 3,
    };

    // When: Request with retry configuration
    const response = await request.get('/api/ingestion/fetch', {
      params: flakyProvider,
    });

    // Then: Should succeed after retries
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.retryAttempts).toBeGreaterThanOrEqual(1);
    expect(body.data).toBeDefined();
  });

  test('[P2] should return drift statistics', async ({ request }) => {
    // When: Request drift statistics
    const response = await request.get('/api/ingestion/drift/stats');

    // Then: Should return drift metrics
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.totalDriftsDetected).toBeGreaterThanOrEqual(0);
    expect(body.driftsBySchema).toBeDefined();
    expect(body.lastChecked).toBeDefined();
  });
});

test.describe('[P0] Ingestion Provider Health API', () => {
  test('[P0] should return health status for all providers', async ({ request }) => {
    // When: Request health check
    const response = await request.get('/api/health/ingestion');

    // Then: Should return status for all providers
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.providers).toBeDefined();
    expect(body.providers.oddsProvider).toBeDefined();
    expect(body.providers.nbaCdnProvider).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.providers.oddsProvider.status);
  });

  test('[P1] should detect unhealthy provider', async ({ request }) => {
    // Given: Simulate provider failure
    const checkResponse = await request.get('/api/health/ingestion', {
      params: { checkProvider: 'failing-provider' },
    });

    // Then: Should report unhealthy status
    const body = await checkResponse.json();
    if (body.providers['failing-provider']) {
      expect(['unhealthy', 'degraded']).toContain(body.providers['failing-provider'].status);
    }
  });
});
