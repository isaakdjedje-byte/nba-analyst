/**
 * Policy Configuration
 * 
 * Default thresholds and parameters for the Policy Engine.
 * Story 2.5: Single source of truth for Pick/No-Bet/Hard-Stop decisions.
 */

import { PolicyConfig } from './types';

/**
 * Default policy configuration (MVP values)
 */
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  confidence: {
    minThreshold: 0.65,  // 65% minimum confidence
  },
  edge: {
    minThreshold: 0.05, // 5% minimum edge
  },
  drift: {
    maxDriftScore: 0.15, // 15% maximum drift
  },
  hardStops: {
    dailyLossLimit: 1000, // €1000 daily loss limit
    consecutiveLosses: 5, // Stop after 5 consecutive losses
    bankrollPercent: 0.10, // Max 10% bankroll at risk
  },
};

/**
 * Policy configuration loader
 * Can be extended to load from database or environment
 */
export class PolicyConfigLoader {
  private config: PolicyConfig;

  constructor(config?: Partial<PolicyConfig>) {
    this.config = this.mergeWithDefaults(config);
    this.validate();
  }

  /**
   * Merge provided config with defaults
   */
  private mergeWithDefaults(provided?: Partial<PolicyConfig>): PolicyConfig {
    return {
      confidence: {
        ...DEFAULT_POLICY_CONFIG.confidence,
        ...provided?.confidence,
      },
      edge: {
        ...DEFAULT_POLICY_CONFIG.edge,
        ...provided?.edge,
      },
      drift: {
        ...DEFAULT_POLICY_CONFIG.drift,
        ...provided?.drift,
      },
      hardStops: {
        ...DEFAULT_POLICY_CONFIG.hardStops,
        ...provided?.hardStops,
      },
    };
  }

  /**
   * Validate configuration values
   */
  private validate(): void {
    const { confidence, edge, drift, hardStops } = this.config;

    // Confidence threshold validation
    if (confidence.minThreshold < 0 || confidence.minThreshold > 1) {
      throw new Error(
        `Invalid confidence threshold: ${confidence.minThreshold}. Must be between 0 and 1.`
      );
    }

    // Edge threshold validation
    if (edge.minThreshold < 0 || edge.minThreshold > 1) {
      throw new Error(
        `Invalid edge threshold: ${edge.minThreshold}. Must be between 0 and 1.`
      );
    }

    // Drift score validation
    if (drift.maxDriftScore < 0 || drift.maxDriftScore > 1) {
      throw new Error(
        `Invalid drift score: ${drift.maxDriftScore}. Must be between 0 and 1.`
      );
    }

    // Hard stops validation
    if (hardStops.dailyLossLimit < 0) {
      throw new Error(
        `Invalid daily loss limit: ${hardStops.dailyLossLimit}. Must be non-negative.`
      );
    }

    if (hardStops.consecutiveLosses < 0) {
      throw new Error(
        `Invalid consecutive losses: ${hardStops.consecutiveLosses}. Must be non-negative.`
      );
    }

    if (hardStops.bankrollPercent < 0 || hardStops.bankrollPercent > 1) {
      throw new Error(
        `Invalid bankroll percent: ${hardStops.bankrollPercent}. Must be between 0 and 1.`
      );
    }
  }

  /**
   * Get the full configuration
   */
  getConfig(): PolicyConfig {
    return this.config;
  }

  /**
   * Get confidence configuration
   */
  getConfidenceConfig(): PolicyConfig['confidence'] {
    return this.config.confidence;
  }

  /**
   * Get edge configuration
   */
  getEdgeConfig(): PolicyConfig['edge'] {
    return this.config.edge;
  }

  /**
   * Get drift configuration
   */
  getDriftConfig(): PolicyConfig['drift'] {
    return this.config.drift;
  }

  /**
   * Get hard stops configuration
   */
  getHardStopsConfig(): PolicyConfig['hardStops'] {
    return this.config.hardStops;
  }

  /**
   * Update configuration with new values
   */
  updateConfig(newConfig: Partial<PolicyConfig>): void {
    this.config = this.mergeWithDefaults(newConfig);
    this.validate();
  }
}

/**
 * Get policy configuration (singleton instance)
 */
let configInstance: PolicyConfigLoader | null = null;

export function getPolicyConfig(config?: Partial<PolicyConfig>): PolicyConfigLoader {
  if (!configInstance) {
    configInstance = new PolicyConfigLoader(config);
  }
  return configInstance;
}

/**
 * Update policy configuration (persists in memory for runtime)
 */
export function updatePolicyConfig(newConfig: Partial<PolicyConfig>): PolicyConfig {
  if (!configInstance) {
    configInstance = new PolicyConfigLoader();
  }
  configInstance.updateConfig(newConfig);
  return configInstance.getConfig();
}

/**
 * Reset config instance (useful for testing)
 */
export function resetPolicyConfig(): void {
  configInstance = null;
}
