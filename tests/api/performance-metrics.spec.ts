import { test, expect } from '@playwright/test';

/**
 * ATDD API Tests for Story 4-1: Performance View Metrics
 * TDD RED PHASE - Tests will FAIL until feature is implemented
 * 
 * Acceptance Criteria:
 * - AC1: Performance metrics (accuracy rate, picks count, no-bet count, hard-stop count)
 * - AC4: Date range filtering with URL state
 */

test.describe('Performance Metrics API (ATDD - RED PHASE)', () => {
  
  test.skip('[P0] should return aggregated performance metrics', async ({ request }) => {
    // THIS TEST WILL FAIL - Endpoint /api/v1/metrics/performance not implemented yet
    const response = await request.get('/api/v1/metrics/performance');
    
    // Expected: 200 OK (will get 404)
    expect(response.status()).toBe(200);
    
    const metrics = await response.json();
    
    // Verify data structure
    expect(metrics).toHaveProperty('accuracyRate');
    expect(metrics).toHaveProperty('picksCount');
    expect(metrics).toHaveProperty('noBetCount');
    expect(metrics).toHaveProperty('hardStopCount');
    
    // Verify data types
    expect(typeof metrics.accuracyRate).toBe('number');
    expect(typeof metrics.picksCount).toBe('number');
    expect(typeof metrics.noBetCount).toBe('number');
    expect(typeof metrics.hardStopCount).toBe('number');
    
    // Verify meta envelope
    expect(metrics).toHaveProperty('meta');
    expect(metrics.meta).toHaveProperty('traceId');
    expect(metrics.meta).toHaveProperty('timestamp');
  });

  test.skip('[P0] should filter metrics by date range', async ({ request }) => {
    // THIS TEST WILL FAIL - Date filtering not implemented yet
    const fromDate = '2026-01-01T00:00:00Z';
    const toDate = '2026-01-31T23:59:59Z';
    
    const response = await request.get('/api/v1/metrics/performance', {
      params: {
        fromDate,
        toDate
      }
    });
    
    // Expected: 200 OK with filtered metrics
    expect(response.status()).toBe(200);
    
    const metrics = await response.json();
    
    // Verify filtered response includes date range in meta
    expect(metrics.meta).toHaveProperty('filters');
    expect(metrics.meta.filters.fromDate).toBe(fromDate);
    expect(metrics.meta.filters.toDate).toBe(toDate);
  });

  test.skip('[P1] should return empty metrics when no data in range', async ({ request }) => {
    // THIS TEST WILL FAIL - Empty state handling not implemented yet
    const farFutureDate = '2030-01-01T00:00:00Z';
    
    const response = await request.get('/api/v1/metrics/performance', {
      params: {
        fromDate: farFutureDate,
        toDate: farFutureDate
      }
    });
    
    expect(response.status()).toBe(200);
    
    const metrics = await response.json();
    
    // Empty state should return zeros
    expect(metrics.accuracyRate).toBe(0);
    expect(metrics.picksCount).toBe(0);
    expect(metrics.noBetCount).toBe(0);
    expect(metrics.hardStopCount).toBe(0);
  });

  test.skip('[P1] should return 400 for invalid date format', async ({ request }) => {
    // THIS TEST WILL FAIL - Validation not implemented yet
    const response = await request.get('/api/v1/metrics/performance', {
      params: {
        fromDate: 'invalid-date',
        toDate: 'also-invalid'
      }
    });
    
    // Expected: 400 Bad Request
    expect(response.status()).toBe(400);
    
    const error = await response.json();
    expect(error.error).toBeDefined();
    expect(error.error.code).toBe('INVALID_DATE_FORMAT');
  });

  test.skip('[P2] should return traceId in response meta', async ({ request }) => {
    // THIS TEST WILL FAIL - Trace ID not implemented yet
    const response = await request.get('/api/v1/metrics/performance');
    
    expect(response.status()).toBe(200);
    
    const metrics = await response.json();
    
    // Verify traceId format (UUID)
    expect(metrics.meta.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
    // Verify timestamp is ISO 8601
    expect(metrics.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test.skip('[P3] should handle missing optional date params', async ({ request }) => {
    // THIS TEST WILL FAIL - Optional params handling not implemented yet
    const response = await request.get('/api/v1/metrics/performance');
    
    // Should return all-time metrics when no date params provided
    expect(response.status()).toBe(200);
    
    const metrics = await response.json();
    expect(metrics).toHaveProperty('accuracyRate');
  });
});
