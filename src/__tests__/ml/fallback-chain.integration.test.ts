/**
 * Daily Run Fallback Integration Tests
 * 
 * Integration tests for fallback chain in daily run pipeline.
 * Story 2.7: Implement fallback strategy and degraded no-bet mode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from 'pino';
import {
  FallbackChain,
  FallbackChainConfig,
  DataQualityAssessment,
  PredictionInput,
  ModelInfo,
  ModelRegistry,
  DataQualityGates,
} from '@/server/ml/orchestration';

// Test utilities
const createMockModelRegistry = (models: Record<string, ModelInfo>) => ({
  getModel: vi.fn(async (modelId: string) => models[modelId] || null),
  listModels: vi.fn(async () => Object.values(models)),
}) as ModelRegistry;

const createMockDataQuality = (assessments: Map<string, DataQualityAssessment>) => ({
  assess: vi.fn(async (input: PredictionInput, model: ModelInfo) => {
    const key = `${input.id}-${model.id}`;
    return assessments.get(key) || {
      overallScore: 0,
      sourceAvailability: 0,
      schemaValidity: 0,
      freshness: 0,
      completeness: 0,
      passed: false,
      failedChecks: ['no_assessment_available'],
    };
  }),
}) as DataQualityGates;

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger),
} as unknown as Logger;

describe('Daily Run Fallback Integration', () => {
  let config: FallbackChainConfig;
  let assessments: Map<string, DataQualityAssessment>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    config = {
      primaryModelId: 'model-v2',
      secondaryModelId: 'model-v1',
      lastValidatedModelId: 'model-baseline',
      reliabilityThreshold: 0.5,
      fallbackLevels: ['primary', 'secondary', 'last_validated', 'force_no_bet'],
    };

    assessments = new Map();
  });

  describe('Scenario 1: Primary source fails → fallback to secondary model succeeds → PICK published', () => {
    it('should return PICK when secondary model passes quality check', async () => {
      // Arrange
      const models = {
        'model-v2': { id: 'model-v2', name: 'Primary Model', version: '2.0' },
        'model-v1': { id: 'model-v1', name: 'Secondary Model', version: '1.0' },
      };

      // Primary fails
      assessments.set('pred-1-model-v2', {
        overallScore: 0.35,
        sourceAvailability: 0.4,
        schemaValidity: 0.3,
        freshness: 0.35,
        completeness: 0.3,
        passed: false,
        failedChecks: ['insufficient_source_coverage', 'schema_invalid'],
      });

      // Secondary passes
      assessments.set('pred-1-model-v1', {
        overallScore: 0.72,
        sourceAvailability: 0.85,
        schemaValidity: 0.75,
        freshness: 0.65,
        completeness: 0.7,
        passed: true,
        failedChecks: [],
      });

      const mockMlRegistry = createMockModelRegistry(models);
      const mockDataQuality = createMockDataQuality(assessments);
      const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);

      const input: PredictionInput = {
        id: 'pred-1',
        matchId: 'match-1',
        runId: 'run-1',
        userId: 'user-1',
        confidence: 0.7,
        modelVersion: 'v2',
      };

      // Act
      const result = await fallbackChain.evaluate(input);

      // Assert
      expect(result.wasForcedNoBet).toBe(false);
      expect(result.decision.status).toBe('PICK');
      expect(result.finalLevel).toBe('secondary');
      expect(result.fallbackAttempts).toHaveLength(2);
      expect(result.fallbackAttempts[0].level).toBe('primary');
      expect(result.fallbackAttempts[0].passed).toBe(false);
      expect(result.fallbackAttempts[1].level).toBe('secondary');
      expect(result.fallbackAttempts[1].passed).toBe(true);
    });
  });

  describe('Scenario 2: Primary and secondary fail → fallback to last validated succeeds → PICK published', () => {
    it('should return PICK when last validated model passes quality check', async () => {
      // Arrange
      const models = {
        'model-v2': { id: 'model-v2', name: 'Primary Model', version: '2.0' },
        'model-v1': { id: 'model-v1', name: 'Secondary Model', version: '1.0' },
        'model-baseline': { id: 'model-baseline', name: 'Baseline Model', version: '1.0' },
      };

      // All higher priority models fail
      assessments.set('pred-2-model-v2', {
        overallScore: 0.28,
        sourceAvailability: 0.3,
        schemaValidity: 0.25,
        freshness: 0.3,
        completeness: 0.25,
        passed: false,
        failedChecks: ['insufficient_source_coverage'],
      });

      assessments.set('pred-2-model-v1', {
        overallScore: 0.42,
        sourceAvailability: 0.5,
        schemaValidity: 0.4,
        freshness: 0.45,
        completeness: 0.35,
        passed: false,
        failedChecks: ['data_stale'],
      });

      // Last validated passes
      assessments.set('pred-2-model-baseline', {
        overallScore: 0.68,
        sourceAvailability: 0.8,
        schemaValidity: 0.7,
        freshness: 0.65,
        completeness: 0.6,
        passed: true,
        failedChecks: [],
      });

      const mockMlRegistry = createMockModelRegistry(models);
      const mockDataQuality = createMockDataQuality(assessments);
      const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);

      const input: PredictionInput = {
        id: 'pred-2',
        matchId: 'match-2',
        runId: 'run-1',
        userId: 'user-1',
        confidence: 0.6,
        modelVersion: 'v2',
      };

      // Act
      const result = await fallbackChain.evaluate(input);

      // Assert
      expect(result.wasForcedNoBet).toBe(false);
      expect(result.decision.status).toBe('PICK');
      expect(result.finalLevel).toBe('last_validated');
      expect(result.fallbackAttempts).toHaveLength(3);
    });
  });

  describe('Scenario 3: All fallback levels fail → No-Bet forced → proper reason included', () => {
    it('should return forced NO_BET with degraded_data_quality reason when all levels fail', async () => {
      // Arrange
      const models = {
        'model-v2': { id: 'model-v2', name: 'Primary Model', version: '2.0' },
        'model-v1': { id: 'model-v1', name: 'Secondary Model', version: '1.0' },
        'model-baseline': { id: 'model-baseline', name: 'Baseline Model', version: '1.0' },
      };

      // All models fail quality check
      const failedQuality: DataQualityAssessment = {
        overallScore: 0.35,
        sourceAvailability: 0.4,
        schemaValidity: 0.35,
        freshness: 0.3,
        completeness: 0.35,
        passed: false,
        failedChecks: ['quality_below_threshold'],
      };

      assessments.set('pred-3-model-v2', failedQuality);
      assessments.set('pred-3-model-v1', failedQuality);
      assessments.set('pred-3-model-baseline', failedQuality);

      const mockMlRegistry = createMockModelRegistry(models);
      const mockDataQuality = createMockDataQuality(assessments);
      const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);

      const input: PredictionInput = {
        id: 'pred-3',
        matchId: 'match-3',
        runId: 'run-1',
        userId: 'user-1',
        confidence: 0.5,
        modelVersion: 'v2',
      };

      // Act
      const result = await fallbackChain.evaluate(input);

      // Assert
      expect(result.wasForcedNoBet).toBe(true);
      expect(result.decision.status).toBe('NO_BET');
      expect(result.decision.noBetReason).toBe('degraded_data_quality');
      expect(result.finalLevel).toBe('force_no_bet');
      
      // Verify fallback context is included
      expect(result.decision.fallbackContext).toBeDefined();
      expect(result.decision.fallbackContext?.wasForcedNoBet).toBe(true);
      expect(result.decision.fallbackContext?.finalLevel).toBe('force_no_bet');
      expect(result.decision.fallbackContext?.fallbackAttempts).toHaveLength(4);
      
      // Verify rationale is explicit
      expect(result.decision.rationale).toContain('No-Bet');
      expect(result.decision.rationale).toContain('threshold');
      expect(result.decision.recommendedAction).toBeDefined();
    });
  });

  describe('Scenario 4: Source recovers mid-run → quality check passes → normal operation resumes', () => {
    it('should detect source recovery and pass quality check', async () => {
      // Arrange - Initial failure
      const models = {
        'model-v2': { id: 'model-v2', name: 'Primary Model', version: '2.0' },
      };

      assessments.set('pred-4-initial-model-v2', {
        overallScore: 0.28,
        sourceAvailability: 0.3,
        schemaValidity: 0.25,
        freshness: 0.3,
        completeness: 0.25,
        passed: false,
        failedChecks: ['source_unavailable'],
      });

      // After recovery - quality passes
      assessments.set('pred-4-recovery-model-v2', {
        overallScore: 0.78,
        sourceAvailability: 0.95,
        schemaValidity: 0.85,
        freshness: 0.7,
        completeness: 0.75,
        passed: true,
        failedChecks: [],
      });

      const mockMlRegistry = createMockModelRegistry(models);
      const mockDataQuality = createMockDataQuality(assessments);
      
      // First run - should fail
      const fallbackChain1 = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);
      
      const inputFailed: PredictionInput = {
        id: 'pred-4-initial',
        matchId: 'match-4',
        runId: 'run-1',
        userId: 'user-1',
        confidence: 0.5,
        modelVersion: 'v2',
      };

      const result1 = await fallbackChain1.evaluate(inputFailed);
      expect(result1.wasForcedNoBet).toBe(true);

      // Second run after recovery - should pass
      const inputRecovery: PredictionInput = {
        id: 'pred-4-recovery',
        matchId: 'match-4',
        runId: 'run-2',
        userId: 'user-1',
        confidence: 0.7,
        modelVersion: 'v2',
      };

      const result2 = await fallbackChain1.evaluate(inputRecovery);
      
      // Assert - after "recovery", quality passes
      expect(result2.wasForcedNoBet).toBe(false);
      expect(result2.decision.status).toBe('PICK');
    });
  });

  describe('Scenario 5: No fragile signals published regardless of fallback outcome (NFR14)', () => {
    it('should never publish PICK when quality is below threshold', async () => {
      // Arrange
      const models = {
        'model-v2': { id: 'model-v2', name: 'Primary Model', version: '2.0' },
      };

      const veryLowQuality: DataQualityAssessment = {
        overallScore: 0.15,
        sourceAvailability: 0.2,
        schemaValidity: 0.1,
        freshness: 0.15,
        completeness: 0.15,
        passed: false,
        failedChecks: ['complete_source_failure', 'schema_invalid', 'data_stale'],
      };

      assessments.set('pred-5-model-v2', veryLowQuality);

      const mockMlRegistry = createMockModelRegistry(models);
      const mockDataQuality = createMockDataQuality(assessments);
      const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);

      const input: PredictionInput = {
        id: 'pred-5',
        matchId: 'match-5',
        runId: 'run-1',
        userId: 'user-1',
        confidence: 0.9, // High confidence but low data quality
        modelVersion: 'v2',
      };

      // Act
      const result = await fallbackChain.evaluate(input);

      // Assert - NFR14: No fragile signals published
      expect(result.decision.status).not.toBe('PICK');
      expect(result.wasForcedNoBet).toBe(true);
      expect(result.decision.noBetReason).toBe('degraded_data_quality');
      
      // Ensure no false sense of security - confidence should not be trusted when quality is low
      expect(result.qualityScore).toBe(0);
    });
  });
});

describe('Fallback Chain Statistics', () => {
  it('should track fallback statistics for daily run metadata', async () => {
    // This test verifies that fallback chain can be used to track statistics
    const config: FallbackChainConfig = {
      primaryModelId: 'model-v2',
      secondaryModelId: 'model-v1',
      lastValidatedModelId: 'model-baseline',
      reliabilityThreshold: 0.5,
      fallbackLevels: ['primary', 'secondary', 'last_validated', 'force_no_bet'],
    };

    const models = {
      'model-v2': { id: 'model-v2', name: 'Primary Model', version: '2.0' },
      'model-v1': { id: 'model-v1', name: 'Secondary Model', version: '1.0' },
      'model-baseline': { id: 'model-baseline', name: 'Baseline Model', version: '1.0' },
    };

    const assessments = new Map<string, DataQualityAssessment>();

    const mockMlRegistry = createMockModelRegistry(models);
    const mockDataQuality = createMockDataQuality(assessments);
    const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);

    // Simulate processing multiple predictions
    const predictions = [
      { id: 'pred-a', result: 'primary' },
      { id: 'pred-b', result: 'secondary' },
      { id: 'pred-c', result: 'last_validated' },
      { id: 'pred-d', result: 'force_no_bet' },
      { id: 'pred-e', result: 'force_no_bet' },
    ];

    let forcedNoBetCount = 0;
    const fallbackLevels: string[] = [];

    for (const pred of predictions) {
      assessments.set(`${pred.id}-model-v2`, {
        overallScore: pred.result === 'primary' ? 0.75 : 0.35,
        sourceAvailability: 0.9,
        schemaValidity: 0.8,
        freshness: 0.7,
        completeness: 0.65,
        passed: pred.result === 'primary',
        failedChecks: [],
      });

      if (pred.result !== 'primary') {
        assessments.set(`${pred.id}-model-v1`, {
          overallScore: pred.result === 'secondary' ? 0.72 : 0.42,
          sourceAvailability: 0.85,
          schemaValidity: 0.75,
          freshness: 0.65,
          completeness: 0.7,
          passed: pred.result === 'secondary',
          failedChecks: [],
        });
      }

      if (pred.result === 'last_validated' || pred.result === 'force_no_bet') {
        assessments.set(`${pred.id}-model-baseline`, {
          overallScore: pred.result === 'last_validated' ? 0.68 : 0.35,
          sourceAvailability: 0.8,
          schemaValidity: 0.7,
          freshness: 0.65,
          completeness: 0.6,
          passed: pred.result === 'last_validated',
          failedChecks: [],
        });
      }

      const input: PredictionInput = {
        id: pred.id,
        matchId: `match-${pred.id}`,
        runId: 'run-1',
        userId: 'user-1',
        confidence: 0.7,
        modelVersion: 'v2',
      };

      const result = await fallbackChain.evaluate(input);
      
      if (result.wasForcedNoBet) {
        forcedNoBetCount++;
      }
      fallbackLevels.push(result.finalLevel);
    }

    // Verify statistics can be calculated
    expect(forcedNoBetCount).toBe(2);
    expect(fallbackLevels.filter(l => l === 'force_no_bet').length).toBe(2);
    expect(fallbackLevels.filter(l => l === 'primary').length).toBe(1);
    expect(fallbackLevels.filter(l => l === 'secondary').length).toBe(1);
    expect(fallbackLevels.filter(l => l === 'last_validated').length).toBe(1);
  });
});
