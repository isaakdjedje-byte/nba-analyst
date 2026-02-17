/**
 * E2E Test Fixtures - Predictions
 * Mock ML prediction data for daily run pipeline E2E tests
 *
 * Story: 2.10 - Implementer les tests E2E du pipeline daily run
 */

import { faker } from '@faker-js/faker';

export interface TestPrediction {
  matchId: string;
  winner: {
    prediction: string;
    confidence: number;
    homeWinProbability: number;
    awayWinProbability: number;
  };
  score: {
    prediction: {
      home: number;
      away: number;
    };
    confidence: number;
  };
  overUnder: {
    prediction: 'over' | 'under';
    confidence: number;
    line: number;
  };
  modelVersion: string;
  generatedAt: string;
}

export interface TestPredictionSet {
  matchId: string;
  predictions: TestPrediction;
  expectedDecision: 'Pick' | 'No-Bet' | 'Hard-Stop';
  rationale?: string;
}

/**
 * Factory: Create high-confidence prediction (should result in Pick)
 */
export function createHighConfidencePrediction(
  matchId: string,
  winner: string = 'LAL',
  overrides: Partial<TestPrediction> = {}
): TestPrediction {
  return {
    matchId,
    winner: {
      prediction: winner,
      confidence: faker.number.float({ min: 0.72, max: 0.85 }),
      homeWinProbability: winner === 'LAL' ? 0.72 : 0.28,
      awayWinProbability: winner === 'GSW' ? 0.72 : 0.28,
    },
    score: {
      prediction: {
        home: faker.number.int({ min: 110, max: 125 }),
        away: faker.number.int({ min: 105, max: 120 }),
      },
      confidence: faker.number.float({ min: 0.65, max: 0.75 }),
    },
    overUnder: {
      prediction: 'over',
      confidence: faker.number.float({ min: 0.68, max: 0.78 }),
      line: 220.5,
    },
    modelVersion: 'v2.1.0',
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Factory: Create low-confidence prediction (should result in No-Bet)
 */
export function createLowConfidencePrediction(
  matchId: string,
  overrides: Partial<TestPrediction> = {}
): TestPrediction {
  return {
    matchId,
    winner: {
      prediction: 'LAL',
      confidence: faker.number.float({ min: 0.52, max: 0.58 }), // Below 0.60 threshold
      homeWinProbability: 0.55,
      awayWinProbability: 0.45,
    },
    score: {
      prediction: {
        home: faker.number.int({ min: 108, max: 112 }),
        away: faker.number.int({ min: 106, max: 110 }),
      },
      confidence: faker.number.float({ min: 0.50, max: 0.58 }),
    },
    overUnder: {
      prediction: 'under',
      confidence: faker.number.float({ min: 0.55, max: 0.60 }),
      line: 220.5,
    },
    modelVersion: 'v2.1.0',
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Factory: Create prediction that triggers hard-stop
 */
export function createHardStopPrediction(
  matchId: string,
  overrides: Partial<TestPrediction> = {}
): TestPrediction {
  return {
    matchId,
    winner: {
      prediction: 'LAL',
      confidence: 0.95, // High confidence but problematic
      homeWinProbability: 0.95,
      awayWinProbability: 0.05,
    },
    score: {
      prediction: {
        home: 150,
        away: 80,
      },
      confidence: 0.90,
    },
    overUnder: {
      prediction: 'over',
      confidence: 0.92,
      line: 220.5,
    },
    modelVersion: 'v2.1.0',
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Predefined test predictions matching TEST_MATCHES
 */
export const TEST_PREDICTIONS = {
  // High confidence -> Pick
  lakersVsWarriors: {
    matchId: 'match-test-001',
    predictions: {
      matchId: 'match-test-001',
      winner: {
        prediction: 'LAL',
        confidence: 0.72,
        homeWinProbability: 0.72,
        awayWinProbability: 0.28,
      },
      score: {
        prediction: { home: 112, away: 108 },
        confidence: 0.65,
      },
      overUnder: {
        prediction: 'over',
        confidence: 0.68,
        line: 220.5,
      },
      modelVersion: 'v2.1.0',
      generatedAt: '2026-02-15T18:00:00Z',
    },
    expectedDecision: 'Pick' as const,
    rationale: 'Strong confidence signals across all models',
  },
  // Low confidence -> No-Bet
  celticsVsHeat: {
    matchId: 'match-test-002',
    predictions: {
      matchId: 'match-test-002',
      winner: {
        prediction: 'BOS',
        confidence: 0.55,
        homeWinProbability: 0.55,
        awayWinProbability: 0.45,
      },
      score: {
        prediction: { home: 110, away: 108 },
        confidence: 0.52,
      },
      overUnder: {
        prediction: 'over',
        confidence: 0.58,
        line: 215.5,
      },
      modelVersion: 'v2.1.0',
      generatedAt: '2026-02-15T18:00:00Z',
    },
    expectedDecision: 'No-Bet' as const,
    rationale: 'Edge too low for reliable pick',
  },
  // High edge but concerning pattern -> Hard-Stop
  nuggetsVsSuns: {
    matchId: 'match-test-003',
    predictions: {
      matchId: 'match-test-003',
      winner: {
        prediction: 'DEN',
        confidence: 0.88,
        homeWinProbability: 0.88,
        awayWinProbability: 0.12,
      },
      score: {
        prediction: { home: 125, away: 95 },
        confidence: 0.82,
      },
      overUnder: {
        prediction: 'over',
        confidence: 0.85,
        line: 225.5,
      },
      modelVersion: 'v2.1.0',
      generatedAt: '2026-02-15T18:00:00Z',
    },
    expectedDecision: 'Hard-Stop' as const,
    rationale: 'Risk limits exceeded - model showing extreme confidence',
  },
} as const;

/**
 * Standard test prediction set
 */
export const STANDARD_TEST_PREDICTIONS: TestPredictionSet[] = [
  TEST_PREDICTIONS.lakersVsWarriors,
  TEST_PREDICTIONS.celticsVsHeat,
  TEST_PREDICTIONS.nuggetsVsSuns,
];
