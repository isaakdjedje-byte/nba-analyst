/**
 * Policy Engine - Main Orchestration
 * 
 * Centralized policy engine that evaluates predictions against policy gates
 * and produces consistent decisions (Pick/No-Bet/Hard-Stop).
 * Story 2.5: Single source of truth for Pick/No-Bet/Hard-Stop decisions.
 * 
 * CRITICAL: This is the ONLY component that can produce DecisionStatus.
 * All decision creation MUST go through PolicyEngine.evaluate()
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PolicyConfig,
  PolicyEvaluationResult,
  PredictionInput,
  RunContext,
  GateResults,
  DecisionOutcome,
  PolicyError,
} from './types';
import { DEFAULT_POLICY_CONFIG } from './config';
import {
  ConfidenceGate,
  EdgeGate,
  DriftGate,
  HardStopGate,
  GateInput,
} from './gates';

export interface PolicyEngineDeps {
  // Dependencies will be injected here for future use
  // Currently using singleton repositories directly
  _placeholder?: never;
}

/**
 * Circuit Breaker State
 * C7: Circuit breaker for cascade failure prevention
 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export class PolicyEngine {
  private confidenceGate: ConfidenceGate;
  private edgeGate: EdgeGate;
  private driftGate: DriftGate;
  private hardStopGate: HardStopGate;
  
  // C7: Circuit breaker state
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
  };
  
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly EVALUATION_TIMEOUT = 5000; // 5 seconds
  
  constructor(
    private config: PolicyConfig,
    private deps: PolicyEngineDeps = {}
  ) {
    // Initialize all gates with configuration
    this.confidenceGate = new ConfidenceGate(config.confidence);
    this.edgeGate = new EdgeGate(config.edge);
    this.driftGate = new DriftGate(config.drift);
    this.hardStopGate = new HardStopGate(config.hardStops);
  }
  
  /**
   * C7: Check circuit breaker state
   */
  private checkCircuitBreaker(): boolean {
    if (this.circuitBreaker.state === 'OPEN') {
      const now = Date.now();
      if (now - this.circuitBreaker.lastFailureTime > this.CIRCUIT_BREAKER_TIMEOUT) {
        // Try half-open
        this.circuitBreaker.state = 'HALF_OPEN';
        console.log('[PolicyEngine] Circuit breaker entering HALF_OPEN state');
        return true;
      }
      return false;
    }
    return true;
  }
  
  /**
   * C7: Record success and reset circuit breaker
   */
  private recordSuccess(): void {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
      console.log('[PolicyEngine] Circuit breaker CLOSED');
    }
  }
  
  /**
   * C7: Record failure and potentially open circuit
   */
  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.state = 'OPEN';
      console.error(`[PolicyEngine] Circuit breaker OPENED after ${this.circuitBreaker.failures} failures`);
    }
  }

  /**
   * Create a PolicyEngine with default configuration
   */
  static createDefault(deps?: PolicyEngineDeps): PolicyEngine {
    return new PolicyEngine(DEFAULT_POLICY_CONFIG, deps);
  }

  /**
   * Create a PolicyEngine with custom configuration
   */
  static create(config?: Partial<PolicyConfig>, deps?: PolicyEngineDeps): PolicyEngine {
    const fullConfig = {
      confidence: { ...DEFAULT_POLICY_CONFIG.confidence, ...config?.confidence },
      edge: { ...DEFAULT_POLICY_CONFIG.edge, ...config?.edge },
      drift: { ...DEFAULT_POLICY_CONFIG.drift, ...config?.drift },
      hardStops: { ...DEFAULT_POLICY_CONFIG.hardStops, ...config?.hardStops },
    };
    return new PolicyEngine(fullConfig, deps);
  }

  /**
   * Main evaluation method
   * 
   * CRITICAL: This is the single entry point for all policy evaluations.
   * 
   * @param prediction - The prediction to evaluate
   * @param context - Run context with traceId and risk metrics
   * @returns PolicyEvaluationResult with decision and gate outcomes
   */
  async evaluate(
    prediction: PredictionInput,
    context: RunContext
  ): Promise<PolicyEvaluationResult> {
    // C7: Check circuit breaker
    if (!this.checkCircuitBreaker()) {
      throw new PolicyError(
        'CIRCUIT_OPEN:Service temporarily unavailable due to repeated failures',
        'CIRCUIT_BREAKER_OPEN',
        { traceId: context.traceId }
      );
    }
    
    // C7: Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new PolicyError(
          'TIMEOUT:Policy evaluation exceeded 5 seconds',
          'EVALUATION_TIMEOUT',
          { traceId: context.traceId }
        ));
      }, this.EVALUATION_TIMEOUT);
    });
    
    try {
      const result = await Promise.race([
        this.evaluateInternal(prediction, context),
        timeoutPromise
      ]);
      
      // C7: Record success on circuit breaker
      this.recordSuccess();
      return result;
    } catch (error) {
      // C7: Record failure on circuit breaker
      this.recordFailure();
      throw error;
    }
  }
  
  /**
   * Internal evaluation with timeout protection
   */
  private async evaluateInternal(
    prediction: PredictionInput,
    context: RunContext
  ): Promise<PolicyEvaluationResult> {
    // Validate prediction input
    this.validatePrediction(prediction);

    // Create gate input from prediction and context
    const gateInput: GateInput = this.createGateInput(prediction, context);

    // CRITICAL: Evaluate HARD-STOP gate FIRST (NFR13: 100% enforcement)
    const hardStopResult = this.hardStopGate.evaluate(gateInput);
    
    // If hard-stop triggers, short-circuit immediately
    if (!hardStopResult.passed) {
      return this.createHardStopResult(prediction, context);
    }

    // Evaluate remaining gates in parallel
    const [confidenceResult, edgeResult, driftResult] = await Promise.all([
      Promise.resolve(this.confidenceGate.evaluate(gateInput)),
      Promise.resolve(this.edgeGate.evaluate(gateInput)),
      Promise.resolve(this.driftGate.evaluate(gateInput)),
    ]);

    // Aggregate gate results
    const gateResults: GateResults = {
      confidence: confidenceResult,
      edge: edgeResult,
      drift: driftResult,
      hardStop: hardStopResult,
    };

    // Determine final decision
    const decision = this.determineDecision(gateResults);

    // Generate decision rationale
    const rationale = this.generateRationale(decision, gateResults);

    // Build result
    return {
      decisionId: uuidv4(),
      predictionId: prediction.id,
      status: decision.status,
      rationale,
      confidenceGate: confidenceResult.passed,
      edgeGate: edgeResult.passed,
      driftGate: driftResult.passed,
      hardStopGate: hardStopResult.passed,
      hardStopReason: decision.hardStopReason,
      recommendedAction: decision.recommendedAction,
      traceId: context.traceId,
      executedAt: context.executedAt,
      gateOutcomes: {
        confidence: {
          passed: confidenceResult.passed,
          score: confidenceResult.score,
          threshold: confidenceResult.threshold,
        },
        edge: {
          passed: edgeResult.passed,
          score: edgeResult.score,
          threshold: edgeResult.threshold,
        },
        drift: {
          passed: driftResult.passed,
          score: driftResult.score,
          threshold: driftResult.threshold,
        },
        hardStop: {
          passed: hardStopResult.passed,
        },
      },
    };
  }

  /**
   * Validate prediction input
   */
  private validatePrediction(prediction: PredictionInput): void {
    if (!prediction.id) {
      throw new PolicyError('Prediction ID is required', 'INVALID_INPUT');
    }
    if (prediction.confidence === undefined || prediction.confidence === null) {
      throw new PolicyError('Prediction confidence is required', 'INVALID_INPUT');
    }
    if (prediction.confidence < 0 || prediction.confidence > 1) {
      throw new PolicyError(
        `Invalid confidence value: ${prediction.confidence}. Must be between 0 and 1.`,
        'INVALID_INPUT'
      );
    }
  }

  /**
   * Create gate input from prediction and context
   */
  private createGateInput(prediction: PredictionInput, context: RunContext): GateInput {
    return {
      confidence: prediction.confidence,
      edge: prediction.edge,
      driftScore: prediction.driftScore,
      dailyLoss: context.dailyLoss,
      consecutiveLosses: context.consecutiveLosses,
      bankrollPercent: context.currentBankroll > 0 
        ? context.dailyLoss / context.currentBankroll 
        : 0,
    };
  }

  /**
   * Create hard-stop result (short-circuited)
   */
  private createHardStopResult(
    prediction: PredictionInput,
    context: RunContext
  ): PolicyEvaluationResult {
    const hardStopReason = this.hardStopGate.getHardStopReason({
      dailyLoss: context.dailyLoss,
      consecutiveLosses: context.consecutiveLosses,
      bankrollPercent: context.currentBankroll > 0 
        ? context.dailyLoss / context.currentBankroll 
        : 0,
    });

    const recommendedAction = this.hardStopGate.getRecommendedAction({
      dailyLoss: context.dailyLoss,
      consecutiveLosses: context.consecutiveLosses,
      bankrollPercent: context.currentBankroll > 0 
        ? context.dailyLoss / context.currentBankroll 
        : 0,
    });

    return {
      decisionId: uuidv4(),
      predictionId: prediction.id,
      status: 'HARD_STOP',
      rationale: `HARD-STOP: ${hardStopReason}`,
      confidenceGate: true, // Not evaluated - set to true for completeness
      edgeGate: true,       // Not evaluated - set to true for completeness
      driftGate: true,      // Not evaluated - set to true for completeness
      hardStopGate: false,
      hardStopReason,
      recommendedAction,
      traceId: context.traceId,
      executedAt: context.executedAt,
      gateOutcomes: {
        confidence: { passed: true, score: 0, threshold: 0 }, // Not evaluated
        edge: { passed: true, score: 0, threshold: 0 },      // Not evaluated
        drift: { passed: true, score: 0, threshold: 0 },     // Not evaluated
        hardStop: { passed: false },
      },
    };
  }

  /**
   * Determine final decision based on gate results
   * 
   * Priority:
   * 1. HARD_STOP: If hardStopGate fails → immediate Hard-Stop
   * 2. NO_BET: If any non-critical gate fails → No-Bet
   * 3. PICK: If all gates pass → Pick
   */
  private determineDecision(gateResults: GateResults): DecisionOutcome {
    // Hard-stop already handled before this method
    // Check non-critical gates
    const nonCriticalGatesFailed = 
      !gateResults.confidence.passed ||
      !gateResults.edge.passed ||
      !gateResults.drift.passed;

    if (nonCriticalGatesFailed) {
      // Determine which gates failed
      const failedGates: string[] = [];
      if (!gateResults.confidence.passed) failedGates.push('confidence');
      if (!gateResults.edge.passed) failedGates.push('edge');
      if (!gateResults.drift.passed) failedGates.push('drift');

      return {
        status: 'NO_BET',
        rationale: '',
        recommendedAction: 'Review prediction metrics. Consider waiting for better opportunities.',
        hardStopReason: null,
      };
    }

    // All gates passed
    return {
      status: 'PICK',
      rationale: '',
      recommendedAction: 'Proceed with bet according to stake management rules.',
      hardStopReason: null,
    };
  }

  /**
   * Generate human-readable rationale for the decision
   */
  private generateRationale(decision: DecisionOutcome, gateResults: GateResults): string {
    if (decision.status === 'HARD_STOP') {
      return `Decision: ${decision.status}. Reason: ${gateResults.hardStop.message}`;
    }

    if (decision.status === 'NO_BET') {
      const failedGates: string[] = [];
      if (!gateResults.confidence.passed) {
        failedGates.push(`confidence (${(gateResults.confidence.score * 100).toFixed(1)}% < ${(gateResults.confidence.threshold * 100).toFixed(1)}%)`);
      }
      if (!gateResults.edge.passed) {
        failedGates.push(`edge (${(gateResults.edge.score * 100).toFixed(1)}% < ${(gateResults.edge.threshold * 100).toFixed(1)}%)`);
      }
      if (!gateResults.drift.passed) {
        failedGates.push(`drift (${(gateResults.drift.score * 100).toFixed(1)}% > ${(gateResults.drift.threshold * 100).toFixed(1)}%)`);
      }
      return `NO-BET: Gate(s) failed: ${failedGates.join(', ')}.`;
    }

    // PICK
    return `PICK: All gates passed. Confidence: ${(gateResults.confidence.score * 100).toFixed(1)}%, Edge: ${(gateResults.edge.score * 100).toFixed(1)}%, Drift: ${(gateResults.drift.score * 100).toFixed(1)}%.`;
  }

  /**
   * Get current configuration
   */
  getConfig(): PolicyConfig {
    return this.config;
  }

  /**
   * Get individual gate for testing
   */
  getConfidenceGate(): ConfidenceGate {
    return this.confidenceGate;
  }

  getEdgeGate(): EdgeGate {
    return this.edgeGate;
  }

  getDriftGate(): DriftGate {
    return this.driftGate;
  }

  getHardStopGate(): HardStopGate {
    return this.hardStopGate;
  }
}

export { DEFAULT_POLICY_CONFIG };
