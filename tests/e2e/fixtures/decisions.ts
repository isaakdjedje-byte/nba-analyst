/**
 * E2E Test Fixtures - Decisions
 * Mock decision data for daily run pipeline E2E tests
 *
 * Story: 2.10 - Implementer les tests E2E du pipeline daily run
 */

import { faker } from '@faker-js/faker';
import { TEST_MATCHES } from './matches';
import { TEST_PREDICTIONS } from './predictions';

export interface TestDecision {
  id: string;
  matchId: string;
  status: 'Pick' | 'No-Bet' | 'Hard-Stop';
  recommendedPick?: string;
  confidence: number;
  rationale: string;
  modelOutputs: {
    winner: string;
    score: string;
    overUnder: string;
  };
  policyGates: {
    confidenceGate: 'passed' | 'failed';
    edgeGate: 'passed' | 'failed';
    driftGate: 'passed' | 'failed';
    hardStopGate: 'passed' | 'failed';
  };
  traceId: string;
  runId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpectedDecisionOutput {
  matchId: string;
  status: 'Pick' | 'No-Bet' | 'Hard-Stop';
  recommendedPick?: string;
  confidence: number;
  rationale: string;
}

/**
 * Factory: Create expected Pick decision
 */
export function createExpectedPickDecision(
  matchId: string,
  overrides: Partial<ExpectedDecisionOutput> = {}
): ExpectedDecisionOutput {
  return {
    matchId,
    status: 'Pick',
    recommendedPick: 'LAL',
    confidence: 0.72,
    rationale: 'Strong confidence signals across all models',
    ...overrides,
  };
}

/**
 * Factory: Create expected No-Bet decision
 */
export function createExpectedNoBetDecision(
  matchId: string,
  overrides: Partial<ExpectedDecisionOutput> = {}
): ExpectedDecisionOutput {
  return {
    matchId,
    status: 'No-Bet',
    confidence: 0.55,
    rationale: 'Edge too low for reliable pick',
    ...overrides,
  };
}

/**
 * Factory: Create expected Hard-Stop decision
 */
export function createExpectedHardStopDecision(
  matchId: string,
  overrides: Partial<ExpectedDecisionOutput> = {}
): ExpectedDecisionOutput {
  return {
    matchId,
    status: 'Hard-Stop',
    confidence: 0.88,
    rationale: 'Risk limits exceeded - model showing extreme confidence',
    ...overrides,
  };
}

/**
 * Predefined expected decisions matching TEST_MATCHES and TEST_PREDICTIONS
 */
export const EXPECTED_DECISIONS = {
  // Pick decision for Lakers vs Warriors
  lakersVsWarriors: {
    id: 'decision-test-001',
    matchId: TEST_MATCHES.lakersVsWarriors.id,
    status: 'Pick' as const,
    recommendedPick: 'LAL',
    confidence: TEST_PREDICTIONS.lakersVsWarriors.predictions.winner.confidence,
    rationale: 'Strong confidence signals across all models',
    modelOutputs: {
      winner: `${TEST_PREDICTIONS.lakersVsWarriors.predictions.winner.prediction} (72%)`,
      score: '112-108',
      overUnder: 'Over 220.5',
    },
    policyGates: {
      confidenceGate: 'passed' as const,
      edgeGate: 'passed' as const,
      driftGate: 'passed' as const,
      hardStopGate: 'passed' as const,
    },
    traceId: 'trace-test-001',
    runId: 'run-test-001',
    createdAt: '2026-02-15T18:30:00Z',
    updatedAt: '2026-02-15T18:30:00Z',
  },
  // No-Bet decision for Celtics vs Heat
  celticsVsHeat: {
    id: 'decision-test-002',
    matchId: TEST_MATCHES.celticsVsHeat.id,
    status: 'No-Bet' as const,
    recommendedPick: undefined,
    confidence: TEST_PREDICTIONS.celticsVsHeat.predictions.winner.confidence,
    rationale: 'Edge too low for reliable pick',
    modelOutputs: {
      winner: 'BOS (55%)',
      score: '110-108',
      overUnder: 'Over 215.5',
    },
    policyGates: {
      confidenceGate: 'passed' as const,
      edgeGate: 'failed' as const,
      driftGate: 'passed' as const,
      hardStopGate: 'passed' as const,
    },
    traceId: 'trace-test-002',
    runId: 'run-test-001',
    createdAt: '2026-02-15T18:30:00Z',
    updatedAt: '2026-02-15T18:30:00Z',
  },
  // Hard-Stop decision for Nuggets vs Suns
  nuggetsVsSuns: {
    id: 'decision-test-003',
    matchId: TEST_MATCHES.nuggetsVsSuns.id,
    status: 'Hard-Stop' as const,
    recommendedPick: undefined,
    confidence: TEST_PREDICTIONS.nuggetsVsSuns.predictions.winner.confidence,
    rationale: 'Risk limits exceeded - model showing extreme confidence',
    modelOutputs: {
      winner: 'DEN (88%)',
      score: '125-95',
      overUnder: 'Over 225.5',
    },
    policyGates: {
      confidenceGate: 'passed' as const,
      edgeGate: 'passed' as const,
      driftGate: 'passed' as const,
      hardStopGate: 'failed' as const,
    },
    traceId: 'trace-test-003',
    runId: 'run-test-001',
    createdAt: '2026-02-15T18:30:00Z',
    updatedAt: '2026-02-15T18:30:00Z',
  },
} as const;

/**
 * Standard expected decision outputs
 */
export const STANDARD_EXPECTED_DECISIONS: ExpectedDecisionOutput[] = [
  { ...EXPECTED_DECISIONS.lakersVsWarriors },
  { ...EXPECTED_DECISIONS.celticsVsHeat },
  { ...EXPECTED_DECISIONS.nuggetsVsSuns },
];

/**
 * Factory: Create complete decision object for storage validation
 */
export function createTestDecision(
  overrides: Partial<TestDecision> = {}
): TestDecision {
  const matchId = overrides.matchId || `match-${faker.string.alphanumeric(8)}`;
  const decisionId = overrides.id || `decision-${faker.string.alphanumeric(8)}`;
  const traceId = overrides.traceId || `trace-${faker.string.alphanumeric(12)}`;
  const now = new Date().toISOString();

  return {
    id: decisionId,
    matchId,
    status: 'Pick',
    recommendedPick: 'LAL',
    confidence: faker.number.float({ min: 0.65, max: 0.85 }),
    rationale: faker.lorem.sentence(),
    modelOutputs: {
      winner: 'LAL (72%)',
      score: '112-108',
      overUnder: 'Over 220.5',
    },
    policyGates: {
      confidenceGate: 'passed',
      edgeGate: 'passed',
      driftGate: 'passed',
      hardStopGate: 'passed',
    },
    traceId,
    runId: `run-${faker.string.alphanumeric(8)}`,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Decision schema for validation
 * FIXED: Aligned with actual History API response structure
 */
export const DECISION_SCHEMA = {
  required: ['id', 'matchId', 'status', 'confidence', 'rationale', 'gatesOutcome', 'traceId', 'createdAt'],
  status: ['PICK', 'NO_BET', 'HARD_STOP'],
  gatesOutcome: ['confidenceGate', 'edgeGate', 'driftGate', 'hardStopGate'],
} as const;
