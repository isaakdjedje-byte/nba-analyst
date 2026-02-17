/**
 * Hard Stop Gate
 * 
 * CRITICAL - Evaluates hard-stop conditions that block all betting activity.
 * This gate MUST be evaluated first and short-circuits all other gates if triggered.
 * Story 2.5: Single source of truth for Pick/No-Bet/Hard-Stop decisions.
 * 
 * NFR13: Hard-stop enforcement is 100% - zero exceptions allowed.
 */

import { Gate, GateInput, GateResult } from './types';
import { HardStopsConfig } from '../types';

export class HardStopGate implements Gate {
  name = 'hardStop';
  
  constructor(private config: HardStopsConfig) {}

  /**
   * Evaluate hard-stop conditions
   * 
   * CRITICAL: This gate MUST be evaluated FIRST in the policy engine
   * If hard-stop conditions are met, evaluation stops immediately
   * 
   * Logic (all must pass for no hard-stop):
   * - dailyLoss < config.hardStops.dailyLossLimit
   * - consecutiveLosses < config.hardStops.consecutiveLosses
   * - bankrollAtRisk < config.hardStops.bankrollPercent
   * 
   * Severity: BLOCKING → immediate Hard-Stop, no evaluation of other gates
   */
  evaluate(input: GateInput): GateResult {
    const { dailyLossLimit, consecutiveLosses: maxConsecutiveLosses, bankrollPercent: maxBankrollPercent } = this.config;
    
    const dailyLoss = input.dailyLoss ?? 0;
    const consecutiveLosses = input.consecutiveLosses ?? 0;
    const bankrollPercent = input.bankrollPercent ?? 0;
    
    // All conditions must be within limits (not triggered)
    const dailyLossOk = dailyLoss < dailyLossLimit;
    const consecutiveLossesOk = consecutiveLosses < maxConsecutiveLosses;
    const bankrollOk = bankrollPercent < maxBankrollPercent;
    
    const passed = dailyLossOk && consecutiveLossesOk && bankrollOk;
    
    // Build detailed failure reasons if any condition fails
    const failures: string[] = [];
    if (!dailyLossOk) {
      failures.push(`Daily loss €${dailyLoss} exceeds limit of €${dailyLossLimit}`);
    }
    if (!consecutiveLossesOk) {
      failures.push(`Consecutive losses (${consecutiveLosses}) exceeds limit (${maxConsecutiveLosses})`);
    }
    if (!bankrollOk) {
      failures.push(`Bankroll at risk (${(bankrollPercent * 100).toFixed(1)}%) exceeds limit (${(maxBankrollPercent * 100).toFixed(1)}%)`);
    }
    
    return {
      passed,
      score: passed ? 0 : 1, // 0 = safe, 1 = hard-stop triggered
      threshold: 0,
      message: passed
        ? 'All hard-stop conditions OK'
        : `HARD-STOP TRIGGERED: ${failures.join('; ')}`,
      severity: 'blocking',
      gateName: this.name,
    };
  }
  
  /**
   * Get the reason for hard-stop (for logging/audit)
   */
  getHardStopReason(input: GateInput): string {
    const { dailyLossLimit, consecutiveLosses: maxConsecutiveLosses, bankrollPercent: maxBankrollPercent } = this.config;
    
    const dailyLoss = input.dailyLoss ?? 0;
    const consecutiveLosses = input.consecutiveLosses ?? 0;
    const bankrollPercent = input.bankrollPercent ?? 0;
    
    const reasons: string[] = [];
    
    if (dailyLoss >= dailyLossLimit) {
      reasons.push(`Daily loss limit exceeded (€${dailyLoss} >= €${dailyLossLimit})`);
    }
    if (consecutiveLosses >= maxConsecutiveLosses) {
      reasons.push(`Consecutive losses limit exceeded (${consecutiveLosses} >= ${maxConsecutiveLosses})`);
    }
    if (bankrollPercent >= maxBankrollPercent) {
      reasons.push(`Bankroll limit exceeded (${(bankrollPercent * 100).toFixed(1)}% >= ${(maxBankrollPercent * 100).toFixed(1)}%)`);
    }
    
    return reasons.join('; ');
  }
  
  /**
   * Get recommended action when hard-stop triggers
   */
  getRecommendedAction(input: GateInput): string {
    const { dailyLossLimit, consecutiveLosses: maxConsecutiveLosses, bankrollPercent: maxBankrollPercent } = this.config;
    
    const dailyLoss = input.dailyLoss ?? 0;
    const consecutiveLosses = input.consecutiveLosses ?? 0;
    const bankrollPercent = input.bankrollPercent ?? 0;
    
    const actions: string[] = [];
    
    if (dailyLoss >= dailyLossLimit) {
      actions.push('Stop betting for today. Review daily loss limit.');
    }
    if (consecutiveLosses >= maxConsecutiveLosses) {
      actions.push('Take a break after consecutive losses. Do not chase losses.');
    }
    if (bankrollPercent >= maxBankrollPercent) {
      actions.push('Reduce stake size. Bankroll risk is too high.');
    }
    
    return actions.join(' ') || 'No action required.';
  }
}

/**
 * Factory function to create HardStopGate
 */
export function createHardStopGate(config: HardStopsConfig): HardStopGate {
  return new HardStopGate(config);
}
