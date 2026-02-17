/**
 * Edge Gate
 * 
 * Evaluates if prediction edge meets the minimum threshold.
 * Story 2.5: Single source of truth for Pick/No-Bet/Hard-Stop decisions.
 */

import { Gate, GateInput, GateResult } from './types';
import { EdgeConfig } from '../types';

export class EdgeGate implements Gate {
  name = 'edge';
  
  constructor(private config: EdgeConfig) {}

  /**
   * Evaluate edge threshold
   * 
   * Logic: edge >= config.edge.minThreshold
   * Severity: non-blocking (can result in No-Bet)
   */
  evaluate(input: GateInput): GateResult {
    const threshold = this.config.minThreshold;
    const edge = input.edge ?? 0;
    
    const passed = edge >= threshold;
    
    return {
      passed,
      score: edge,
      threshold,
      message: passed
        ? `Edge ${(edge * 100).toFixed(1)}% meets minimum threshold of ${(threshold * 100).toFixed(1)}%`
        : `Edge ${(edge * 100).toFixed(1)}% below minimum threshold of ${(threshold * 100).toFixed(1)}%`,
      severity: 'warning',
      gateName: this.name,
    };
  }
}

/**
 * Factory function to create EdgeGate
 */
export function createEdgeGate(config: EdgeConfig): EdgeGate {
  return new EdgeGate(config);
}
