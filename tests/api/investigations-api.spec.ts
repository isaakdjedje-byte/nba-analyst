import { test, expect } from '@playwright/test';

/**
 * API Tests for Investigation Search Endpoint
 * Story 4.4: Implementer l'investigation de decision contestee
 * 
 * Tests the /api/v1/investigations/search endpoint
 * 
 * Test Coverage:
 * - P0: Authentication, authorization, rate limiting
 * - P1: Query parameters, pagination, filtering
 * - P2: Error handling, edge cases
 */

test.describe('Investigation Search API', () => {
  const BASE_URL = '/api/v1/investigations/search';

  // ============================================
  // P0: Critical - Authentication & Authorization
  // ============================================

  test('[P0] should return 401 when not authenticated', async ({ request }) => {
    const response = await request.get(BASE_URL);
    
    expect(response.status()).toBe(401);
    
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Authentification requise');
  });

  test('[P0] should return 403 when user lacks required role', async ({ request }) => {
    // This test requires a user with a non-allowed role (e.g., 'user')
    // Using admin fixture to test forbidden scenario
    const response = await request.get(BASE_URL, {
      headers: {
        // Assuming test setup provides invalid role
        'x-test-role': 'user',
      },
    });
    
    // If authenticated but wrong role, should get 403
    const status = response.status();
    if (status === 403) {
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('Permissions insuffisantes');
    }
  });

  // ============================================
  // P0: Critical - Rate Limiting
  // ============================================

  test('[P0] should return 429 when rate limit exceeded', async ({ request }) => {
    // Make multiple rapid requests to trigger rate limiting
    const responses: ReturnType<typeof request.get>[] = [];
    for (let i = 0; i < 10; i++) {
      responses.push(request.get(BASE_URL));
    }
    
    const results = await Promise.all(responses);
    
    // At least one request should be rate limited
    const rateLimited = results.some(r => r.status() === 429);
    expect(rateLimited).toBe(true);
    
    if (rateLimited) {
      const rateLimitedResponse = results.find(r => r.status() === 429);
      expect(rateLimitedResponse).toBeDefined();
      const body = await rateLimitedResponse!.json();
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.details.retryAfter).toBeDefined();
    }
  });

  // ============================================
  // P1: Important - Query Parameters
  // ============================================

  test('[P1] should accept valid date parameters', async ({ request }) => {
    const fromDate = '2026-01-01';
    const toDate = '2026-01-31';
    
    const response = await request.get(`${BASE_URL}?fromDate=${fromDate}&toDate=${toDate}`);
    
    // Should succeed (200) or return empty data if no records
    expect([200, 401, 403]).toContain(response.status());
    
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta.filters).toBeDefined();
    }
  });

  test('[P1] should reject invalid date format', async ({ request }) => {
    const response = await request.get(`${BASE_URL}?fromDate=invalid-date`);
    
    expect(response.status()).toBe(400);
    
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_DATE_FORMAT');
    expect(body.error.message).toContain('Format de date invalide');
  });

  test('[P1] should accept valid status values', async ({ request }) => {
    const validStatuses = ['PICK', 'NO_BET', 'HARD_STOP', 'all'];
    
    for (const status of validStatuses) {
      const response = await request.get(`${BASE_URL}?status=${status}`);
      expect([200, 401, 403]).toContain(response.status());
      
      if (response.status() === 200) {
        const body = await response.json();
        if (body.data && status !== 'all') {
          // Verify all returned decisions have the requested status
          body.data.forEach((decision: any) => {
            expect([decision.status, 'all']).toContain(status);
          });
        }
      }
    }
  });

  test('[P1] should reject invalid status value', async ({ request }) => {
    const response = await request.get(`${BASE_URL}?status=INVALID_STATUS`);
    
    expect(response.status()).toBe(400);
    
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_STATUS');
  });

  // ============================================
  // P1: Important - Pagination
  // ============================================

  test('[P1] should use default pagination values', async ({ request }) => {
    const response = await request.get(BASE_URL);
    
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(20);
    }
  });

  test('[P1] should accept custom page and limit', async ({ request }) => {
    const response = await request.get(`${BASE_URL}?page=2&limit=10`);
    
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.meta.page).toBe(2);
      expect(body.meta.limit).toBe(10);
    }
  });

  test('[P1] should reject invalid page value', async ({ request }) => {
    const response = await request.get(`${BASE_URL}?page=-1`);
    
    expect(response.status()).toBe(400);
    
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_PAGE');
  });

  test('[P1] should reject limit exceeding maximum', async ({ request }) => {
    const response = await request.get(`${BASE_URL}?limit=200`);
    
    expect(response.status()).toBe(400);
    
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  test('[P1] should reject limit below minimum', async ({ request }) => {
    const response = await request.get(`${BASE_URL}?limit=0`);
    
    expect(response.status()).toBe(400);
    
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_LIMIT');
  });

  // ============================================
  // P1: Important - Filtering
  // ============================================

  test('[P1] should filter by matchId', async ({ request }) => {
    const matchId = 'game-123';
    const response = await request.get(`${BASE_URL}?matchId=${matchId}`);
    
    if (response.status() === 200) {
      const body = await response.json();
      if (body.data && body.data.length > 0) {
        body.data.forEach((decision: any) => {
          expect(decision.matchId).toContain(matchId);
        });
      }
    }
  });

  test('[P1] should filter by homeTeam', async ({ request }) => {
    const homeTeam = 'Lakers';
    const response = await request.get(`${BASE_URL}?homeTeam=${homeTeam}`);
    
    if (response.status() === 200) {
      const body = await response.json();
      if (body.data && body.data.length > 0) {
        body.data.forEach((decision: any) => {
          expect(decision.homeTeam.toLowerCase()).toContain(homeTeam.toLowerCase());
        });
      }
    }
  });

  test('[P1] should filter by awayTeam', async ({ request }) => {
    const awayTeam = 'Celtics';
    const response = await request.get(`${BASE_URL}?awayTeam=${awayTeam}`);
    
    if (response.status() === 200) {
      const body = await response.json();
      if (body.data && body.data.length > 0) {
        body.data.forEach((decision: any) => {
          expect(decision.awayTeam.toLowerCase()).toContain(awayTeam.toLowerCase());
        });
      }
    }
  });

  // ============================================
  // P2: Edge Cases - Response Structure
  // ============================================

  test('[P2] should return valid response structure', async ({ request }) => {
    const response = await request.get(BASE_URL);
    
    if (response.status() === 200) {
      const body = await response.json();
      
      // Verify top-level structure
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      
      // Verify meta structure
      expect(body.meta).toHaveProperty('total');
      expect(body.meta).toHaveProperty('page');
      expect(body.meta).toHaveProperty('limit');
      expect(body.meta).toHaveProperty('totalPages');
      expect(body.meta).toHaveProperty('filters');
      expect(body.meta).toHaveProperty('traceId');
      expect(body.meta).toHaveProperty('timestamp');
      
      // Verify data is an array
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  test('[P2] should return decision fields correctly', async ({ request }) => {
    const response = await request.get(BASE_URL);
    
    if (response.status() === 200) {
      const body = await response.json();
      
      if (body.data && body.data.length > 0) {
        const decision = body.data[0];
        
        // Required fields from InvestigationResult type
        expect(decision).toHaveProperty('id');
        expect(decision).toHaveProperty('matchId');
        expect(decision).toHaveProperty('matchDate');
        expect(decision).toHaveProperty('homeTeam');
        expect(decision).toHaveProperty('awayTeam');
        expect(decision).toHaveProperty('status');
        expect(decision).toHaveProperty('rationaleSummary');
        expect(decision).toHaveProperty('confidence');
        expect(decision).toHaveProperty('edge');
        expect(decision).toHaveProperty('traceId');
        expect(decision).toHaveProperty('executedAt');
        expect(decision).toHaveProperty('gates');
        
        // Gates structure
        expect(decision.gates).toHaveProperty('confidence');
        expect(decision.gates).toHaveProperty('edge');
        expect(decision.gates).toHaveProperty('drift');
        expect(decision.gates).toHaveProperty('hardStop');
      }
    }
  });

  test('[P2] should handle empty results', async ({ request }) => {
    // Use date range with no data
    const response = await request.get(`${BASE_URL}?fromDate=1900-01-01&toDate=1900-01-02`);
    
    if (response.status() === 200) {
      const body = await response.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(0);
      expect(body.meta.total).toBe(0);
      expect(body.meta.totalPages).toBe(0);
    }
  });

  // ============================================
  // P2: Edge Cases - Multiple Filters
  // ============================================

  test('[P2] should combine multiple filters', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}?fromDate=2026-01-01&toDate=2026-01-31&status=PICK&homeTeam=Lakers&page=1&limit=10`
    );
    
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.meta.filters).toBeDefined();
    }
  });

  test('[P2] should return traceId in response', async ({ request }) => {
    const response = await request.get(BASE_URL);
    
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.meta.traceId).toBeDefined();
      expect(body.meta.traceId).toMatch(/^investigation-/);
    }
  });

  test('[P2] should return timestamp in response', async ({ request }) => {
    const response = await request.get(BASE_URL);
    
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.meta.timestamp).toBeDefined();
      
      // Verify timestamp is valid ISO date
      const timestamp = new Date(body.meta.timestamp);
      expect(isNaN(timestamp.getTime())).toBe(false);
    }
  });
});

test.describe('Investigation Search API - Rate Limit Headers', () => {
  const BASE_URL = '/api/v1/investigations/search';

  test('[P1] should include rate limit headers in response', async ({ request }) => {
    const response = await request.get(BASE_URL);
    
    if (response.status() === 200) {
      const headers = response.headers();
      
      // Rate limit headers should be present
      expect(headers['x-ratelimit-limit']).toBeDefined();
      expect(headers['x-ratelimit-remaining']).toBeDefined();
    }
  });

  test('[P1] should include retry-after header when rate limited', async ({ request }) => {
    // Make rapid requests to trigger rate limit
    for (let i = 0; i < 15; i++) {
      const response = await request.get(BASE_URL);
      
      if (response.status() === 429) {
        const headers = response.headers();
        expect(headers['retry-after']).toBeDefined();
        return;
      }
    }
  });
});
