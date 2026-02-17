/**
 * Decision Factory
 * Factory functions for creating test decisions with faker
 */

import { faker } from '@faker-js/faker';

export type DecisionStatus = 'Pick' | 'No-Bet' | 'Hard-Stop';

export interface Decision {
  id: string;
  matchId: string;
  status: DecisionStatus;
  confidence: number;
  rationale?: string;
  published: boolean;
  createdAt: string;
}

export interface DecisionOverrides {
  id?: string;
  matchId?: string;
  status?: DecisionStatus;
  confidence?: number;
  rationale?: string;
  published?: boolean;
  createdAt?: string;
}

/**
 * Create a base decision with defaults
 */
export function createDecision(overrides: DecisionOverrides = {}): Decision {
  return {
    id: faker.string.uuid(),
    matchId: `match-${faker.string.alphanumeric(8)}`,
    status: 'Pick',
    confidence: faker.number.float({ min: 0.5, max: 0.95 }),
    rationale: faker.lorem.sentence(),
    published: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a Pick decision
 */
export function createPickDecision(overrides: DecisionOverrides = {}): Decision {
  return createDecision({
    status: 'Pick',
    confidence: faker.number.float({ min: 0.7, max: 0.95 }),
    rationale: 'Strong favorite with home court advantage',
    ...overrides,
  });
}

/**
 * Create a No-Bet decision
 */
export function createNoBetDecision(overrides: DecisionOverrides = {}): Decision {
  return createDecision({
    status: 'No-Bet',
    confidence: faker.number.float({ min: 0.3, max: 0.49 }),
    rationale: 'Confidence too low for reliable pick',
    ...overrides,
  });
}

/**
 * Create a Hard-Stop decision
 */
export function createHardStopDecision(overrides: DecisionOverrides = {}): Decision {
  return createDecision({
    status: 'Hard-Stop',
    confidence: faker.number.float({ min: 0.1, max: 0.3 }),
    rationale: 'Critical policy violation detected',
    ...overrides,
  });
}

/**
 * Create multiple decisions
 */
export function createDecisions(count: number, overrides: DecisionOverrides = {}): Decision[] {
  return Array.from({ length: count }, () => createDecision(overrides));
}

// Cache-related types and factories for cache integration testing

export interface CacheTestData {
  key: string;
  value: Record<string, unknown>;
  ttl: number;
  createdAt: string;
}

export interface CacheTestOverrides {
  key?: string;
  value?: Record<string, unknown>;
  ttl?: number;
  createdAt?: string;
}

/**
 * Create cache test data for integration testing
 * Used for validating cache service behavior
 */
export function createCacheTestData(overrides: CacheTestOverrides = {}): CacheTestData {
  return {
    key: `cache:test:${faker.string.alphanumeric(8)}`,
    value: {
      id: faker.string.uuid(),
      data: faker.lorem.words(5),
      timestamp: new Date().toISOString(),
    },
    ttl: faker.number.int({ min: 60, max: 3600 }),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create cache test data for decision caching
 */
export function createDecisionCacheData(overrides: CacheTestOverrides = {}): CacheTestData {
  const decision = createDecision();
  return createCacheTestData({
    key: `decisions:${decision.id}`,
    value: { ...decision } as Record<string, unknown>,
    ttl: 300, // 5 minutes for decisions
    ...overrides,
  });
}
