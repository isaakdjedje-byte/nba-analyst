/**
 * Drift Gate
 * 
 * Evaluates if prediction drift score is within acceptable limits.
 * Story 2.5: Single source of truth for Pick/No-Bet/Hard-Stop decisions.
 */

import { Gate, GateInput, GateResult } from './types';
import { DriftConfig } from '../types';

export class DriftGate implements Gate {
  name = 'drift';
  
  constructor(private config: DriftConfig) {}

  /**
   * Evaluate drift score
   * 
   * Logic: driftScore <= config.drift.maxDriftScore
   * Note: Lower drift is better, so we check if drift is within max threshold
   * Severity: non-blocking (can result in No-Bet)
   */
  evaluate(input: GateInput): GateResult {
    const threshold = this.config.maxDriftScore;
    const driftScore = input.driftScore ?? 0;
    
    const passed = driftScore <= threshold;
    
    return {
      passed,
      score: driftScore,
      threshold,
      message: passed
        ? `Drift score ${(driftScore * 100).toFixed(1)}% within maximum threshold of ${(threshold * 100).toFixed(1)}%`
        : `Drift score ${(driftScore * 100).toFixed(1)}% exceeds maximum threshold of ${(threshold * 100).toFixed(1)}%`,
      severity: 'warning',
      gateName: this.name,
    };
  }
}

/**
 * Factory function to create DriftGate
 */
export function createDriftGate(config: DriftConfig): DriftGate {
  return new DriftGate(config);
}
