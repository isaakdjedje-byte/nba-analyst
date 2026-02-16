/**
 * ATDD Tests for B2B Explainability Endpoint (Story 6.2)
 * 
 * Tests for B2B API endpoint:
 * - GET /api/v1/b2b/decisions/:id/explain - Get explanation for a decision
 * 
 * Story: Implementer les endpoints d'explicabilite pour B2B
 * - AC1: Gate outcomes, confidence, edge, data signals (FR35)
 * - AC2: Structured and machine-readable response
 * - AC3: TraceId included for audit linkage
 * 
 * TDD RED PHASE: These tests will fail until the feature is implemented.
 * Use test.skip() to document intentional failure.
 */

import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const B2B_API_PREFIX = '/api/v1/b2b';

/**
 * Helper to create a valid API key header
 */
const getB2BHeaders = (apiKey?: string) => ({
  'Content-Type': 'application/json',
  'X-API-Key': apiKey || 'test-api-key-for-atdd',
});

/**
 * Mock decision data structure for testing
 */
const createMockDecisionExplanation = (overrides: Partial<{
  id: string;
  traceId: string;
  matchId: string;
  gateOutcomes: Array<{ gateName: string; passed: boolean; reason?: string }>;
  confidence: number;
  edge: number;
  dataSignals: Record<string, unknown>;
  explanation: string;
  createdAt: string;
}> = {}) => ({
  id: faker.string.uuid(),
  traceId: faker.string.uuid(),
  matchId: `match-${faker.number.int({ min: 1000, max: 9999 })}`,
  gateOutcomes: [
    { gateName: 'odds_available', passed: true, reason: 'Odds within acceptable range' },
    { gateName: 'model_confidence', passed: true, reason: 'Confidence above threshold' },
    { gateName: 'no_injury_concerns', passed: false, reason: 'Key player injury detected' },
  ],
  confidence: faker.number.float({ min: 0.5, max: 1.0 }),
  edge: faker.number.float({ min: 0, max: 0.2 }),
  dataSignals: {
    homeTeamRecentForm: faker.number.float({ min: 0, max: 1 }),
    awayTeamRecentForm: faker.number.float({ min: 0, max: 1 }),
    homeAdvantage: faker.number.float({ min: 0, max: 0.1 }),
    restDaysDiff: faker.number.int({ min: 0, max: 7 }),
    modelVersion: 'v2.1.0',
    driftScore: faker.number.float({ min: 0, max: 0.3 }),
  },
  explanation: faker.lorem.paragraph(),
  createdAt: new Date().toISOString(),
  ...overrides,
});

// =============================================================================
// AUTHENTICATION TESTS (P0)
// =============================================================================

test.describe('B2B Explainability Endpoint - Authentication', () => {
  
  test('[P0] should allow access with valid API key', async ({ request }) => {
    // Test: Valid API key should allow access to explain endpoint
    // Expected: 200 OK (when implemented)
    // Actual: 404 Not Found (endpoint doesn't exist yet)
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders('valid-b2b-api-key') }
    );

    expect(response.status()).toBe(200);
  });

  test('[P0] should reject request with invalid API key', async ({ request }) => {
    // Test: Invalid API key should be rejected
    // Expected: 401 Unauthorized
    // Actual: 404 Not Found
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders('invalid-api-key') }
    );

    expect(response.status()).toBe(401);
    
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('[P0] should reject request without API key', async ({ request }) => {
    // Test: Missing API key should be rejected
    // Expected: 401 Unauthorized
    // Actual: 404 Not Found
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`
    );

    expect(response.status()).toBe(401);
  });
});

// =============================================================================
// AC1: GATE OUTCOMES, CONFIDENCE, EDGE, DATA SIGNALS (P0)
// =============================================================================

test.describe('AC1: Gate Outcomes, Confidence, Edge, Data Signals (FR35)', () => {
  
  test('[P0] should return gate outcomes in explanation response', async ({ request }) => {
    // Test: AC1 - Gate outcomes should be returned
    // Expected: Response includes array of gate outcomes with gateName, passed, reason
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.gateOutcomes).toBeDefined();
    expect(Array.isArray(body.data.gateOutcomes)).toBe(true);
    
    // Verify gate outcome structure
    const gateOutcome = body.data.gateOutcomes[0];
    expect(gateOutcome).toHaveProperty('gateName');
    expect(gateOutcome).toHaveProperty('passed');
    expect(gateOutcome).toHaveProperty('reason');
  });

  test('[P0] should return confidence score in explanation response', async ({ request }) => {
    // Test: AC1 - Confidence should be returned
    // Expected: Response includes confidence as a number between 0 and 1
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.confidence).toBeDefined();
    expect(typeof body.data.confidence).toBe('number');
    expect(body.data.confidence).toBeGreaterThanOrEqual(0);
    expect(body.data.confidence).toBeLessThanOrEqual(1);
  });

  test('[P0] should return edge value in explanation response', async ({ request }) => {
    // Test: AC1 - Edge should be returned
    // Expected: Response includes edge as a number
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.edge).toBeDefined();
    expect(typeof body.data.edge).toBe('number');
  });

  test('[P0] should return data signals in explanation response', async ({ request }) => {
    // Test: AC1 - Data signals should be returned
    // Expected: Response includes dataSignals object with ML features
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.data.dataSignals).toBeDefined();
    expect(typeof body.data.dataSignals).toBe('object');
    
    // Verify at least some data signals are present
    const dataSignals = body.data.dataSignals;
    expect(Object.keys(dataSignals).length).toBeGreaterThan(0);
  });
});

// =============================================================================
// AC2: STRUCTURED AND MACHINE-READABLE RESPONSE (P0)
// =============================================================================

test.describe('AC2: Structured and Machine-Readable Response', () => {
  
  test('[P0] should return response in correct format', async ({ request }) => {
    // Test: AC2 - Response should be structured with data and meta
    // Expected: { data: {...}, meta: { traceId, timestamp } }
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    // Success format: { data: ..., meta: { traceId, timestamp } }
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('meta');
    expect(body.meta).toHaveProperty('traceId');
    expect(body.meta).toHaveProperty('timestamp');
  });

  test('[P0] should use camelCase in JSON response', async ({ request }) => {
    // Test: AC2 - JSON should use camelCase (not snake_case)
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    // Verify camelCase (not snake_case)
    expect(body.data).toHaveProperty('gateOutcomes');  // camelCase
    expect(body.data).not.toHaveProperty('gate_outcomes');  // NOT snake_case
    expect(body.data).toHaveProperty('dataSignals');  // camelCase
    expect(body.data).not.toHaveProperty('data_signals');  // NOT snake_case
  });

  test('[P0] should use ISO 8601 UTC for dates', async ({ request }) => {
    // Test: AC2 - Dates should be ISO 8601 UTC format
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    // Verify ISO 8601 UTC format (ends with Z)
    if (body.data.createdAt) {
      expect(body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    }
    
    expect(body.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
  });

  test.skip('[P1] should include match information', async ({ request }) => {
    // Test: AC2 - Response should include match context
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    // Include match ID for context
    expect(body.data).toHaveProperty('matchId');
    expect(body.data).toHaveProperty('id');
  });
});

// =============================================================================
// AC3: TRACEID FOR AUDIT LINKAGE (P0)
// =============================================================================

test.describe('AC3: TraceId for Audit Linkage', () => {
  
  test('[P0] should include traceId in response meta', async ({ request }) => {
    // Test: AC3 - traceId should be included for audit linkage
    // Expected: Response meta includes traceId
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.meta).toBeDefined();
    expect(body.meta.traceId).toBeDefined();
    
    // traceId should be UUID format
    expect(body.meta.traceId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test('[P0] should include traceId in error responses', async ({ request }) => {
    // Test: AC3 - traceId should be included even in error responses
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/invalid-id/explain`,
      { headers: getB2BHeaders() }
    );

    // Even if 404, traceId should be present
    const body = await response.json();
    expect(body.meta).toBeDefined();
    expect(body.meta.traceId).toBeDefined();
  });

  test.skip('[P1] should allow lookup by traceId', async ({ request }) => {
    // Test: AC3 - Should be able to look up explanation by traceId
    
    const traceId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${traceId}/explain?lookup=traceId`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.data.traceId).toBe(traceId);
  });
});

// =============================================================================
// ERROR HANDLING TESTS (P1)
// =============================================================================

test.describe('Error Handling', () => {
  
  test('[P0] should return 404 for non-existent decision', async ({ request }) => {
    // Test: Should return 404 if decision ID doesn't exist
    
    const nonExistentId = 'non-existent-decision-id';
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${nonExistentId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(404);
    
    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  test.skip('[P1] should return 400 for invalid decision ID format', async ({ request }) => {
    // Test: Should return 400 if decision ID format is invalid
    
    const invalidId = '';
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${invalidId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(400);
  });

  test.skip('[P2] should return 500 for server errors', async ({ request }) => {
    // Test: Server errors should return proper format
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    // If server error occurs, should return proper format
    if (response.status() >= 500) {
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.meta.traceId).toBeDefined();
    }
  });
});

// =============================================================================
// RESPONSE COMPLETENESS TESTS (P1)
// =============================================================================

test.describe('Response Completeness', () => {
  
  test.skip('[P1] should include all required explanation fields', async ({ request }) => {
    // Test: Response should include all fields required by AC1, AC2, AC3
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    const data = body.data;
    
    // AC1 fields
    expect(data).toHaveProperty('gateOutcomes');
    expect(data).toHaveProperty('confidence');
    expect(data).toHaveProperty('edge');
    expect(data).toHaveProperty('dataSignals');
    
    // AC2 fields (structure)
    expect(body).toHaveProperty('meta');
    expect(body.meta).toHaveProperty('traceId');
    expect(body.meta).toHaveProperty('timestamp');
    
    // AC3 is covered by meta.traceId
  });

  test.skip('[P1] should include decision ID and match ID', async ({ request }) => {
    // Test: Response should identify the decision
    
    const decisionId = faker.string.uuid();
    
    const response = await request.get(
      `${API_BASE_URL}${B2B_API_PREFIX}/decisions/${decisionId}/explain`,
      { headers: getB2BHeaders() }
    );

    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.matchId).toBeDefined();
  });
});
