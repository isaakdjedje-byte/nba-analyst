/**
 * Cache and Rate Limiting Test Helpers
 * Utilities for testing cache behavior and rate limiting
 */

import { Page, APIRequestContext, expect } from '@playwright/test';

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  memoryUsed: number;
  totalKeys: number;
  evictedKeys: number;
}

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset: number;
  window: string;
}

/**
 * Helper: Get cache metrics from admin API
 */
export async function getCacheMetrics(request: APIRequestContext): Promise<CacheMetrics> {
  const response = await request.get('/api/admin/cache/metrics');
  expect(response.status()).toBe(200);
  return await response.json();
}

/**
 * Helper: Clear specific cache key
 */
export async function clearCacheKey(request: APIRequestContext, key: string): Promise<void> {
  const response = await request.delete('/api/admin/cache/keys', {
    params: { key },
  });
  expect(response.status()).toBe(200);
}

/**
 * Helper: Clear all cache
 */
export async function clearAllCache(request: APIRequestContext): Promise<void> {
  const response = await request.delete('/api/admin/cache/flush');
  expect(response.status()).toBe(200);
}

/**
 * Helper: Get rate limit status from response headers
 */
export function parseRateLimitHeaders(headers: Record<string, string>): RateLimitStatus | null {
  const limit = headers['x-ratelimit-limit'];
  const remaining = headers['x-ratelimit-remaining'];
  const reset = headers['x-ratelimit-reset'];
  const window = headers['x-ratelimit-window'];

  if (!limit || !remaining) {
    return null;
  }

  return {
    limit: parseInt(limit, 10),
    remaining: parseInt(remaining, 10),
    reset: reset ? parseInt(reset, 10) : 0,
    window: window || 'unknown',
  };
}

/**
 * Helper: Wait for rate limit reset
 */
export async function waitForRateLimitReset(rateLimit: RateLimitStatus): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const waitSeconds = rateLimit.reset - now;

  if (waitSeconds > 0) {
    await new Promise(resolve => setTimeout(resolve, (waitSeconds + 1) * 1000));
  }
}

/**
 * Helper: Make rapid requests to trigger rate limit
 */
export async function triggerRateLimit(
  request: APIRequestContext,
  endpoint: string,
  count: number
): Promise<{ responses: { status: number; headers: Record<string, string> }[]; rateLimited: boolean }> {
  const requests = Array(count).fill(null).map(() =>
    request.get(endpoint).then(r => ({
      status: r.status(),
      headers: r.headers(),
    }))
  );

  const responses = await Promise.all(requests);
  const rateLimited = responses.some(r => r.status === 429);

  return { responses, rateLimited };
}

/**
 * Helper: Verify cache hit/miss headers
 */
export function verifyCacheStatus(
  headers: Record<string, string>,
  expectedStatus: 'HIT' | 'MISS' | 'BYPASS'
): void {
  const cacheStatus = headers['x-cache'] || headers['X-Cache'];
  expect(cacheStatus).toBe(expectedStatus);
}

/**
 * Helper: Get cache TTL from response
 */
export function getCacheTTL(headers: Record<string, string>): number | null {
  const ttl = headers['x-cache-ttl'] || headers['cache-control'];

  if (!ttl) return null;

  // Parse max-age from Cache-Control
  const maxAgeMatch = ttl.match(/max-age=(\d+)/);
  if (maxAgeMatch) {
    return parseInt(maxAgeMatch[1], 10);
  }

  // Direct TTL header
  const directTtl = parseInt(ttl, 10);
  return isNaN(directTtl) ? null : directTtl;
}

/**
 * Helper: Simulate slow response for timeout testing
 */
export async function mockSlowResponse(
  page: Page,
  url: string,
  delayMs: number
): Promise<void> {
  await page.route(url, async (route) => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ delayed: true, delayMs }),
    });
  });
}

/**
 * Helper: Create cache warming request
 */
export async function warmCache(
  request: APIRequestContext,
  endpoints: string[]
): Promise<void> {
  await Promise.all(
    endpoints.map(endpoint => request.get(endpoint))
  );
}

/**
 * Fixture: Create test cache key
 */
export function createTestCacheKey(prefix: string, identifier: string): string {
  return `${prefix}:test:${identifier}:${Date.now()}`;
}

/**
 * Helper: Verify response time is within acceptable range
 */
export async function verifyResponseTime(
  request: APIRequestContext,
  endpoint: string,
  maxMs: number
): Promise<{ duration: number; status: number }> {
  const start = Date.now();
  const response = await request.get(endpoint);
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(maxMs);

  return { duration, status: response.status() };
}

/**
 * Helper: Poll for cache invalidation
 */
export async function waitForCacheInvalidation(
  request: APIRequestContext,
  endpoint: string,
  maxAttempts: number = 10,
  intervalMs: number = 500
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await request.get(endpoint);
    const headers = response.headers();

    if (headers['x-cache'] === 'MISS') {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return false;
}
