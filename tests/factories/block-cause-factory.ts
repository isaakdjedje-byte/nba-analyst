/**
 * BlockCause Factory
 * Factory functions for creating BlockCause test data
 * Story: 5.1 - Créer le panneau d'affichage des causes de blocage policy
 */

import { faker } from '@faker-js/faker';

export type BlockCauseCategory = 
  | 'bankroll_limit' 
  | 'data_quality' 
  | 'model_confidence' 
  | 'drift_detection' 
  | 'service_unavailable';

export interface BlockCause {
  ruleName: string;
  ruleDescription: string;
  triggeredAt: string;
  currentValue: number;
  threshold: number;
  recommendation: string;
  relatedPolicyId?: string;
  category: BlockCauseCategory;
  dataQualityMetrics?: Array<{
    metric: string;
    value: number;
    threshold: number;
  }>;
}

export interface BlockCauseOverrides {
  ruleName?: string;
  ruleDescription?: string;
  triggeredAt?: string;
  currentValue?: number;
  threshold?: number;
  recommendation?: string;
  relatedPolicyId?: string;
  category?: BlockCauseCategory;
  dataQualityMetrics?: Array<{
    metric: string;
    value: number;
    threshold: number;
  }>;
}

// Category-specific configurations
const categoryConfigs: Record<BlockCauseCategory, { 
  ruleName: string; 
  ruleDescription: string; 
  recommendation: string;
  currentValueRange: { min: number; max: number };
  thresholdRange: { min: number; max: number };
}> = {
  bankroll_limit: {
    ruleName: 'HARD_STOP_BANKROLL_LIMIT',
    ruleDescription: 'Bankroll limit exceeded for the current betting period',
    recommendation: 'Wait for next period reset or contact support to increase your limit',
    currentValueRange: { min: 1000, max: 5000 },
    thresholdRange: { min: 500, max: 2000 },
  },
  data_quality: {
    ruleName: 'HARD_STOP_DATA_QUALITY',
    ruleDescription: 'Data quality gate failed - insufficient source reliability or freshness',
    recommendation: 'Retry when data sources are more reliable or contact the data team',
    currentValueRange: { min: 0.5, max: 0.89 },
    thresholdRange: { min: 0.9, max: 0.95 },
  },
  model_confidence: {
    ruleName: 'HARD_STOP_MODEL_CONFIDENCE',
    ruleDescription: 'Model confidence below minimum threshold for reliable predictions',
    recommendation: 'Model retraining required before generating new predictions',
    currentValueRange: { min: 0.3, max: 0.74 },
    thresholdRange: { min: 0.75, max: 0.85 },
  },
  drift_detection: {
    ruleName: 'HARD_STOP_DRIFT_DETECTED',
    ruleDescription: 'Significant drift detected in model predictions vs actual outcomes',
    recommendation: 'Review model performance and consider retraining with recent data',
    currentValueRange: { min: 0.2, max: 0.5 },
    thresholdRange: { min: 0.1, max: 0.2 },
  },
  service_unavailable: {
    ruleName: 'HARD_STOP_SERVICE_UNAVAILABLE',
    ruleDescription: 'External service temporarily unavailable - prediction cannot be generated',
    recommendation: 'Retry prediction when service is restored',
    currentValueRange: { min: 0, max: 0 },
    thresholdRange: { min: 0, max: 0 },
  },
};

/**
 * Create a BlockCause with default values
 */
export function createBlockCause(overrides: BlockCauseOverrides = {}): BlockCause {
  const category = overrides.category || faker.helpers.arrayElement([
    'bankroll_limit', 
    'data_quality', 
    'model_confidence',
    'drift_detection',
    'service_unavailable'
  ] as BlockCauseCategory[]);
  
  const config = categoryConfigs[category];
  
  // Handle service_unavailable which doesn't have numeric values
  const useNumericValues = category !== 'service_unavailable';
  
  return {
    ruleName: config.ruleName,
    ruleDescription: config.ruleDescription,
    triggeredAt: faker.date.recent({ days: 7 }).toISOString(),
    currentValue: useNumericValues 
      ? faker.number.float({ 
          min: config.currentValueRange.min, 
          max: config.currentValueRange.max,
          fractionDigits: 2,
        })
      : 0,
    threshold: useNumericValues 
      ? faker.number.float({ 
          min: config.thresholdRange.min, 
          max: config.thresholdRange.max,
          fractionDigits: 2,
        })
      : 0,
    recommendation: config.recommendation,
    relatedPolicyId: `POLICY-${category.toUpperCase()}-${faker.string.alphanumeric(4).toUpperCase()}`,
    category,
    ...overrides,
  };
}

/**
 * Create a BlockCause for bankroll limit
 */
export function createBankrollBlockCause(overrides: BlockCauseOverrides = {}): BlockCause {
  return createBlockCause({
    category: 'bankroll_limit',
    ...overrides,
  });
}

/**
 * Create a BlockCause for data quality
 */
export function createDataQualityBlockCause(overrides: BlockCauseOverrides = {}): BlockCause {
  const metrics = overrides.dataQualityMetrics || [
    {
      metric: 'Data Freshness',
      value: faker.number.float({ min: 0.5, max: 0.89, fractionDigits: 2 }),
      threshold: faker.number.float({ min: 0.9, max: 0.95, fractionDigits: 2 }),
    },
    {
      metric: 'Source Reliability',
      value: faker.number.float({ min: 0.6, max: 0.84, fractionDigits: 2 }),
      threshold: faker.number.float({ min: 0.85, max: 0.95, fractionDigits: 2 }),
    },
  ];
  
  return createBlockCause({
    category: 'data_quality',
    dataQualityMetrics: metrics,
    ...overrides,
  });
}

/**
 * Create a BlockCause for model confidence
 */
export function createModelConfidenceBlockCause(overrides: BlockCauseOverrides = {}): BlockCause {
  return createBlockCause({
    category: 'model_confidence',
    currentValue: faker.number.float({ min: 0.3, max: 0.74, fractionDigits: 2 }),
    threshold: faker.number.float({ min: 0.75, max: 0.85, fractionDigits: 2 }),
    ...overrides,
  });
}

/**
 * Create a BlockCause for drift detection
 */
export function createDriftBlockCause(overrides: BlockCauseOverrides = {}): BlockCause {
  return createBlockCause({
    category: 'drift_detection',
    currentValue: faker.number.float({ min: 0.2, max: 0.5, fractionDigits: 2 }),
    threshold: faker.number.float({ min: 0.1, max: 0.2, fractionDigits: 2 }),
    ...overrides,
  });
}

/**
 * Create a BlockCause for service unavailable
 */
export function createServiceUnavailableBlockCause(overrides: BlockCauseOverrides = {}): BlockCause {
  return createBlockCause({
    category: 'service_unavailable',
    currentValue: 0,
    threshold: 0,
    ...overrides,
  });
}

/**
 * Create multiple BlockCauses
 */
export function createBlockCauses(count: number, overrides: BlockCauseOverrides = {}): BlockCause[] {
  return Array.from({ length: count }, () => createBlockCause(overrides));
}

/**
 * Create a BlockCause with a specific threshold exceedance
 * Useful for testing progress bar display
 */
export function createThresholdExceededBlockCause(
  exceedByPercent: number = 50,
  overrides: BlockCauseOverrides = {}
): BlockCause {
  const threshold = faker.number.int({ min: 100, max: 1000 });
  const currentValue = threshold * (1 + exceedByPercent / 100);
  
  return createBlockCause({
    currentValue,
    threshold,
    ...overrides,
  });
}

/**
 * Get category-specific styling info
 */
export function getCategoryStyling(category: BlockCauseCategory): {
  color: string;
  icon: string;
  bgColor: string;
} {
  const stylingMap: Record<BlockCauseCategory, { color: string; icon: string; bgColor: string }> = {
    bankroll_limit: {
      color: '#C2410C', // orange-700
      icon: 'bankroll',
      bgColor: '#FFEDD5', // orange-100
    },
    data_quality: {
      color: '#7C3AED', // violet-600
      icon: 'database',
      bgColor: '#EDE9FE', // violet-100
    },
    model_confidence: {
      color: '#2563EB', // blue-600
      icon: 'brain',
      bgColor: '#DBEAFE', // blue-100
    },
    drift_detection: {
      color: '#DC2626', // red-600
      icon: 'trending-up',
      bgColor: '#FEE2E2', // red-100
    },
    service_unavailable: {
      color: '#4B5563', // gray-600
      icon: 'server-off',
      bgColor: '#F3F4F6', // gray-100
    },
  };
  
  return stylingMap[category];
}
