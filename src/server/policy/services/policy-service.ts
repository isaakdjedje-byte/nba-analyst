/**
 * Policy Service Layer
 * 
 * Service layer that integrates PolicyEngine with repositories.
 * Story 2.5: Single source of truth for Pick/No-Bet/Hard-Stop decisions.
 */

import {
  PolicyEngine,
} from '../engine';
import {
  PolicyConfig,
  PredictionInput,
  RunContext,
  PolicyEvaluationResult,
  PolicyEvaluationResponse,
  PolicyErrorResponse,
  PolicyError,
} from '../types';

export interface PolicyServiceConfig {
  policyEngine: PolicyEngine;
}

export class PolicyService {
  private engine: PolicyEngine;

  constructor(config?: PolicyServiceConfig) {
    this.engine = config?.policyEngine ?? PolicyEngine.createDefault();
  }

  /**
   * Evaluate a prediction directly (without database fetch)
   * 
   * @param prediction - Prediction input
   * @param context - Run context
   * @returns PolicyEvaluationResult
   */
  async evaluatePrediction(
    prediction: PredictionInput,
    context: RunContext
  ): Promise<PolicyEvaluationResult> {
    // Validate input
    if (!prediction.id) {
      throw new PolicyError('Prediction ID is required', 'INVALID_INPUT');
    }

    // Evaluate through policy engine
    const result = await this.engine.evaluate(prediction, context);
    
    return result;
  }

  /**
   * Get current policy configuration
   */
  getConfig(): PolicyConfig {
    return this.engine.getConfig();
  }

  /**
   * Format result for API response
   */
  formatApiResponse(result: PolicyEvaluationResult): PolicyEvaluationResponse {
    return {
      data: {
        decisionId: result.decisionId,
        status: result.status,
        rationale: result.rationale,
        gateOutcomes: result.gateOutcomes,
        recommendedAction: result.recommendedAction,
      },
      meta: {
        traceId: result.traceId,
        timestamp: result.executedAt.toISOString(),
      },
    };
  }

  /**
   * Format error for API response
   */
  formatErrorResponse(
    error: Error,
    traceId: string
  ): PolicyErrorResponse {
    const errorWithMeta = error as Error & { code?: string; details?: unknown };
    const code = errorWithMeta.code || 'POLICY_EVALUATION_ERROR';
    
    return {
      error: {
        code,
        message: error.message,
        details: (errorWithMeta.details as Record<string, unknown> | undefined),
      },
      meta: {
        traceId,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// Singleton instance
let policyServiceInstance: PolicyService | null = null;

export function getPolicyService(): PolicyService {
  if (!policyServiceInstance) {
    policyServiceInstance = new PolicyService();
  }
  return policyServiceInstance;
}

export function resetPolicyService(): void {
  policyServiceInstance = null;
}
