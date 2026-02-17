/**
 * Policy Engine Types
 * 
 * Domain types for the centralized Policy Engine.
 * Story 2.5: Single source of truth for Pick/No-Bet/Hard-Stop decisions.
 */

// Decision status type (mirrored from repository to avoid import issues)
export type DecisionStatus = 'PICK' | 'NO_BET' | 'HARD_STOP';

// ============================================
// Policy Configuration Types
// ============================================

export interface ConfidenceConfig {
  minThreshold: number;  // e.g., 0.65 (65%)
}

export interface EdgeConfig {
  minThreshold: number;  // e.g., 0.05 (5%)
}

export interface DriftConfig {
  maxDriftScore: number; // e.g., 0.15 (15%)
}

export interface HardStopsConfig {
  dailyLossLimit: number;     // e.g., 1000 (currency)
  consecutiveLosses: number;  // e.g., 5
  bankrollPercent: number;    // e.g., 0.10 (10%)
}

export interface PolicyConfig {
  confidence: ConfidenceConfig;
  edge: EdgeConfig;
  drift: DriftConfig;
  hardStops: HardStopsConfig;
}

// ============================================
// Prediction Input Types
// ============================================

export interface PredictionInput {
  id: string;
  matchId: string;
  runId: string;
  userId: string;
  confidence: number;
  edge?: number;
  driftScore?: number;
  winnerPrediction?: string | null;
  scorePrediction?: string | null;
  overUnderPrediction?: number | null;
  modelVersion: string;
}

// ============================================
// Run Context Types
// ============================================

export interface RunContext {
  runId: string;
  traceId: string;
  dailyLoss: number;
  consecutiveLosses: number;
  currentBankroll: number;
  executedAt: Date;
}

// ============================================
// Gate Result Types
// ============================================

export type GateSeverity = 'info' | 'warning' | 'blocking';

export interface GateResult {
  passed: boolean;
  score: number;
  threshold: number;
  message: string;
  severity: GateSeverity;
  gateName: string;
}

export interface GateResults {
  confidence: GateResult;
  edge: GateResult;
  drift: GateResult;
  hardStop: GateResult;
}

// ============================================
// Decision Outcome Types
// ============================================

export interface DecisionOutcome {
  status: DecisionStatus;
  rationale: string;
  recommendedAction: string | null;
  hardStopReason: string | null;
}

export interface PolicyEvaluationResult {
  decisionId: string;
  predictionId: string;
  status: DecisionStatus;
  rationale: string;
  confidenceGate: boolean;
  edgeGate: boolean;
  driftGate: boolean;
  hardStopGate: boolean;
  hardStopReason: string | null;
  recommendedAction: string | null;
  traceId: string;
  executedAt: Date;
  gateOutcomes: {
    confidence: Pick<GateResult, 'passed' | 'score' | 'threshold'>;
    edge: Pick<GateResult, 'passed' | 'score' | 'threshold'>;
    drift: Pick<GateResult, 'passed' | 'score' | 'threshold'>;
    hardStop: Pick<GateResult, 'passed'>;
  };
}

// ============================================
// Policy Engine Error Types
// ============================================

export class PolicyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PolicyError';
  }
}

export class PolicyViolationError extends PolicyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'POLICY_VIOLATION', details);
    this.name = 'PolicyViolationError';
  }
}

export class DataQualityError extends PolicyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DATA_QUALITY_ERROR', details);
    this.name = 'DataQualityError';
  }
}

export class ConfigurationError extends PolicyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

// ============================================
// API Response Types
// ============================================

export interface PolicyEvaluationResponse {
  data: {
    decisionId: string;
    status: DecisionStatus;
    rationale: string;
    gateOutcomes: {
      confidence: { passed: boolean; score: number; threshold: number };
      edge: { passed: boolean; score: number; threshold: number };
      drift: { passed: boolean; score: number; threshold: number };
      hardStop: { passed: boolean };
    };
    recommendedAction: string | null;
  };
  meta: {
    traceId: string;
    timestamp: string;
  };
}

export interface PolicyErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    traceId: string;
    timestamp: string;
  };
}
