/**
 * Fallback Chain Service Tests
 * 
 * Tests for the FallbackChain service that handles data source failure scenarios.
 * Story 2.7: Implement fallback strategy and degraded no-bet mode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from 'pino';
import {
  FallbackChain,
  FallbackChainConfig,
  FallbackLevel,
  DataQualityAssessment,
  ModelRegistry,
  DataQualityGates,
} from '../fallback-chain';

// Mock dependencies
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger),
} as unknown as Logger;

const mockMlRegistry = {
  getModel: vi.fn(),
  listModels: vi.fn(),
} as unknown as ModelRegistry & {
  getModel: ReturnType<typeof vi.fn>;
  listModels: ReturnType<typeof vi.fn>;
};

const mockDataQuality = {
  assess: vi.fn(),
} as unknown as DataQualityGates & {
  assess: ReturnType<typeof vi.fn>;
};

describe('FallbackChain', () => {
  let config: FallbackChainConfig;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    config = {
      primaryModelId: 'model-v2',
      secondaryModelId: 'model-v1',
      lastValidatedModelId: 'model-baseline',
      reliabilityThreshold: 0.5,
      fallbackLevels: ['primary', 'secondary', 'last_validated', 'force_no_bet'],
    };
  });

  describe('evaluate', () => {
    it('should return decision from primary model when quality passes', async () => {
      // Arrange
      const mockModel = { id: 'model-v2', name: 'Primary Model', version: '2.0' };
      const mockQuality: DataQualityAssessment = {
        overallScore: 0.75,
        sourceAvailability: 0.9,
        schemaValidity: 0.8,
        freshness: 0.7,
        completeness: 0.65,
        passed: true,
        failedChecks: [],
      };
      
      vi.mocked(mockMlRegistry.getModel).mockResolvedValue(mockModel);
      vi.mocked(mockDataQuality.assess).mockResolvedValue(mockQuality);
      
      const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);
      
      const input = {
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
      expect(result.finalLevel).toBe('primary');
      expect(result.wasForcedNoBet).toBe(false);
      expect(result.qualityScore).toBe(0.75);
      expect(result.fallbackAttempts).toHaveLength(1);
      expect(result.fallbackAttempts[0].level).toBe('primary');
      expect(result.fallbackAttempts[0].passed).toBe(true);
    });

    it('should fallback to secondary model when primary fails quality check', async () => {
      // Arrange
      const primaryModel = { id: 'model-v2', name: 'Primary Model', version: '2.0' };
      const secondaryModel = { id: 'model-v1', name: 'Secondary Model', version: '1.0' };
      
      const primaryQuality: DataQualityAssessment = {
        overallScore: 0.35,
        sourceAvailability: 0.5,
        schemaValidity: 0.3,
        freshness: 0.4,
        completeness: 0.2,
        passed: false,
        failedChecks: ['insufficient_source_coverage', 'schema_invalid'],
      };
      
      const secondaryQuality: DataQualityAssessment = {
        overallScore: 0.72,
        sourceAvailability: 0.85,
        schemaValidity: 0.75,
        freshness: 0.65,
        completeness: 0.7,
        passed: true,
        failedChecks: [],
      };
      
      vi.mocked(mockMlRegistry.getModel)
        .mockResolvedValueOnce(primaryModel)
        .mockResolvedValueOnce(secondaryModel);
      vi.mocked(mockDataQuality.assess)
        .mockResolvedValueOnce(primaryQuality)
        .mockResolvedValueOnce(secondaryQuality);
      
      const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);
      
      const input = {
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
      expect(result.finalLevel).toBe('secondary');
      expect(result.wasForcedNoBet).toBe(false);
      expect(result.qualityScore).toBe(0.72);
      expect(result.fallbackAttempts).toHaveLength(2);
      expect(result.fallbackAttempts[0].level).toBe('primary');
      expect(result.fallbackAttempts[0].passed).toBe(false);
      expect(result.fallbackAttempts[1].level).toBe('secondary');
      expect(result.fallbackAttempts[1].passed).toBe(true);
    });

    it('should fallback to last validated model when primary and secondary fail', async () => {
      // Arrange
      const primaryModel = { id: 'model-v2', name: 'Primary Model', version: '2.0' };
      const secondaryModel = { id: 'model-v1', name: 'Secondary Model', version: '1.0' };
      const lastValidatedModel = { id: 'model-baseline', name: 'Baseline Model', version: '1.0' };
      
      const primaryQuality: DataQualityAssessment = {
        overallScore: 0.28,
        sourceAvailability: 0.3,
        schemaValidity: 0.25,
        freshness: 0.3,
        completeness: 0.25,
        passed: false,
        failedChecks: ['insufficient_source_coverage'],
      };
      
      const secondaryQuality: DataQualityAssessment = {
        overallScore: 0.42,
        sourceAvailability: 0.5,
        schemaValidity: 0.4,
        freshness: 0.45,
        completeness: 0.35,
        passed: false,
        failedChecks: ['data_stale'],
      };
      
      const lastValidatedQuality: DataQualityAssessment = {
        overallScore: 0.68,
        sourceAvailability: 0.8,
        schemaValidity: 0.7,
        freshness: 0.65,
        completeness: 0.6,
        passed: true,
        failedChecks: [],
      };
      
      vi.mocked(mockMlRegistry.getModel)
        .mockResolvedValueOnce(primaryModel)
        .mockResolvedValueOnce(secondaryModel)
        .mockResolvedValueOnce(lastValidatedModel);
      vi.mocked(mockDataQuality.assess)
        .mockResolvedValueOnce(primaryQuality)
        .mockResolvedValueOnce(secondaryQuality)
        .mockResolvedValueOnce(lastValidatedQuality);
      
      const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);
      
      const input = {
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
      expect(result.finalLevel).toBe('last_validated');
      expect(result.wasForcedNoBet).toBe(false);
      expect(result.fallbackAttempts).toHaveLength(3);
    });

    it('should force NO_BET when all fallback levels exhausted', async () => {
      // Arrange
      const primaryModel = { id: 'model-v2', name: 'Primary Model', version: '2.0' };
      const secondaryModel = { id: 'model-v1', name: 'Secondary Model', version: '1.0' };
      const lastValidatedModel = { id: 'model-baseline', name: 'Baseline Model', version: '1.0' };
      
      const failedQuality: DataQualityAssessment = {
        overallScore: 0.35,
        sourceAvailability: 0.4,
        schemaValidity: 0.35,
        freshness: 0.3,
        completeness: 0.35,
        passed: false,
        failedChecks: ['quality_below_threshold'],
      };
      
      vi.mocked(mockMlRegistry.getModel)
        .mockResolvedValueOnce(primaryModel)
        .mockResolvedValueOnce(secondaryModel)
        .mockResolvedValueOnce(lastValidatedModel);
      vi.mocked(mockDataQuality.assess).mockResolvedValue(failedQuality);
      
      const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);
      
      const input = {
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
      expect(result.finalLevel).toBe('force_no_bet');
      expect(result.wasForcedNoBet).toBe(true);
      expect(result.qualityScore).toBe(0);
      expect(result.fallbackAttempts).toHaveLength(4);
      expect(result.fallbackAttempts[3].level).toBe('force_no_bet');
    });

    it('should log warnings when forced No-Bet occurs', async () => {
      // Arrange
      const failedQuality: DataQualityAssessment = {
        overallScore: 0.2,
        sourceAvailability: 0.3,
        schemaValidity: 0.2,
        freshness: 0.1,
        completeness: 0.2,
        passed: false,
        failedChecks: ['complete_source_failure'],
      };
      
      vi.mocked(mockMlRegistry.getModel).mockResolvedValue({ id: 'model-v2', name: 'Primary Model', version: '2.0' });
      vi.mocked(mockDataQuality.assess).mockResolvedValue(failedQuality);
      
      const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);
      
      const input = {
        id: 'pred-1',
        matchId: 'match-1',
        runId: 'run-1',
        userId: 'user-1',
        confidence: 0.7,
        modelVersion: 'v2',
      };

      // Act
      await fallbackChain.evaluate(input);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          attempts: expect.any(Array),
        }),
        expect.stringContaining('Forced No-Bet due to insufficient data quality')
      );
    });
  });

  describe('getModelForLevel', () => {
    it('should return correct model for each fallback level', async () => {
      // Arrange
      const primaryModel = { id: 'model-v2', name: 'Primary Model' };
      const secondaryModel = { id: 'model-v1', name: 'Secondary Model' };
      const lastValidatedModel = { id: 'model-baseline', name: 'Baseline Model' };
      
      vi.mocked(mockMlRegistry.getModel)
        .mockResolvedValueOnce(primaryModel)
        .mockResolvedValueOnce(secondaryModel)
        .mockResolvedValueOnce(lastValidatedModel);
      
      const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);

      // Act & Assert
      const model1 = await fallbackChain['getModelForLevel']('primary');
      expect(model1?.id).toBe('model-v2');

      const model2 = await fallbackChain['getModelForLevel']('secondary');
      expect(model2?.id).toBe('model-v1');

      const model3 = await fallbackChain['getModelForLevel']('last_validated');
      expect(model3?.id).toBe('model-baseline');
    });
  });

  describe('createForcedNoBet', () => {
    it('should create a forced No-Bet decision with correct reason', () => {
      // Arrange
      const fallbackChain = new FallbackChain(config, mockMlRegistry, mockDataQuality, mockLogger);
      
      const attempts = [
        { level: 'primary' as FallbackLevel, modelId: 'model-v2', qualityScore: 0.28, passed: false, reason: 'insufficient_source_coverage' },
        { level: 'secondary' as FallbackLevel, modelId: 'model-v1', qualityScore: 0.42, passed: false, reason: 'data_stale' },
        { level: 'last_validated' as FallbackLevel, modelId: 'model-baseline', qualityScore: 0.35, passed: false, reason: 'quality_below_threshold' },
      ];

      // Act
      const decision = fallbackChain['createForcedNoBet'](attempts);

      // Assert
      expect(decision.status).toBe('NO_BET');
      expect(decision.noBetReason).toBe('degraded_data_quality');
      expect(decision.rationale).toContain('No-Bet');
      expect(decision.fallbackContext).toBeDefined();
      expect(decision.fallbackContext?.wasForcedNoBet).toBe(true);
      expect(decision.fallbackContext?.finalLevel).toBe('force_no_bet');
      expect(decision.fallbackContext?.fallbackAttempts).toHaveLength(3);
    });
  });
});

describe('FallbackLevel type', () => {
  it('should accept valid fallback levels', () => {
    const levels: FallbackLevel[] = ['primary', 'secondary', 'last_validated', 'force_no_bet'];
    expect(levels).toHaveLength(4);
  });
});
