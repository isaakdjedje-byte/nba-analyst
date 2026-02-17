/**
 * Data Quality Gates Implementation
 * 
 * Provides data quality assessment for predictions in the fallback chain.
 * Story 2.7: Implement fallback strategy and degraded no-bet mode
 * 
 * NFR14: En cas d'echec source partiel, le systeme doit activer une strategie fallback
 * sans publier de signaux fragiles.
 */

import { Logger } from 'pino';

/**
 * Null logger for when no logger is provided
 */
const nullLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  trace: () => {},
  child: () => nullLogger,
  level: 'info',
  levels: [],
  silent: false,
} as unknown as Logger;
import { 
  DataQualityGates, 
  DataQualityAssessment, 
  PredictionInput, 
  ModelInfo 
} from './fallback-chain';

export interface DataQualityConfig {
  reliabilityThreshold: number;
  minSourceAvailability: number;
  minSchemaValidity: number;
  maxDataAgeMinutes: number;
  minCompleteness: number;
}

/**
 * Default quality thresholds
 */
export const DEFAULT_QUALITY_CONFIG: DataQualityConfig = {
  reliabilityThreshold: 0.5,
  minSourceAvailability: 0.7,
  minSchemaValidity: 0.7,
  maxDataAgeMinutes: 30,
  minCompleteness: 0.8,
};

/**
 * Data Quality Gates Implementation
 * 
 * Assesses data quality based on:
 * - Source availability (are required data sources available?)
 * - Schema validity (does data conform to expected schema?)
 * - Freshness (is data recent enough?)
 * - Completeness (are required fields present?)
 */
export class DataQualityGatesImpl implements DataQualityGates {
  private readonly logger: Logger;
  private readonly config: DataQualityConfig;

  constructor(
    config: Partial<DataQualityConfig> = {},
    logger: Logger = nullLogger
  ) {
    this.config = { ...DEFAULT_QUALITY_CONFIG, ...config };
    this.logger = logger.child({ component: 'DataQualityGates' });
  }

  /**
   * Assess data quality for a prediction input
   */
  async assess(input: PredictionInput, model: ModelInfo): Promise<DataQualityAssessment> {
    this.logger.debug({ inputId: input.id, modelId: model.id }, 'Assessing data quality');

    // Calculate individual scores
    const sourceAvailability = this.assessSourceAvailability(input);
    const schemaValidity = this.assessSchemaValidity(input);
    const freshness = this.assessFreshness(input);
    const completeness = this.assessCompleteness(input);

    // Calculate overall score (weighted average)
    const overallScore = 
      (sourceAvailability * 0.3) +
      (schemaValidity * 0.25) +
      (freshness * 0.2) +
      (completeness * 0.25);

    // Determine if quality passes threshold
    const failedChecks: string[] = [];
    
    if (sourceAvailability < this.config.minSourceAvailability) {
      failedChecks.push(`insufficient_source_coverage (${(sourceAvailability * 100).toFixed(0)}%)`);
    }
    if (schemaValidity < this.config.minSchemaValidity) {
      failedChecks.push(`schema_invalid (${(schemaValidity * 100).toFixed(0)}%)`);
    }
    if (freshness < 0.5) {
      failedChecks.push('data_stale');
    }
    if (completeness < this.config.minCompleteness) {
      failedChecks.push(`incomplete_data (${(completeness * 100).toFixed(0)}%)`);
    }
    if (overallScore < this.config.reliabilityThreshold) {
      failedChecks.push('quality_below_threshold');
    }

    const passed = failedChecks.length === 0 && overallScore >= this.config.reliabilityThreshold;

    if (!passed) {
      this.logger.warn(
        { inputId: input.id, modelId: model.id, overallScore, failedChecks },
        'Data quality check failed'
      );
    }

    return {
      overallScore,
      sourceAvailability,
      schemaValidity,
      freshness,
      completeness,
      passed,
      failedChecks,
    };
  }

  /**
   * Assess source availability
   * In production, this would check actual data source health
   */
  private assessSourceAvailability(input: PredictionInput): number {
    // Check if we have necessary data from prediction
    // In production, this would query actual data sources
    const hasWinnerPrediction = input.winnerPrediction !== null && input.winnerPrediction !== undefined;
    const hasConfidence = input.confidence !== undefined && input.confidence !== null;
    
    if (hasWinnerPrediction && hasConfidence) {
      return 0.9; // Good source coverage
    } else if (hasConfidence) {
      return 0.6; // Partial coverage
    }
    return 0.3; // Insufficient
  }

  /**
   * Assess schema validity
   * In production, this would validate against actual schema
   */
  private assessSchemaValidity(input: PredictionInput): number {
    // Check if prediction has all required fields with valid types
    const requiredFields = [
      input.id,
      input.matchId,
      input.runId,
      input.userId,
    ];

    const hasAllRequired = requiredFields.every(f => f !== undefined && f !== null);
    
    if (!hasAllRequired) {
      return 0.2;
    }

    // Check if predictions have valid confidence
    if (input.confidence !== undefined) {
      if (input.confidence < 0 || input.confidence > 1) {
        return 0.4; // Invalid confidence value
      }
    }

    return 0.85; // Schema is valid
  }

  /**
   * Assess data freshness
   * In production, this would check actual data timestamps
   */
  private assessFreshness(input: PredictionInput): number {
    // For now, assume data is fresh if it has a model version
    // In production, would check actual timestamps
    if (input.modelVersion) {
      return 0.9;
    }
    return 0.5;
  }

  /**
   * Assess data completeness
   */
  private assessCompleteness(input: PredictionInput): number {
    let presentFields = 0;
    const totalFields = 8;

    if (input.winnerPrediction !== undefined && input.winnerPrediction !== null) presentFields++;
    if (input.scorePrediction !== undefined && input.scorePrediction !== null) presentFields++;
    if (input.overUnderPrediction !== undefined && input.overUnderPrediction !== null) presentFields++;
    if (input.confidence !== undefined && input.confidence !== null) presentFields++;
    if (input.edge !== undefined && input.edge !== null) presentFields++;
    if (input.driftScore !== undefined && input.driftScore !== null) presentFields++;
    if (input.matchId) presentFields++;
    if (input.modelVersion) presentFields++;

    return presentFields / totalFields;
  }
}

/**
 * Factory function to create DataQualityGates
 */
export function createDataQualityGates(
  config?: Partial<DataQualityConfig>,
  logger?: Logger
): DataQualityGates {
  return new DataQualityGatesImpl(config, logger);
}

// Re-export DataQualityAssessment for convenience
export type { DataQualityAssessment } from './fallback-chain';

/**
 * Mock ModelRegistry for testing
 */
export class MockModelRegistry {
  private models: Map<string, ModelInfo> = new Map();

  constructor(models: Record<string, ModelInfo> = {}) {
    this.models = new Map(Object.entries(models));
  }

  async getModel(modelId: string): Promise<ModelInfo | null> {
    return this.models.get(modelId) || null;
  }

  async listModels(): Promise<ModelInfo[]> {
    return Array.from(this.models.values());
  }
}
