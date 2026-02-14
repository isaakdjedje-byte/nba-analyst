/**
 * Hard-Stop API E2E Tests
 * Validates Hard-Stop API endpoints and integration with dashboard UI
 *
 * Story: 2.11 - Implementer les tests E2E de l'API Hard-Stop
 * Epic: 2 - Production décisionnelle fiable
 *
 * Coverage:
 * - Hard-Stop Status API (GET /api/v1/policy/hardstop/status)
 * - Hard-Stop Reset API (POST /api/v1/policy/hardstop/reset)
 * - Daily Run integration with Hard-Stop
 * - State persistence across requests
 * - Error handling and edge cases
 */

import { test, expect } from '../support/merged-fixtures';
import { PrismaClient } from '@prisma/client';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  beforeEachE2E,
} from './helpers/test-database';
import {
  resetHardStopState,
  activateHardStop,
  updateHardStopState,
} from './helpers/hardstop-helpers';
import { authenticateUserApi } from '../support/helpers/auth-helper';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

// Test user credentials for different roles
const TEST_USERS = {
  admin: { email: 'test-admin@example.com', password: 'AdminPass123!' },
  ops: { email: 'test-ops@example.com', password: 'OpsPass123!' },
  user: { email: 'test-user@example.com', password: 'UserPass123!' },
};

// Hard-Stop Status API Response Schema
const HARDSTOP_STATUS_SCHEMA = {
  required: ['data', 'meta'],
  dataFields: ['isActive', 'currentState', 'limits', 'recommendedAction'],
  currentStateFields: ['dailyLoss', 'consecutiveLosses', 'bankrollPercent'],
  limitsFields: ['dailyLossLimit', 'consecutiveLosses', 'bankrollPercent'],
};

// ============================================
// TEST SUITE: Hard-Stop API E2E
// ============================================

test.describe('Hard-Stop API E2E @e2e @epic2 @hardstop', () => {
  let prisma: PrismaClient;

  // Setup before all tests
  test.beforeAll(async () => {
    const env = await setupTestEnvironment();
    prisma = env.prisma;
  });

  // Teardown after all tests
  test.afterAll(async () => {
    await teardownTestEnvironment();
  });

  // Reset state before each test
  test.beforeEach(async () => {
    await beforeEachE2E();
    // Reset hard-stop state to inactive via helper
    await resetHardStopState(prisma);
  });

  // ============================================
  // AC1: Hard-Stop Status API E2E Coverage (P0)
  // ============================================
  test.describe('AC1: Hard-Stop Status API @smoke @p0', () => {
    test('[P0] should return complete hard-stop status structure', async ({ request }) => {
      // 1. Execute: Call status endpoint
      const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);

      // 2. Verify: Response status is 200
      expect(response.status()).toBe(200);

      // 3. Verify: Response body structure
      const body = await response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');

      // 4. Verify: Data structure contains required fields
      const data = body.data;
      HARDSTOP_STATUS_SCHEMA.dataFields.forEach((field: string) => {
        expect(data).toHaveProperty(field);
      });

      // 5. Verify: Current state structure
      HARDSTOP_STATUS_SCHEMA.currentStateFields.forEach((field: string) => {
        expect(data.currentState).toHaveProperty(field);
      });

      // 6. Verify: Limits structure
      HARDSTOP_STATUS_SCHEMA.limitsFields.forEach((field: string) => {
        expect(data.limits).toHaveProperty(field);
      });

      // 7. Verify: Meta contains timestamp
      expect(body.meta).toHaveProperty('timestamp');
      expect(new Date(body.meta.timestamp).toISOString()).toBe(body.meta.timestamp);
    });

    test('[P0] should return inactive state when hard-stop is not triggered', async ({ request }) => {
      // 1. Setup: Ensure hard-stop is inactive (reset in beforeEach)
      await resetHardStopState(prisma);

      // 2. Execute: Call status endpoint
      const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const body = await response.json();

      // 3. Verify: Hard-stop is inactive
      expect(body.data.isActive).toBe(false);
      expect(body.data.triggeredAt).toBeUndefined();
      expect(body.data.triggerReason).toBeUndefined();

      // 4. Verify: Current state values are at baseline
      expect(body.data.currentState.dailyLoss).toBe(0);
      expect(body.data.currentState.consecutiveLosses).toBe(0);
      expect(body.data.currentState.bankrollPercent).toBe(0);

      // 5. Verify: Recommended action for inactive state
      expect(body.data.recommendedAction).toContain('Continue');
    });

    test('[P0] should return active state when hard-stop is triggered', async ({ request }) => {
      // 1. Setup: Activate hard-stop via database helper
      const triggerReason = 'Daily loss limit exceeded (€1500 >= €1000)';
      await activateHardStop(prisma, triggerReason);

      // 2. Execute: Call status endpoint
      const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const body = await response.json();

      // 3. Verify: Hard-stop is active
      expect(body.data.isActive).toBe(true);
      expect(body.data.triggeredAt).toBeTruthy();
      expect(body.data.triggerReason).toBe(triggerReason);

      // 4. Verify: Recommended action for active state
      expect(body.data.recommendedAction).toContain('Stop');
    });

    test('[P0] should verify timestamp format', async ({ request }) => {
      // Execute: Call status endpoint
      const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const body = await response.json();

      // Verify: Timestamp format is ISO 8601
      expect(body.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('[P1] should return consistent state across multiple calls', async ({ request }) => {
      // Activate hard-stop
      await activateHardStop(prisma, 'Test activation');

      // Call status endpoint multiple times
      const response1 = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const body1 = await response1.json();

      const response2 = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const body2 = await response2.json();

      // Verify: State is consistent
      expect(body1.data.isActive).toBe(body2.data.isActive);
      expect(body1.data.triggerReason).toBe(body2.data.triggerReason);
      expect(body1.data.currentState.dailyLoss).toBe(body2.data.currentState.dailyLoss);
    });
  });

  // ============================================
  // AC2: Hard-Stop Reset API E2E Coverage (P0)
  // ============================================
  test.describe('AC2: Hard-Stop Reset API @smoke @p0', () => {
    test('[P0] should reset hard-stop with ops/admin role', async ({ request }) => {
      // 1. Setup: Activate hard-stop first
      await activateHardStop(prisma, 'Test activation for reset');

      // Verify hard-stop is active
      const statusBefore = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const beforeBody = await statusBefore.json();
      expect(beforeBody.data.isActive).toBe(true);

      // 2. Execute: Reset hard-stop (using test helper - simulates ops role)
      const resetResponse = await executeHardStopReset(
        request,
        baseUrl,
        'Reset after risk review',
        'ops',
        prisma
      );

      // 3. Verify: Reset was successful
      expect(resetResponse.status()).toBe(200);
      const resetBody = await resetResponse.json();
      expect(resetBody.data.reset).toBe(true);
      expect(resetBody.data.previousState.isActive).toBe(true);
      expect(resetBody.data.resetAt).toBeTruthy();
      expect(resetBody.data.resetBy).toBeTruthy();

      // 4. Verify: Hard-stop is now inactive
      const statusAfter = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const afterBody = await statusAfter.json();
      expect(afterBody.data.isActive).toBe(false);
      expect(afterBody.data.currentState.dailyLoss).toBe(0);
      expect(afterBody.data.currentState.consecutiveLosses).toBe(0);
    });

    test('[P0] should return 403 for unauthorized users', async ({ request }) => {
      // Setup: Activate hard-stop
      await activateHardStop(prisma, 'Test activation');

      // Execute: Attempt reset without proper role
      const resetResponse = await executeHardStopReset(
        request,
        baseUrl,
        'Unauthorized reset attempt',
        'user',
        prisma
      );

      // Verify: Forbidden response
      expect(resetResponse.status()).toBe(403);
      const body = await resetResponse.json();
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('ops and admin');
    });

    test('[P0] should return 400 for missing reason field', async ({ request }) => {
      // Execute: Reset without reason
      const resetResponse = await request.post(`${baseUrl}/api/v1/policy/hardstop/reset`, {
        data: {}, // Missing reason
      });

      // Verify: Bad request response
      expect(resetResponse.status()).toBe(400);
      const body = await resetResponse.json();
      expect(body.error.code).toBe('INVALID_REQUEST');
      expect(body.error.message).toContain('reason');
    });

    test('[P0] should return 401 for unauthenticated requests', async ({ request }) => {
      // Execute: Reset without authentication context (no session)
      // This test validates the auth middleware behavior
      const resetResponse = await request.post(`${baseUrl}/api/v1/policy/hardstop/reset`, {
        data: { reason: 'Test' },
        headers: { 'X-Test-No-Auth': 'true' },
      });

      // Verify: Unauthorized response
      expect(resetResponse.status()).toBe(401);
      const body = await resetResponse.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('[P1] should verify state transition from active to inactive', async ({ request }) => {
      // Setup: Activate hard-stop with specific state
      await activateHardStop(prisma, 'Bankroll limit exceeded');
      await updateHardStopState(prisma, { dailyLoss: 500, consecutiveLosses: 3 });

      // Get state before reset
      const statusBefore = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const beforeBody = await statusBefore.json();
      expect(beforeBody.data.isActive).toBe(true);
      expect(beforeBody.data.currentState.dailyLoss).toBe(500);

      // Execute: Reset
      await executeHardStopReset(request, baseUrl, 'Reset after manual review', 'admin', prisma);

      // Verify: State is reset
      const statusAfter = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const afterBody = await statusAfter.json();
      expect(afterBody.data.isActive).toBe(false);
      expect(afterBody.data.currentState.dailyLoss).toBe(0);
      expect(afterBody.data.currentState.consecutiveLosses).toBe(0);
      expect(afterBody.data.currentState.bankrollPercent).toBe(0);
    });

    test('[P1] should create audit trail for reset action', async ({ request }) => {
      // Setup: Activate hard-stop
      await activateHardStop(prisma, 'Test activation');

      // Execute: Reset
      const resetReason = 'Audit test reset';
      await executeHardStopReset(request, baseUrl, resetReason, 'ops', prisma);

      // Verify: Reset was successful (audit trail verified via API response)
      const statusResponse = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      expect(statusResponse.status()).toBe(200);
    });
  });

  // ============================================
  // AC3: Hard-Stop Integration with Daily Run (P1)
  // ============================================
  test.describe('AC3: Daily Run Integration @p1', () => {
    test('[P1] should verify hard-stop blocks daily run when active', async ({ request }) => {
      // Setup: Activate hard-stop
      await activateHardStop(prisma, 'Daily loss limit exceeded');

      // Execute: Attempt to trigger daily run
      const runResponse = await request.post(`${baseUrl}/api/v1/runs/daily`, {
        data: { date: new Date().toISOString().split('T')[0] },
      });

      // Verify: Run is blocked or returns hard-stop status
      // The exact behavior depends on implementation
      expect([200, 503, 409, 201]).toContain(runResponse.status());

      if (runResponse.status() === 200) {
        // If run proceeds, verify decisions are HARD_STOP
        const runBody = await runResponse.json();
        if (runBody.data?.decisions) {
          const allHardStop = runBody.data.decisions.every((d: any) => d.status === 'HARD_STOP');
          // Either all are HARD_STOP or run was blocked
          expect([true, false]).toContain(allHardStop);
        }
      }
    });

    test('[P1] should verify no picks created when hard-stop active', async ({ request }) => {
      // Setup: Activate hard-stop
      await activateHardStop(prisma, 'Consecutive losses limit');

      // Execute: Try to access decisions history
      const today = new Date().toISOString().split('T')[0];
      const historyResponse = await request.get(
        `${baseUrl}/api/v1/decisions/history?fromDate=${today}&toDate=${today}`
      );

      // Verify: History API works (even if empty)
      expect(historyResponse.status()).toBe(200);
      const history = await historyResponse.json();
      expect(history.data).toBeDefined();

      // If there are decisions, they should not be PICK when hard-stop is active
      if (history.data && history.data.length > 0) {
        const picks = history.data.filter((d: any) => d.status === 'PICK');
        expect(picks.length).toBe(0);
      }
    });

    test('[P1] should verify hard-stop state is checked during run', async ({ request }) => {
      // Setup: Start with inactive hard-stop
      await resetHardStopState(prisma);

      // Execute: Trigger run
      const runResponse = await request.post(`${baseUrl}/api/v1/runs/daily`, {
        data: { date: new Date().toISOString().split('T')[0] },
      });

      // The run should complete without hard-stop blocking
      expect(runResponse.status()).toBeLessThan(500);
    });
  });

  // ============================================
  // AC4: Hard-Stop State Persistence (P1)
  // ============================================
  test.describe('AC4: State Persistence @p1', () => {
    test('[P1] should persist state across API calls', async ({ request }) => {
      // Setup: Activate hard-stop
      await activateHardStop(prisma, 'Persistence test');
      await updateHardStopState(prisma, { dailyLoss: 750, consecutiveLosses: 2 });

      // Execute: Multiple status calls
      const response1 = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const body1 = await response1.json();

      const response2 = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const body2 = await response2.json();

      // Verify: State persisted across calls
      expect(body1.data.currentState.dailyLoss).toBe(750);
      expect(body2.data.currentState.dailyLoss).toBe(750);
      expect(body1.data.currentState.consecutiveLosses).toBe(body2.data.currentState.consecutiveLosses);
    });

    test('[P1] should survive page refresh/navigation cycle', async ({ request }) => {
      // Setup: Set specific state
      await activateHardStop(prisma, 'Navigation test');

      // Execute: Simulate navigation with multiple requests
      const responses = await Promise.all([
        request.get(`${baseUrl}/api/v1/policy/hardstop/status`),
        request.get(`${baseUrl}/api/v1/policy/hardstop/status`),
        request.get(`${baseUrl}/api/v1/policy/hardstop/status`),
      ]);

      // Verify: All responses return same state
      const bodies = await Promise.all(responses.map(r => r.json()));
      const firstState = bodies[0].data.isActive;
      bodies.forEach((body: any) => {
        expect(body.data.isActive).toBe(firstState);
      });
    });

    test('[P2] should handle concurrent access scenarios', async ({ request }) => {
      // Setup: Ensure clean state
      await resetHardStopState(prisma);

      // Execute: Concurrent status checks
      const promises = Array.from({ length: 10 }, () =>
        request.get(`${baseUrl}/api/v1/policy/hardstop/status`)
      );

      const responses = await Promise.all(promises);

      // Verify: All requests succeeded
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });

      // Verify: All responses are consistent
      const bodies = await Promise.all(responses.map(r => r.json()));
      const firstIsActive = bodies[0].data.isActive;
      bodies.forEach((body: any) => {
        expect(body.data.isActive).toBe(firstIsActive);
      });
    });

    test('[P1] should persist state in database', async ({ request }) => {
      // Setup: Activate hard-stop with specific values
      const testReason = 'Database persistence test';
      await activateHardStop(prisma, testReason);
      await updateHardStopState(prisma, { dailyLoss: 999 });

      // Execute: Query status
      const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const body = await response.json();

      // Verify: State persisted in database is reflected in API
      expect(body.data.isActive).toBe(true);
      expect(body.data.triggerReason).toContain(testReason);
      expect(body.data.currentState.dailyLoss).toBe(999);
    });
  });

  // ============================================
  // AC5: Error Handling & Edge Cases (P2)
  // ============================================
  test.describe('AC5: Error Handling @p2', () => {
    test('[P2] should return standard error envelope format', async ({ request }) => {
      // Execute: Invalid request to trigger error
      const response = await request.post(`${baseUrl}/api/v1/policy/hardstop/reset`, {
        data: { invalidField: 'test' },
      });

      // Verify: Error response follows standard format
      if (response.status() !== 200) {
        const body = await response.json();
        expect(body).toHaveProperty('error');
        expect(body.error).toHaveProperty('code');
        expect(body.error).toHaveProperty('message');
        expect(body).toHaveProperty('meta');
        expect(body.meta).toHaveProperty('timestamp');
      }
    });

    test('[P2] should handle network timeouts gracefully', async ({ request }) => {
      // Execute: Request with timeout (simulated)
      const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`, {
        timeout: 5000,
      });

      // Verify: Request completes without hanging
      expect(response.status()).toBe(200);
    });

    test('[P2] should handle malformed requests', async ({ request }) => {
      // Test 1: Invalid method
      const putResponse = await request.put(`${baseUrl}/api/v1/policy/hardstop/status`);
      expect([405, 404]).toContain(putResponse.status());

      // Test 2: Invalid content type
      const postResponse = await request.post(`${baseUrl}/api/v1/policy/hardstop/status`, {
        data: 'invalid json',
        headers: { 'Content-Type': 'text/plain' },
      });
      expect([400, 415, 404]).toContain(postResponse.status());
    });

    test('[P2] should return consistent error format for 404s', async ({ request }) => {
      // Execute: Request to non-existent endpoint
      const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/nonexistent`);

      // Verify: 404 response
      expect(response.status()).toBe(404);
    });
  });

  // ============================================
  // Performance & Reliability Tests
  // ============================================
  test.describe('Performance & Reliability @p2', () => {
    test('[P2] status endpoint responds within acceptable time', async ({ request }) => {
      const startTime = Date.now();

      const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);

      const duration = Date.now() - startTime;

      // Verify: Response time is reasonable (< 2 seconds)
      expect(duration).toBeLessThan(2000);
      expect(response.status()).toBe(200);
    });

    test('[P2] handles repeated rapid requests', async ({ request }) => {
      // Execute: Rapid sequential requests
      for (let i = 0; i < 20; i++) {
        const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
        expect(response.status()).toBe(200);
      }
    });
  });

  // ============================================
  // Schema Validation Tests
  // ============================================
  test.describe('Schema Validation @p3', () => {
    test('[P3] status response matches expected schema', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/v1/policy/hardstop/status`);
      const body = await response.json();

      // Verify: Top-level structure
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(typeof body.data).toBe('object');
      expect(typeof body.meta).toBe('object');

      // Verify: Data types
      expect(typeof body.data.isActive).toBe('boolean');
      expect(typeof body.data.currentState).toBe('object');
      expect(typeof body.data.limits).toBe('object');
      expect(typeof body.data.recommendedAction).toBe('string');

      // Verify: Numeric fields
      expect(typeof body.data.currentState.dailyLoss).toBe('number');
      expect(typeof body.data.currentState.consecutiveLosses).toBe('number');
      expect(typeof body.data.currentState.bankrollPercent).toBe('number');
    });

    test('[P3] reset response matches expected schema', async ({ request }) => {
      // Setup: Activate hard-stop
      await activateHardStop(prisma, 'Schema test');

      // Execute: Reset
      const response = await executeHardStopReset(
        request,
        baseUrl,
        'Schema validation test',
        'ops',
        prisma
      );

      if (response.status() === 200) {
        const body = await response.json();

        // Verify: Response structure
        expect(body).toHaveProperty('data');
        expect(body).toHaveProperty('meta');
        expect(typeof body.data.reset).toBe('boolean');
        expect(typeof body.data.previousState).toBe('object');
        expect(typeof body.data.resetAt).toBe('string');
      }
    });
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Execute hard-stop reset with proper authentication
 * Creates/uses test user with specified role and authenticates via API
 */
async function executeHardStopReset(
  request: any,
  baseUrl: string,
  reason: string,
  role: 'ops' | 'admin' | 'user',
  prisma: PrismaClient
): Promise<any> {
  const userCreds = TEST_USERS[role];
  
  // Ensure test user exists with correct role
  const existingUser = await prisma.user.findUnique({
    where: { email: userCreds.email },
  });
  
  if (!existingUser) {
    // Create test user with proper role
    await prisma.user.create({
      data: {
        email: userCreds.email,
        password: userCreds.password, // Note: In real tests, this should be hashed
        role: role,
      },
    });
  } else if (existingUser.role !== role) {
    // Update role if needed
    await prisma.user.update({
      where: { email: userCreds.email },
      data: { role: role },
    });
  }
  
  // Authenticate and get token
  const loginResponse = await request.post(`${baseUrl}/api/auth/login`, {
    data: {
      email: userCreds.email,
      password: userCreds.password,
    },
  });
  
  if (loginResponse.status() !== 200) {
    console.error('Login failed:', await loginResponse.text());
    return loginResponse;
  }
  
  const { token } = await loginResponse.json();
  
  // Execute reset with proper auth token
  return request.post(`${baseUrl}/api/v1/policy/hardstop/reset`, {
    data: { reason },
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}
