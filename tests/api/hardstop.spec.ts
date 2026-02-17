/**
 * Story 2.6: Hard-Stop Tracker API Tests
 * AC1, AC2, AC3
 * 
 * P0: Hard-stop activation and 100% enforcement
 * P1: Daily run integration
 * P2: Reset and query operations
 */

import { test, expect } from '@playwright/test';
import { PolicyFactory } from '../factories/policy-factory';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

test.describe('Story 2.6: Hard-Stop Tracker @P0 @P1 @story-2.6', () => {
  
  test.describe.configure({ mode: 'serial' });

  // P0: AC1 - Get hard-stop status when active
  test.skip('P0: GET /api/v1/policy/hardstop/status - Returns active hard-stop status', async ({ request }) => {
    // Given: Hard-stop is active (triggered in prior test or setup)
    
    // When: Query hard-stop status
    const response = await request.get(`${API_BASE_URL}/api/v1/policy/hardstop/status`);
    
    // Then: Response status is 200
    expect(response.status()).toBe(200);
    
    const status = await response.json();
    
    // And: Status indicates active hard-stop
    expect(status).toHaveProperty('active');
    expect(status.active).toBe(true);
    
    // And: Cause is provided (AC1)
    expect(status).toHaveProperty('cause');
    expect(typeof status.cause).toBe('string');
    expect(status.cause.length).toBeGreaterThan(0);
    
    // And: Recommendation is provided (AC1)
    expect(status).toHaveProperty('recommendation');
    expect(typeof status.recommendation).toBe('string');
    expect(status.recommendation.length).toBeGreaterThan(0);
    
    // And: Timestamp of activation is provided
    expect(status).toHaveProperty('triggered_at');
    expect(status.triggered_at).toBeTruthy();
    
    // And: Affected predictions count is tracked
    expect(status).toHaveProperty('affected_predictions');
    expect(typeof status.affected_predictions).toBe('number');
    expect(status.affected_predictions).toBeGreaterThanOrEqual(0);
  });

  // P0: AC1 - Get hard-stop status when inactive
  test.skip('P0: GET /api/v1/policy/hardstop/status - Returns inactive status when not triggered', async ({ request }) => {
    // When: Query hard-stop status (assuming system is in clean state)
    const response = await request.get(`${API_BASE_URL}/api/v1/policy/hardstop/status`);
    
    // Then: Response status is 200
    expect(response.status()).toBe(200);
    
    const status = await response.json();
    
    // And: Status indicates inactive
    expect(status.active).toBe(false);
    
    // And: No cause or recommendation when inactive
    expect(status.cause).toBeUndefined();
    expect(status.recommendation).toBeUndefined();
    expect(status.triggered_at).toBeUndefined();
    
    // And: Affected predictions is 0
    expect(status.affected_predictions).toBe(0);
  });

  // P0: AC1 - Hard-stop enforcement 100%
  test.skip('P0: Hard-stop enforcement - No decisions published when active', async ({ request }) => {
    // Given: Hard-stop is active
    await request.post(`${API_BASE_URL}/api/v1/policy/hardstop/reset`, {
      headers: { 'Authorization': 'Bearer admin-token' }
    });
    
    // Trigger hard-stop by evaluating a hard-stop prediction
    const hardStopPrediction = PolicyFactory.createHardStopPrediction();
    await request.post(`${API_BASE_URL}/api/v1/policy/evaluate`, {
      data: hardStopPrediction
    });
    
    // When: Attempt to evaluate more predictions
    const predictions = Array(3).fill(null).map(() => PolicyFactory.createValidPrediction());
    const decisions: string[] = [];
    
    for (const prediction of predictions) {
      const response = await request.post(`${API_BASE_URL}/api/v1/policy/evaluate`, {
        data: prediction
      });
      
      if (response.status() === 200) {
        const result = await response.json();
        decisions.push(result.final_decision);
      } else {
        decisions.push('Blocked');
      }
    }
    
    // Then: No Pick decisions are allowed (100% enforcement)
    const pickDecisions = decisions.filter(d => d === 'Pick');
    expect(pickDecisions.length).toBe(0);
  });

  // P0: AC2 - Daily run status reflects hard-stop
  test.skip('P0: Daily run - Status reflects hard-stop activation', async ({ request }) => {
    // Given: Daily run is in progress
    const runStatus = PolicyFactory.createDailyRunStatus({
      status: 'running',
      total_predictions: 150,
      processed_count: 89
    });
    
    // When: Hard-stop is triggered mid-run
    const hardStopPrediction = PolicyFactory.createHardStopPrediction();
    await request.post(`${API_BASE_URL}/api/v1/policy/evaluate`, {
      data: hardStopPrediction
    });
    
    // And: Query daily run status
    const response = await request.get(`${API_BASE_URL}/api/v1/runs/current/status`);
    const currentRun = await response.json();
    
    // Then: Daily run status reflects hard-stop
    expect(currentRun.status).toBe('hard_stop');
    
    // And: Processed count is at point of stop
    expect(currentRun.processed_count).toBeLessThan(currentRun.total_predictions);
    
    // And: Hard-stop count is tracked
    expect(currentRun).toHaveProperty('hard_stop_count');
    expect(currentRun.hard_stop_count).toBeGreaterThan(0);
  });

  // P0: AC2 - Pending decisions marked as HARD_STOP
  test.skip('P0: Daily run - Pending decisions marked HARD_STOP', async ({ request }) => {
    // Given: Daily run with pending decisions when hard-stop triggered
    
    // When: Query pending decisions
    const response = await request.get(`${API_BASE_URL}/api/v1/decisions/pending`);
    
    // Then: All pending decisions show HARD_STOP status
    const pendingDecisions = await response.json();
    
    for (const decision of pendingDecisions) {
      expect(decision.status).toBe('HARD_STOP');
    }
  });

  // P0: AC3 - Status clearly communicated
  test.skip('P0: AC3 - Hard-stop status clearly communicated in decisions', async ({ request }) => {
    // Given: Hard-stop is active
    const statusResponse = await request.get(`${API_BASE_URL}/api/v1/policy/hardstop/status`);
    const status = await statusResponse.json();
    
    // When: Query decisions endpoint
    const decisionsResponse = await request.get(`${API_BASE_URL}/api/v1/decisions`);
    const decisions = await decisionsResponse.json();
    
    // Then: Status is clearly communicated
    for (const decision of decisions) {
      if (decision.status === 'HARD_STOP') {
        // And: Cause is provided (AC3)
        expect(decision).toHaveProperty('hard_stop_cause');
        expect(decision.hard_stop_cause).toBeTruthy();
        
        // And: Recommended action is provided (AC3)
        expect(decision).toHaveProperty('recommended_action');
        expect(decision.recommended_action).toBeTruthy();
      }
    }
  });

  // P1: Reset hard-stop (admin only)
  test.skip('P1: POST /api/v1/policy/hardstop/reset - Admin can reset hard-stop', async ({ request }) => {
    // Given: Hard-stop is active
    
    // When: Reset hard-stop with admin token
    const response = await request.post(`${API_BASE_URL}/api/v1/policy/hardstop/reset`, {
      headers: {
        'Authorization': 'Bearer admin-token'
      }
    });
    
    // Then: Response status is 200
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.message).toContain('reset');
    
    // And: Hard-stop is now inactive
    const statusResponse = await request.get(`${API_BASE_URL}/api/v1/policy/hardstop/status`);
    const status = await statusResponse.json();
    expect(status.active).toBe(false);
  });

  // P1: Reset requires admin authorization
  test.skip('P1: POST /api/v1/policy/hardstop/reset - Returns 403 for non-admin', async ({ request }) => {
    // Given: Hard-stop is active
    
    // When: Reset without admin token
    const response = await request.post(`${API_BASE_URL}/api/v1/policy/hardstop/reset`, {
      headers: {
        'Authorization': 'Bearer user-token'
      }
    });
    
    // Then: Response status is 403
    expect(response.status()).toBe(403);
  });

  // P1: Reset requires authentication
  test.skip('P1: POST /api/v1/policy/hardstop/reset - Returns 401 without token', async ({ request }) => {
    // When: Reset without any token
    const response = await request.post(`${API_BASE_URL}/api/v1/policy/hardstop/reset`);
    
    // Then: Response status is 401
    expect(response.status()).toBe(401);
  });

  // P2: Reset when not active returns appropriate response
  test.skip('P2: POST /api/v1/policy/hardstop/reset - Returns 200 when already inactive', async ({ request }) => {
    // Given: Hard-stop is already inactive
    
    // When: Reset hard-stop
    const response = await request.post(`${API_BASE_URL}/api/v1/policy/hardstop/reset`, {
      headers: {
        'Authorization': 'Bearer admin-token'
      }
    });
    
    // Then: Response status is 200 (idempotent operation)
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result.message).toContain('already inactive');
  });

  // P2: Hard-stop audit trail
  test.skip('P2: Hard-stop - Activation logged with audit trail', async ({ request }) => {
    // When: Query audit log for hard-stop events
    const response = await request.get(`${API_BASE_URL}/api/v1/audit/hardstop`, {
      headers: {
        'Authorization': 'Bearer admin-token'
      }
    });
    
    // Then: Response status is 200
    expect(response.status()).toBe(200);
    
    const auditLog = await response.json();
    
    // And: Audit log contains hard-stop events
    expect(Array.isArray(auditLog.events)).toBe(true);
    
    if (auditLog.events.length > 0) {
      const lastEvent = auditLog.events[auditLog.events.length - 1];
      expect(lastEvent).toHaveProperty('event_type');
      expect(lastEvent).toHaveProperty('timestamp');
      expect(lastEvent).toHaveProperty('triggered_by');
      expect(['activated', 'reset', 'enforced']).toContain(lastEvent.event_type);
    }
  });
});
