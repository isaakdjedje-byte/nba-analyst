/**
 * Confidence Gate
 * 
 * Evaluates if prediction confidence meets the minimum threshold.
 * Story 2.5: Single source of truth for Pick/No-Bet/Hard-Stop decisions.
 */

import { Gate, GateInput, GateResult } from './types';
import { ConfidenceConfig } from '../types';

export class ConfidenceGate implements Gate {
  name = 'confidence';
  
  constructor(private config: ConfidenceConfig) {}

  /**
   * Evaluate confidence threshold
   * 
   * Logic: prediction.confidence >= config.confidence.minThreshold
   * Severity: non-blocking (can result in No-Bet)
   */
  evaluate(input: GateInput): GateResult {
    const threshold = this.config.minThreshold;
    const confidence = input.confidence ?? 0;
    
    const passed = confidence >= threshold;
    
    return {
      passed,
      score: confidence,
      threshold,
      message: passed
        ? `Confidence ${(confidence * 100).toFixed(1)}% meets minimum threshold of ${(threshold * 100).toFixed(1)}%`
        : `Confidence ${(confidence * 100).toFixed(1)}% below minimum threshold of ${(threshold * 100).toFixed(1)}%`,
      severity: 'warning',
      gateName: this.name,
    };
  }
}

/**
 * Factory function to create ConfidenceGate
 */
export function createConfidenceGate(config: ConfidenceConfig): ConfidenceGate {
  return new ConfidenceGate(config);
}
