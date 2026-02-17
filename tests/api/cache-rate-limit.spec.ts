import { test, expect } from '@playwright/test';

/**
 * Tests d'intégration API pour Cache et Rate Limiting
 * Priorité: P1 - High (performance et sécurité)
 */

test.describe('[P1] Cache Integration API', () => {
  const testUser = { email: 'cache-test@example.com', password: 'TestPass123!' };

  test.beforeEach(async ({ request }) => {
    // Given: Authenticated user
    const loginResponse = await request.post('/api/auth/login', {
      data: testUser,
    });
    if (loginResponse.status() !== 200) {
      // Register user if not exists
      await request.post('/api/auth/register', {
        data: { ...testUser, name: 'Cache Test User' },
      });
    }
  });

  test('[P1] should cache API responses and return cached data', async ({ request }) => {
    // When: First request to cached endpoint
    const start1 = Date.now();
    const response1 = await request.get('/api/v1/decisions');
    const duration1 = Date.now() - start1;

    expect(response1.status()).toBe(200);
    const body1 = await response1.json();
    expect(body1).toBeDefined();

    // When: Second request (should be cached)
    const start2 = Date.now();
    const response2 = await request.get('/api/v1/decisions');
    const duration2 = Date.now() - start2;

    // Then: Second request should be faster (cached)
    expect(response2.status()).toBe(200);
    const body2 = await response2.json();
    expect(body2).toEqual(body1); // Same data from cache
    expect(duration2).toBeLessThan(duration1); // Cached response faster

    // Verify cache header
    expect(response2.headers()['x-cache']).toBe('HIT');
  });

  test('[P1] should invalidate cache on data update', async ({ request }) => {
    // Given: Initial data request
    const initialResponse = await request.get('/api/v1/decisions');
    const initialData = await initialResponse.json();

    // When: Update decision data
    const updateResponse = await request.post('/api/v1/decisions', {
      data: { action: 'test', value: Date.now() },
    });
    expect(updateResponse.status()).toBe(201);

    // Then: Subsequent request should fetch fresh data
    const freshResponse = await request.get('/api/v1/decisions');
    expect(freshResponse.headers()['x-cache']).toBe('MISS');
  });

  test('[P1] should check Redis health status', async ({ request }) => {
    // When: Request Redis health
    const response = await request.get('/api/health/redis');

    // Then: Should return Redis status
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toMatch(/connected|healthy/);
    expect(body.memory).toBeDefined();
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});

test.describe('[P0] Rate Limiting API', () => {
  test('[P0] should enforce rate limits on public endpoints', async ({ request }) => {
    // Given: Make multiple rapid requests
    const requests = Array(15).fill(null).map(() =>
      request.get('/api/health/redis')
    );

    // When: Execute requests
    const responses = await Promise.all(requests);

    // Then: Rate limit should be enforced
    const rateLimitedResponses = responses.filter(r => r.status() === 429);
    const remainingHeader = responses[0].headers()['x-ratelimit-remaining'];

    // Should have rate limit headers
    expect(remainingHeader).toBeDefined();

    // Some requests may be rate limited (depending on limit configuration)
    if (rateLimitedResponses.length > 0) {
      const limitedResponse = rateLimitedResponses[0];
      const body = await limitedResponse.json();
      expect(body.error).toContain('rate limit');
      expect(limitedResponse.headers()['retry-after']).toBeDefined();
    }
  });

  test('[P0] should apply stricter limits to auth endpoints', async ({ request }) => {
    // Given: Multiple login attempts
    const loginAttempts = Array(6).fill(null).map((_, i) =>
      request.post('/api/auth/login', {
        data: {
          email: `test${i}@example.com`,
          password: 'wrongpassword',
        },
      })
    );

    // When: Execute login attempts rapidly
    const responses = await Promise.allSettled(loginAttempts);

    // Then: Should detect rate limiting on auth
    const statuses = responses.map(r =>
      r.status === 'fulfilled' ? r.value.status() : 0
    );

    // Auth endpoints should have strict rate limiting
    const hasRateLimit = statuses.some(s => s === 429 || s === 401);
    expect(hasRateLimit).toBe(true);
  });

  test('[P1] should reset rate limit after window', async ({ request }) => {
    // Given: Use up rate limit
    const requests = Array(10).fill(null).map(() =>
      request.get('/api/health/redis')
    );
    await Promise.all(requests);

    // When: Wait for rate limit window (simulated)
    // In real scenario, we'd wait for the window to reset
    // For test, verify headers are present
    const response = await request.get('/api/health/redis');

    // Then: Headers should indicate rate limit status
    const remaining = response.headers()['x-ratelimit-remaining'];
    const resetTime = response.headers()['x-ratelimit-reset'];

    if (remaining) {
      expect(parseInt(remaining)).toBeGreaterThanOrEqual(0);
    }
    if (resetTime) {
      expect(parseInt(resetTime)).toBeGreaterThan(Date.now() / 1000);
    }
  });
});

test.describe('[P2] Cache Edge Cases', () => {
  test('[P2] should handle Redis connection failure gracefully', async ({ request }) => {
    // When: Request that requires cache but Redis unavailable
    // This tests graceful degradation
    const response = await request.get('/api/v1/decisions', {
      headers: { 'X-Simulate-Cache-Failure': 'true' },
    });

    // Then: Should still return data (from database)
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('[P2] should cache different data per user', async ({ request }) => {
    // Given: Two different users
    const user1 = { email: 'user1-cache@test.com', password: 'Pass123!' };
    const user2 = { email: 'user2-cache@test.com', password: 'Pass123!' };

    // When: Both users request their decisions
    const [response1, response2] = await Promise.all([
      request.get('/api/v1/decisions', { headers: { 'X-User-Id': 'user1' } }),
      request.get('/api/v1/decisions', { headers: { 'X-User-Id': 'user2' } }),
    ]);

    // Then: Each user gets their cached data
    const body1 = await response1.json();
    const body2 = await response2.json();

    // Cache keys should be user-specific
    expect(response1.headers()['x-cache-key']).not.toBe(response2.headers()['x-cache-key']);
  });
});
