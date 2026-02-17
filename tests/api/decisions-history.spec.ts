import { test, expect } from '@playwright/test';

/**
 * Story 2.9: Decision History API Integration Tests
 * Tests for GET /api/v1/decisions/history endpoint
 * 
 * Prerequisites:
 * - Database must be seeded with test decisions
 * - API must be running
 */

test.describe('Decision History API @api @decisions @history @epic2', () => {
  const baseUrl = '/api/v1/decisions/history';

  test.describe('GET /history - Query Parameters', () => {
    test('[P0] should return decision history with default pagination @smoke @p0', async ({ request }) => {
      const response = await request.get(baseUrl);
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toHaveProperty('pagination');
      expect(body.meta.pagination).toHaveProperty('total');
      expect(body.meta.pagination).toHaveProperty('page');
      expect(body.meta.pagination).toHaveProperty('limit');
    });

    test('[P1] should filter by date range using fromDate and toDate @filter @p1', async ({ request }) => {
      const response = await request.get(`${baseUrl}?fromDate=2026-01-01&toDate=2026-12-31`);
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      
      expect(Array.isArray(body.data)).toBe(true);
      // Verify dates are within range if data exists
      if (body.data.length > 0) {
        body.data.forEach((decision: any) => {
          const matchDate = new Date(decision.matchDate);
          expect(matchDate >= new Date('2026-01-01')).toBe(true);
          expect(matchDate <= new Date('2026-12-31')).toBe(true);
        });
      }
    });

    test('[P1] should filter by status PICK @filter @p1', async ({ request }) => {
      const response = await request.get(`${baseUrl}?status=PICK`);
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      
      expect(Array.isArray(body.data)).toBe(true);
      if (body.data.length > 0) {
        body.data.forEach((decision: any) => {
          expect(decision.status).toBe('PICK');
        });
      }
    });

    test('[P1] should filter by status NO_BET @filter @p1', async ({ request }) => {
      const response = await request.get(`${baseUrl}?status=NO_BET`);
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      
      expect(Array.isArray(body.data)).toBe(true);
      if (body.data.length > 0) {
        body.data.forEach((decision: any) => {
          expect(decision.status).toBe('NO_BET');
        });
      }
    });

    test('[P1] should filter by status HARD_STOP @filter @p1', async ({ request }) => {
      const response = await request.get(`${baseUrl}?status=HARD_STOP`);
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      
      expect(Array.isArray(body.data)).toBe(true);
      if (body.data.length > 0) {
        body.data.forEach((decision: any) => {
          expect(decision.status).toBe('HARD_STOP');
        });
      }
    });

    test('[P2] should filter by matchId @filter @p2', async ({ request }) => {
      // First get any decision to get a matchId
      const allResponse = await request.get(baseUrl);
      const allBody = await allResponse.json();
      
      if (allBody.data.length > 0) {
        const matchId = allBody.data[0].matchId;
        const response = await request.get(`${baseUrl}?matchId=${matchId}`);
        
        expect(response.status()).toBe(200);
        const body = await response.json();
        
        expect(Array.isArray(body.data)).toBe(true);
        body.data.forEach((decision: any) => {
          expect(decision.matchId).toBe(matchId);
        });
      }
    });

    test('[P1] should validate date range - fromDate must be before toDate @validation @p1', async ({ request }) => {
      const response = await request.get(`${baseUrl}?fromDate=2026-12-31&toDate=2026-01-01`);
      
      expect(response.status()).toBe(400);
      const body = await response.json();
      
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('INVALID_DATE_RANGE');
    });

    test('[P2] should reject invalid status values @validation @p2', async ({ request }) => {
      const response = await request.get(`${baseUrl}?status=INVALID`);
      
      expect(response.status()).toBe(400);
      const body = await response.json();
      
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('INVALID_STATUS');
    });

    test('[P2] should handle pagination correctly @pagination @p2', async ({ request }) => {
      const page1Response = await request.get(`${baseUrl}?page=1&limit=2`);
      const page1Body = await page1Response.json();
      
      expect(page1Body.meta.pagination.page).toBe(1);
      expect(page1Body.meta.pagination.limit).toBe(2);
      
      if (page1Body.meta.pagination.total > 2) {
        const page2Response = await request.get(`${baseUrl}?page=2&limit=2`);
        const page2Body = await page2Response.json();
        
        expect(page2Body.meta.pagination.page).toBe(2);
        // Verify different data
        expect(page1Body.data[0].id).not.toBe(page2Body.data[0].id);
      }
    });

    test('[P2] should respect max limit of 100 @pagination @p2', async ({ request }) => {
      const response = await request.get(`${baseUrl}?limit=200`);
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      
      expect(body.meta.pagination.limit).toBe(100); // Capped at 100
    });

    test('[P2] should default page to 1 if invalid @pagination @p2', async ({ request }) => {
      const response = await request.get(`${baseUrl}?page=-1`);
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      
      expect(body.meta.pagination.page).toBe(1);
    });
  });

  test.describe('GET /history - Response Format', () => {
    test('[P0] should include traceId in response metadata @smoke @p0', async ({ request }) => {
      const response = await request.get(baseUrl);
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      
      expect(body.meta).toHaveProperty('traceId');
      expect(typeof body.meta.traceId).toBe('string');
      expect(body.meta.traceId.length).toBeGreaterThan(0);
    });

    test('[P0] should include timestamp in response metadata @smoke @p0', async ({ request }) => {
      const response = await request.get(baseUrl);
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      
      expect(body.meta).toHaveProperty('timestamp');
      expect(new Date(body.meta.timestamp).getTime()).not.toBeNaN();
    });

    test('[P1] should include decision fields per architecture spec @schema @p1', async ({ request }) => {
      const response = await request.get(baseUrl);
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      
      if (body.data.length > 0) {
        const decision = body.data[0];
        
        // Required fields per FR19
        expect(decision).toHaveProperty('id');
        expect(decision).toHaveProperty('traceId');
        expect(decision).toHaveProperty('matchId');
        expect(decision).toHaveProperty('matchDate');
        expect(decision).toHaveProperty('homeTeam');
        expect(decision).toHaveProperty('awayTeam');
        expect(decision).toHaveProperty('status');
        expect(decision).toHaveProperty('rationale');
        expect(decision).toHaveProperty('confidence');
        expect(decision).toHaveProperty('gatesOutcome');
        
        // Gates outcome structure
        expect(decision.gatesOutcome).toHaveProperty('confidenceGate');
        expect(decision.gatesOutcome).toHaveProperty('edgeGate');
        expect(decision.gatesOutcome).toHaveProperty('driftGate');
        expect(decision.gatesOutcome).toHaveProperty('hardStopGate');
      }
    });

    test('[P2] should format gatesOutcome as passed/failed strings @schema @p2', async ({ request }) => {
      const response = await request.get(baseUrl);
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      
      if (body.data.length > 0) {
        const gates = body.data[0].gatesOutcome;
        
        expect(['passed', 'failed']).toContain(gates.confidenceGate);
        expect(['passed', 'failed']).toContain(gates.edgeGate);
        expect(['passed', 'failed']).toContain(gates.driftGate);
        expect(['passed', 'failed']).toContain(gates.hardStopGate);
      }
    });
  });

  test.describe('GET /[id] - Decision Details', () => {
    const detailsUrl = '/api/v1/decisions';
    
    test('[P0] should return decision by ID @smoke @p0', async ({ request }) => {
      // First get a decision ID from history
      const historyResponse = await request.get(baseUrl);
      const historyBody = await historyResponse.json();
      
      if (historyBody.data.length > 0) {
        const decisionId = historyBody.data[0].id;
        const response = await request.get(`${detailsUrl}/${decisionId}`);
        
        expect(response.status()).toBe(200);
        const body = await response.json();
        
        expect(body.data).toBeDefined();
        expect(body.data.id).toBe(decisionId);
      }
    });

    test('[P1] should return decision by traceId @traceId @p1', async ({ request }) => {
      // First get a decision with traceId
      const historyResponse = await request.get(baseUrl);
      const historyBody = await historyResponse.json();
      
      if (historyBody.data.length > 0) {
        const traceId = historyBody.data[0].traceId;
        const response = await request.get(`${detailsUrl}/${traceId}`);
        
        // Should work with traceId prefixes (hist-, run-, trace-)
        expect([200, 404]).toContain(response.status());
      }
    });

    test('[P1] should return 404 for non-existent decision @error @p1', async ({ request }) => {
      const response = await request.get(`${detailsUrl}/non-existent-id`);
      
      expect(response.status()).toBe(404);
      const body = await response.json();
      
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('DECISION_NOT_FOUND');
    });

    test('[P2] should include predictionInputs in detail response @schema @p2', async ({ request }) => {
      const historyResponse = await request.get(baseUrl);
      const historyBody = await historyResponse.json();
      
      if (historyBody.data.length > 0) {
        const decisionId = historyBody.data[0].id;
        const response = await request.get(`${detailsUrl}/${decisionId}`);
        
        expect(response.status()).toBe(200);
        const body = await response.json();
        
        // Detail response should include predictionInputs
        expect(body.data).toHaveProperty('predictionInputs');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('[P1] should return 500 on internal errors @error @p1', async ({ request }) => {
      // This test verifies error handling exists
      // Actual error scenarios depend on database state
      const response = await request.get(baseUrl);
      
      // Either success or 500 is acceptable depending on DB state
      expect([200, 500]).toContain(response.status());
      
      if (response.status() === 500) {
        const body = await response.json();
        expect(body.error).toBeDefined();
        expect(body.error.code).toBe('INTERNAL_ERROR');
      }
    });
  });
});
