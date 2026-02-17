/**
 * Gate Interface Types
 * 
 * Common interface for all policy gates.
 * Story 2.5: Single source of truth for Pick/No-Bet/Hard-Stop decisions.
 */

/**
 * Gate severity levels
 */
export type GateSeverity = 'info' | 'warning' | 'blocking';

/**
 * Result of gate evaluation
 */
export interface GateResult {
  passed: boolean;
  score: number;
  threshold: number;
  message: string;
  severity: GateSeverity;
  gateName: string;
}

/**
 * Input for gate evaluation
 */
export interface GateInput {
  confidence?: number;
  edge?: number;
  driftScore?: number;
  dailyLoss?: number;
  consecutiveLosses?: number;
  bankrollPercent?: number;
}

/**
 * Base interface that all gates must implement
 */
export interface Gate {
  /**
   * Unique name of the gate
   */
  name: string;
  
  /**
   * Evaluate the gate with given input
   * @param input - The input data for evaluation
   * @returns GateResult with pass/fail status and details
   */
  evaluate(input: GateInput): GateResult;
}

/**
 * Configuration for individual gates
 */
export interface GateConfig {
  confidence?: {
    minThreshold: number;
  };
  edge?: {
    minThreshold: number;
  };
  drift?: {
    maxDriftScore: number;
  };
  hardStops?: {
    dailyLossLimit: number;
    consecutiveLosses: number;
    bankrollPercent: number;
  };
}

/**
 * Base interface that all gates must implement
 */
export interface Gate {
  /**
   * Unique name of the gate
   */
  name: string;
  
  /**
   * Evaluate the gate with given input
   * @param input - The input data for evaluation
   * @returns GateResult with pass/fail status and details
   */
  evaluate(input: GateInput): GateResult;
}

/**
 * Configuration for individual gates
 */
export interface GateConfig {
  confidence?: {
    minThreshold: number;
  };
  edge?: {
    minThreshold: number;
  };
  drift?: {
    maxDriftScore: number;
  };
  hardStops?: {
    dailyLossLimit: number;
    consecutiveLosses: number;
    bankrollPercent: number;
  };
}
