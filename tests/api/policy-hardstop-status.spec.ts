import { test, expect } from '@playwright/test';

/**
 * Policy Hardstop Status API Tests
 * 
 * Tests for /api/v1/policy/hardstop/status endpoint
 * Story 2.6: Provides hard-stop status for operations monitoring
 * 
 * Priority: P0 - Critical path for betting operations
 */
test.describe('Policy Hardstop Status API @api @policy @hardstop', () => {
  const ENDPOINT = '/api/v1/policy/hardstop/status';

  test('[P0] should return hardstop status with all required fields @smoke @p0', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    // Verify response structure
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(body.meta).toHaveProperty('timestamp');
    
    // Verify data fields
    const { data } = body;
    expect(data).toHaveProperty('isActive');
    expect(data).toHaveProperty('currentState');
    expect(data).toHaveProperty('limits');
    
    // currentState should have daily loss tracking
    expect(data.currentState).toHaveProperty('dailyLoss');
    expect(data.currentState).toHaveProperty('consecutiveLosses');
    expect(data.currentState).toHaveProperty('bankrollPercent');
    
    // limits should have configured thresholds
    expect(data.limits).toHaveProperty('dailyLossLimit');
    expect(data.limits).toHaveProperty('consecutiveLosses');
    expect(data.limits).toHaveProperty('bankrollPercent');
  });

  test('[P0] should return valid timestamp in ISO format @smoke @p0', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    const timestamp = body.meta.timestamp;
    
    // Verify timestamp is valid ISO format
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  test('[P1] should return recommendedAction when hardstop is active @p1', async ({ request }) => {
    const response = await request.get(ENDPOINT);
    
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    const { data } = body;
    
    // recommendedAction should always be present
    expect(data).toHaveProperty('recommendedAction');
    
    // If active, should have triggeredAt and triggerReason
    if (data.isActive) {
      expect(data).toHaveProperty('triggeredAt');
      expect(data).toHaveProperty('triggerReason');
      expect(data.triggeredAt).toBeTruthy();
      expect(data.triggerReason).toBeTruthy();
    }
  });

  test('[P2] should handle server errors gracefully @error @p2', async ({ request }) => {
    // This test verifies error handling
    // In production, this might require mocking or specific conditions
    const response = await request.get(ENDPOINT);
    
    // Should either succeed or return proper error structure
    if (response.status() >= 500) {
      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(body.error.code).toBe('HARD_STOP_STATUS_ERROR');
    } else {
      // If successful, verify structure
      const body = await response.json();
      expect(body.data).toBeDefined();
    }
  });
});
