/**
 * B2B Policy Profile Validator
 * 
 * Governance validation for B2B policy profiles.
 * Enforces hard-stop boundaries and prevents bypass.
 * 
 * Story 6.3: Creer le systeme de profils policy configurables B2B
 */

import { DEFAULT_POLICY_CONFIG } from '@/server/policy/config';

/**
 * Hard-stop enforced boundaries (non-configurable by B2B clients)
 * These are the platform-level limits that cannot be bypassed.
 */
export const HARD_STOP_BOUNDARIES = {
  // Confidence: B2B clients can only configure within these bounds
  // Platform minimum is 0.65, clients can set higher but not lower
  confidence: {
    min: 0.65, // Platform minimum - cannot be bypassed
    max: 0.95, // Platform maximum
  },
  
  // Edge: B2B clients can only configure within these bounds
  // Platform minimum is 0.05, clients can set higher but not lower
  edge: {
    min: 0.05, // Platform minimum - cannot be bypassed
    max: 0.50, // Platform maximum
  },
  
  // Drift: B2B clients can only configure within these bounds
  drift: {
    min: 0.0,
    max: 0.30, // Platform maximum
  },
} as const;

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  code: 'BELOW_MINIMUM' | 'ABOVE_MAXIMUM' | 'INVALID_VALUE';
  message: string;
  platformMinimum?: number;
  platformMaximum?: number;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  field: string;
  code: 'HIGH_RISK' | 'DEVIATION_FROM_DEFAULT';
  message: string;
}

/**
 * Profile configuration input
 */
export interface ProfileConfigInput {
  confidenceMin?: number;
  edgeMin?: number;
  maxDriftScore?: number;
}

/**
 * Validate profile configuration against hard-stop boundaries
 * 
 * @param config - Profile configuration to validate
 * @returns Validation result with errors and warnings
 */
export function validateProfileConfig(config: ProfileConfigInput): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // Validate confidenceMin
  if (config.confidenceMin !== undefined) {
    const { min, max } = HARD_STOP_BOUNDARIES.confidence;
    
    if (config.confidenceMin < min) {
      errors.push({
        field: 'confidenceMin',
        code: 'BELOW_MINIMUM',
        message: `confidenceMin must be at least ${min} (platform hard-stop minimum)`,
        platformMinimum: min,
        platformMaximum: max,
      });
    } else if (config.confidenceMin > max) {
      errors.push({
        field: 'confidenceMin',
        code: 'ABOVE_MAXIMUM',
        message: `confidenceMin cannot exceed ${max}`,
        platformMinimum: min,
        platformMaximum: max,
      });
    } else if (config.confidenceMin > DEFAULT_POLICY_CONFIG.confidence.minThreshold) {
      warnings.push({
        field: 'confidenceMin',
        code: 'HIGH_RISK',
        message: `Setting confidenceMin above platform default (${DEFAULT_POLICY_CONFIG.confidence.minThreshold}) increases risk of No-Bet decisions`,
      });
    }
  }
  
  // Validate edgeMin
  if (config.edgeMin !== undefined) {
    const { min, max } = HARD_STOP_BOUNDARIES.edge;
    
    if (config.edgeMin < min) {
      errors.push({
        field: 'edgeMin',
        code: 'BELOW_MINIMUM',
        message: `edgeMin must be at least ${min} (platform hard-stop minimum)`,
        platformMinimum: min,
        platformMaximum: max,
      });
    } else if (config.edgeMin > max) {
      errors.push({
        field: 'edgeMin',
        code: 'ABOVE_MAXIMUM',
        message: `edgeMin cannot exceed ${max}`,
        platformMinimum: min,
        platformMaximum: max,
      });
    } else if (config.edgeMin > DEFAULT_POLICY_CONFIG.edge.minThreshold) {
      warnings.push({
        field: 'edgeMin',
        code: 'HIGH_RISK',
        message: `Setting edgeMin above platform default (${DEFAULT_POLICY_CONFIG.edge.minThreshold}) increases risk of No-Bet decisions`,
      });
    }
  }
  
  // Validate maxDriftScore
  if (config.maxDriftScore !== undefined) {
    const { min, max } = HARD_STOP_BOUNDARIES.drift;
    
    if (config.maxDriftScore < min) {
      errors.push({
        field: 'maxDriftScore',
        code: 'BELOW_MINIMUM',
        message: `maxDriftScore must be at least ${min}`,
        platformMinimum: min,
        platformMaximum: max,
      });
    } else if (config.maxDriftScore > max) {
      errors.push({
        field: 'maxDriftScore',
        code: 'ABOVE_MAXIMUM',
        message: `maxDriftScore cannot exceed ${max} (platform hard-stop maximum)`,
        platformMinimum: min,
        platformMaximum: max,
      });
    } else if (config.maxDriftScore > DEFAULT_POLICY_CONFIG.drift.maxDriftScore) {
      warnings.push({
        field: 'maxDriftScore',
        code: 'HIGH_RISK',
        message: `Setting maxDriftScore above platform default (${DEFAULT_POLICY_CONFIG.drift.maxDriftScore}) allows more model drift`,
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a configuration would bypass hard-stops
 * 
 * @param config - Profile configuration to check
 * @returns true if configuration is safe (within hard-stop boundaries)
 */
export function isConfigSafe(config: ProfileConfigInput): boolean {
  const result = validateProfileConfig(config);
  return result.valid;
}

/**
 * Get the safe bounds for profile configuration
 * Returns what B2B clients are allowed to configure
 */
export function getSafeBounds() {
  return {
    confidence: {
      min: HARD_STOP_BOUNDARIES.confidence.min,
      max: HARD_STOP_BOUNDARIES.confidence.max,
      platformDefault: DEFAULT_POLICY_CONFIG.confidence.minThreshold,
    },
    edge: {
      min: HARD_STOP_BOUNDARIES.edge.min,
      max: HARD_STOP_BOUNDARIES.edge.max,
      platformDefault: DEFAULT_POLICY_CONFIG.edge.minThreshold,
    },
    drift: {
      min: HARD_STOP_BOUNDARIES.drift.min,
      max: HARD_STOP_BOUNDARIES.drift.max,
      platformDefault: DEFAULT_POLICY_CONFIG.drift.maxDriftScore,
    },
  };
}

/**
 * Sanitize configuration by enforcing hard-stop boundaries
 * Use this when you want to force values to be within safe bounds
 * 
 * @param config - Profile configuration to sanitize
 * @returns Sanitized configuration with hard-stop boundaries applied
 */
export function sanitizeConfig(config: ProfileConfigInput): ProfileConfigInput {
  const sanitized: ProfileConfigInput = {};
  
  if (config.confidenceMin !== undefined) {
    sanitized.confidenceMin = Math.max(
      HARD_STOP_BOUNDARIES.confidence.min,
      Math.min(config.confidenceMin, HARD_STOP_BOUNDARIES.confidence.max)
    );
  }
  
  if (config.edgeMin !== undefined) {
    sanitized.edgeMin = Math.max(
      HARD_STOP_BOUNDARIES.edge.min,
      Math.min(config.edgeMin, HARD_STOP_BOUNDARIES.edge.max)
    );
  }
  
  if (config.maxDriftScore !== undefined) {
    sanitized.maxDriftScore = Math.max(
      HARD_STOP_BOUNDARIES.drift.min,
      Math.min(config.maxDriftScore, HARD_STOP_BOUNDARIES.drift.max)
    );
  }
  
  return sanitized;
}
