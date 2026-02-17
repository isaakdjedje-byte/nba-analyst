import { test, expect } from '@playwright/test';
import { createDecision, createNoBetDecision, createHardStopDecision } from '../support/factories';

/**
 * SKIPPED: Epic 2 not yet implemented
 * 
 * Tests for Decision CRUD operations
 * Re-enable when Epic 2 (Production decisionnelle fiable) is active
 * 
 * @epic 2
 * @tracked false
 * @re-enable When Epic 2 starts - verify API endpoints exist first
 * @priority P0 (core functionality)
 * 
 * Coverage:
 * - Decision creation (POST /api/v1/decisions)
 * - Decision retrieval (GET /api/v1/decisions)
 * - Input validation (matchId, status enum, confidence range)
 * - Edge cases (Hard-Stop status, empty body)
 * 
 * TODO: [Epic-2] Re-enable these tests when API endpoints are implemented
 * TODO: [Epic-2] Add tests for PUT /api/v1/decisions/:id
 * TODO: [Epic-2] Add tests for DELETE /api/v1/decisions/:id
 */

test.describe.skip('Decisions API @api @decisions @epic2', () => {
  test('[P0] should create a new decision @smoke @p0', async ({ request }) => {
    const decision = createDecision({ status: 'Pick', confidence: 0.85 });
    
    const response = await request.post('/api/v1/decisions', {
      data: decision,
    });
    
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toBeTruthy();
    expect(body.matchId).toBe(decision.matchId);
    expect(body.status).toBe('Pick');
    expect(body.published).toBe(false);
    expect(body.createdAt).toBeTruthy();
  });

  test('[P0] should retrieve all decisions @smoke @p0', async ({ request }) => {
    const response = await request.get('/api/v1/decisions');
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.decisions).toBeDefined();
    expect(Array.isArray(body.decisions)).toBe(true);
  });

  test('[P1] should validate required matchId @validation @p1', async ({ request }) => {
    const response = await request.post('/api/v1/decisions', {
      data: { status: 'Pick', confidence: 0.8 },
    });
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('matchId');
  });

  test('[P1] should validate status enum values @validation @p1', async ({ request }) => {
    const response = await request.post('/api/v1/decisions', {
      data: { matchId: 'match-123', status: 'InvalidStatus' },
    });
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('status');
  });

  test('[P1] should validate confidence range @validation @p1', async ({ request }) => {
    const response = await request.post('/api/v1/decisions', {
      data: { matchId: 'match-123', status: 'Pick', confidence: 1.5 },
    });
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Confidence');
  });

  test('[P2] should create decision with Hard-Stop status @p2', async ({ request }) => {
    const decision = createDecision({ status: 'Hard-Stop', confidence: 0.3 });
    
    const response = await request.post('/api/v1/decisions', {
      data: decision,
    });
    
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('Hard-Stop');
  });

  test('[P2] should handle empty request body @error @p2', async ({ request }) => {
    const response = await request.post('/api/v1/decisions', {
      data: {},
    });
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid request body');
  });
});
