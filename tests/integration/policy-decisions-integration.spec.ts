import { test, expect } from '@playwright/test';

/**
 * Integration test: Policy → Decisions → Runs chain
 * 
 * Tests the critical business flow:
 * 1. Policy evaluation determines betting rules
 * 2. User makes picks based on policy constraints
 * 3. System evaluates decisions against policy
 * 
 * Priority: P1 - Core business logic integration
 * Coverage: Integration tests for cross-component flow
 */
test.describe('Policy-Decisions-Runs Integration', () => {
  
  test.beforeEach(async ({ request }) => {
    // Setup: Ensure we have a clean state
    // This would use fixtures in a full implementation
  });

  test('[P0] should evaluate decision against active policy', async ({ request }) => {
    // Get active policy config
    const policyResponse = await request.get('/api/v1/policy/config');
    expect(policyResponse.status()).toBe(200);
    
    const policy = await policyResponse.json();
    
    // Create a decision that should pass policy
    const decisionData = {
      gameId: 'game-001',
      selectedTeam: 'Lakers',
      odds: 1.75,
      stake: 100,
      policyVersion: policy.version,
    };
    
    const decisionResponse = await request.post('/api/v1/decisions', {
      data: decisionData,
    });
    
    expect(decisionResponse.status()).toBe(201);
    const decision = await decisionResponse.json();
    
    // Verify policy was evaluated
    expect(decision.policyEvaluation).toBeDefined();
    expect(decision.policyEvaluation.passed).toBe(true);
  });

  test('[P0] should block decision that violates policy', async ({ request }) => {
    // Get active policy with restrictions
    const policyResponse = await request.get('/api/v1/policy/config');
    const policy = await policyResponse.json();
    
    // Try to create a decision that violates policy (e.g., odds below minimum)
    const violatingDecision = {
      gameId: 'game-002',
      selectedTeam: 'Warriors',
      odds: 1.05, // Below minimum threshold
      stake: 100,
      policyVersion: policy.version,
    };
    
    const decisionResponse = await request.post('/api/v1/decisions', {
      data: violatingDecision,
    });
    
    // Should be blocked or marked as failed
    const decision = await decisionResponse.json();
    expect(decision.policyEvaluation).toBeDefined();
    expect(decision.policyEvaluation.passed).toBe(false);
  });

  test('[P1] should track policy decisions in history', async ({ request }) => {
    // Create a decision
    const decisionData = {
      gameId: 'game-003',
      selectedTeam: 'Celtics',
      odds: 2.0,
      stake: 50,
    };
    
    await request.post('/api/v1/decisions', { data: decisionData });
    
    // Check history includes policy evaluation
    const historyResponse = await request.get('/api/v1/decisions/history');
    expect(historyResponse.status()).toBe(200);
    
    const history = await historyResponse.json();
    expect(history.decisions).toBeDefined();
    
    // Most recent should have policy evaluation
    const recentDecision = history.decisions[0];
    expect(recentDecision.policyEvaluation).toBeDefined();
  });

  test('[P1] should handle policy version mismatch', async ({ request }) => {
    // Try to use an old policy version
    const oldDecision = {
      gameId: 'game-004',
      selectedTeam: 'Heat',
      odds: 1.8,
      stake: 100,
      policyVersion: 'v0.0.0', // Old version
    };
    
    const response = await request.post('/api/v1/decisions', {
      data: oldDecision,
    });
    
    // Should either reject or automatically upgrade
    expect([400, 201]).toContain(response.status());
  });

  test('[P2] should calculate Kelly criterion with policy bounds', async ({ request }) => {
    // Get policy config with Kelly settings
    const policyResponse = await request.get('/api/v1/policy/config');
    const policy = await policyResponse.json();
    
    // Create decision and verify Kelly calculation respects policy
    const decisionData = {
      gameId: 'game-005',
      selectedTeam: 'Nets',
      odds: 2.5,
      stake: 100, // This might be adjusted by policy
      policyVersion: policy.version,
    };
    
    const response = await request.post('/api/v1/decisions', { data: decisionData });
    const decision = await response.json();
    
    // If policy enforces Kelly bounds, stake should be adjusted
    if (policy.kellySettings?.enabled) {
      expect(decision.adjustedStake).toBeDefined();
    }
  });
});
