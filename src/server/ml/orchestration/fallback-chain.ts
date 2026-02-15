/**
 * Fallback Chain Service
 * 
 * Handles data source failure scenarios with automatic fallback to backup models.
 * Story 2.7: Implement fallback strategy and degraded no-bet mode
 * 
 * NFR14: En cas d'echec source partiel, le systeme doit activer une strategie fallback
 * sans publier de signaux fragiles.
 */

import { Logger } from 'pino';

// ============================================
// Type Definitions
// ============================================

export type FallbackLevel = 'primary' | 'secondary' | 'last_validated' | 'force_no_bet';

export interface FallbackChainConfig {
  primaryModelId: string;
  secondaryModelId?: string;
  lastValidatedModelId: string;
  reliabilityThreshold: number;  // Minimum quality score (0-1)
  fallbackLevels: FallbackLevel[];
}

export interface FallbackAttempt {
  level: FallbackLevel;
  modelId: string;
  qualityScore: number;
  passed: boolean;
  reason?: string;
}

export interface FallbackChainResult {
  finalLevel: FallbackLevel;
  decision: FallbackDecision;
  qualityScore: number;
  fallbackAttempts: FallbackAttempt[];
  wasForcedNoBet: boolean;
}

export interface FallbackDecision {
  status: 'PICK' | 'NO_BET' | 'HARD_STOP';
  noBetReason?: string;
  rationale: string;
  recommendedAction?: string;
  fallbackContext?: {
    wasForcedNoBet: boolean;
    finalLevel: FallbackLevel;
    qualityScore: number;
    fallbackAttempts: FallbackAttempt[];
  };
}

export interface DataQualityAssessment {
  overallScore: number;           // 0-1
  sourceAvailability: number;     // 0-1 (percent sources available)
  schemaValidity: number;        // 0-1 (schema conformance)
  freshness: number;             // 0-1 (data age)
  completeness: number;           // 0-1 (missing fields)
  passed: boolean;
  failedChecks: string[];
}

export interface PredictionInput {
  id: string;
  matchId: string;
  runId: string;
  userId: string;
  confidence: number;
  edge?: number;
  driftScore?: number;
  winnerPrediction?: string | null;
  scorePrediction?: string | null;
  overUnderPrediction?: number | null;
  modelVersion: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  version: string;
}

// ============================================
// Interfaces for Dependencies
// ============================================

export interface ModelRegistry {
  getModel(modelId: string): Promise<ModelInfo | null>;
  listModels(): Promise<ModelInfo[]>;
}

export interface DataQualityGates {
  assess(input: PredictionInput, model: ModelInfo): Promise<DataQualityAssessment>;
}

// ============================================
// Fallback Chain Implementation
// ============================================

export class FallbackChain {
  private logger: Logger;
  private evaluationDepth: number = 0;
  private readonly MAX_EVALUATION_DEPTH = 3;
  private readonly MAX_ITERATIONS = 10;

  constructor(
    private config: FallbackChainConfig,
    private mlRegistry: ModelRegistry,
    private dataQuality: DataQualityGates,
    logger: Logger
  ) {
    this.logger = logger;
    
    // C9: Validate config to prevent infinite loops
    if (!config.fallbackLevels || config.fallbackLevels.length === 0) {
      throw new Error('FallbackChainConfig.fallbackLevels must contain at least one level');
    }
    
    if (config.fallbackLevels.length > this.MAX_ITERATIONS) {
      throw new Error(`FallbackChainConfig.fallbackLevels exceeds maximum of ${this.MAX_ITERATIONS}`);
    }
  }

  /**
   * Evaluate input through the fallback chain
   * Returns decision from first model that passes quality gates,
   * or forced No-Bet if all levels exhausted
   */
  async evaluate(input: PredictionInput): Promise<FallbackChainResult> {
    // C9: Prevent infinite recursion
    this.evaluationDepth++;
    if (this.evaluationDepth > this.MAX_EVALUATION_DEPTH) {
      this.evaluationDepth--;
      this.logger.error('FallbackChain evaluation depth exceeded maximum');
      return {
        finalLevel: 'force_no_bet',
        decision: this.createForcedNoBet([]),
        qualityScore: 0,
        fallbackAttempts: [],
        wasForcedNoBet: true,
      };
    }
    
    try {
      return await this.evaluateInternal(input);
    } finally {
      this.evaluationDepth--;
    }
  }
  
  /**
   * C9: Internal evaluation with infinite loop protection
   */
  private async evaluateInternal(input: PredictionInput): Promise<FallbackChainResult> {
    const attempts: FallbackAttempt[] = [];
    let iterationCount = 0;
    
    for (const level of this.config.fallbackLevels) {
      iterationCount++;
      
      // C9: Safety check against infinite loops
      if (iterationCount > this.MAX_ITERATIONS) {
        this.logger.error('FallbackChain iteration count exceeded maximum');
        return {
          finalLevel: 'force_no_bet',
          decision: this.createForcedNoBet(attempts),
          qualityScore: 0,
          fallbackAttempts: attempts,
          wasForcedNoBet: true,
        };
      }
      // Skip force_no_bet level as it's not a real model
      if (level === 'force_no_bet') {
        attempts.push({
          level,
          modelId: 'none',
          qualityScore: 0,
          passed: false,
          reason: 'All fallback levels exhausted',
        });
        continue;
      }

      const model = await this.getModelForLevel(level);
      
      if (!model) {
        this.logger.warn({ level }, 'Model not found for fallback level, skipping');
        attempts.push({
          level,
          modelId: 'not_found',
          qualityScore: 0,
          passed: false,
          reason: 'Model not found',
        });
        continue;
      }

      const quality = await this.dataQuality.assess(input, model);
      
      attempts.push({
        level,
        modelId: model.id,
        qualityScore: quality.overallScore,
        passed: quality.passed,
        reason: quality.failedChecks.join(', '),
      });

      if (quality.passed) {
        // Quality passed - create PICK decision
        const decision: FallbackDecision = {
          status: 'PICK',
          rationale: this.createRationale(level, model, quality),
          fallbackContext: {
            wasForcedNoBet: false,
            finalLevel: level,
            qualityScore: quality.overallScore,
            fallbackAttempts: attempts,
          },
        };

        return {
          finalLevel: level,
          decision,
          qualityScore: quality.overallScore,
          fallbackAttempts: attempts,
          wasForcedNoBet: false,
        };
      }

      this.logger.debug(
        { level, modelId: model.id, qualityScore: quality.overallScore },
        'Fallback level failed quality check'
      );
    }

    // All fallback levels exhausted - force No-Bet
    return {
      finalLevel: 'force_no_bet',
      decision: this.createForcedNoBet(attempts),
      qualityScore: 0,
      fallbackAttempts: attempts,
      wasForcedNoBet: true,
    };
  }

  /**
   * Get model for a specific fallback level
   */
  private async getModelForLevel(level: FallbackLevel): Promise<ModelInfo | null> {
    switch (level) {
      case 'primary':
        return this.mlRegistry.getModel(this.config.primaryModelId);
      case 'secondary':
        if (this.config.secondaryModelId) {
          return this.mlRegistry.getModel(this.config.secondaryModelId);
        }
        return null;
      case 'last_validated':
        return this.mlRegistry.getModel(this.config.lastValidatedModelId);
      default:
        return null;
    }
  }

  /**
   * Create rationale message for successful fallback
   */
  private createRationale(level: FallbackLevel, model: ModelInfo, quality: DataQualityAssessment): string {
    const levelNames: Record<FallbackLevel, string> = {
      primary: 'Primary model',
      secondary: 'Secondary model',
      last_validated: 'Last validated model',
      force_no_bet: 'Force No-Bet',
    };

    if (level === 'primary') {
      return `Pick: Primary model (${model.id}) used with quality score ${quality.overallScore.toFixed(2)}`;
    }

    return `Pick: ${levelNames[level]} used due to quality issues with higher priority sources (quality: ${quality.overallScore.toFixed(2)})`;
  }

  /**
   * Create forced No-Bet decision when all fallback levels exhausted
   */
  private createForcedNoBet(attempts: FallbackAttempt[]): FallbackDecision {
    const threshold = this.config.reliabilityThreshold;
    const bestScore = attempts
      .filter(a => a.level !== 'force_no_bet')
      .reduce((best, current) => 
        current.qualityScore > best.qualityScore ? current : best
      , { qualityScore: 0 } as FallbackAttempt);

    const rationale = `No-Bet: Insufficient data quality across all fallback levels (threshold: ${threshold}, best: ${bestScore.qualityScore.toFixed(2)})`;
    const recommendedAction = 'Wait for data source recovery or manually review when sources stabilize';

    // Log warning for forced No-Bet
    this.logger.warn(
      { 
        attempts: attempts.map(a => ({
          level: a.level,
          modelId: a.modelId,
          qualityScore: a.qualityScore,
          passed: a.passed,
        })),
      },
      'Forced No-Bet due to insufficient data quality'
    );

    return {
      status: 'NO_BET',
      noBetReason: 'degraded_data_quality',
      rationale,
      recommendedAction,
      fallbackContext: {
        wasForcedNoBet: true,
        finalLevel: 'force_no_bet',
        qualityScore: bestScore.qualityScore,
        fallbackAttempts: attempts,
      },
    };
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create FallbackChain with default configuration
 */
export function createFallbackChain(
  mlRegistry: ModelRegistry,
  dataQuality: DataQualityGates,
  logger: Logger
): FallbackChain {
  const config: FallbackChainConfig = {
    primaryModelId: process.env.PRIMARY_MODEL_ID || 'model-v2',
    secondaryModelId: process.env.SECONDARY_MODEL_ID || 'model-v1',
    lastValidatedModelId: process.env.LAST_VALIDATED_MODEL_ID || 'model-baseline',
    reliabilityThreshold: parseFloat(process.env.RELIABILITY_THRESHOLD || '0.5'),
    fallbackLevels: ['primary', 'secondary', 'last_validated', 'force_no_bet'],
  };

  return new FallbackChain(config, mlRegistry, dataQuality, logger);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if decision has fallback context
 */
export function hasFallbackContext(decision: FallbackDecision): boolean {
  return decision.fallbackContext !== undefined;
}

/**
 * Check if decision was forced No-Bet due to data quality
 */
export function isForcedNoBet(decision: FallbackDecision): boolean {
  return decision.status === 'NO_BET' && decision.noBetReason === 'degraded_data_quality';
}

/**
 * Get fallback level from decision
 */
export function getFallbackLevel(decision: FallbackDecision): FallbackLevel | null {
  return decision.fallbackContext?.finalLevel || null;
}
