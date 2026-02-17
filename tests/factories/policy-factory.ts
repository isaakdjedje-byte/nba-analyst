/**
 * Data factories for Policy Engine and Hard-Stop Tracker tests
 * Stories: 2.5, 2.6
 */

import { faker } from '@faker-js/faker';

export interface PolicyConfig {
  edge_threshold: number;
  confidence_threshold: number;
  drift_threshold: number;
  hard_stop_enabled: boolean;
  version: string;
}

export interface PredictionInput {
  prediction_id: string;
  model_version: string;
  edge: number;
  confidence: number;
  drift_score: number;
  metadata?: Record<string, unknown>;
}

export interface PolicyGateResult {
  gate_name: string;
  passed: boolean;
  score: number;
  threshold: number;
  message?: string;
}

export interface PolicyEvaluationResult {
  evaluation_id: string;
  prediction_id: string;
  final_decision: 'Pick' | 'No-Bet' | 'Hard-Stop';
  gate_results: PolicyGateResult[];
  hard_stop_triggered: boolean;
  hard_stop_cause?: string;
  timestamp: string;
}

export interface HardStopStatus {
  active: boolean;
  triggered_at?: string;
  cause?: string;
  recommendation?: string;
  affected_predictions: number;
}

export interface DailyRunStatus {
  run_id: string;
  status: 'running' | 'completed' | 'hard_stop';
  total_predictions: number;
  processed_count: number;
  hard_stop_count: number;
  started_at: string;
}

export interface PerformanceMetrics {
  endpoint: string;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;
  throughput_rps: number;
  network_condition: '3g' | '4g' | 'wifi';
}

export class PolicyFactory {
  static createPolicyConfig(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
    return {
      edge_threshold: 0.05,
      confidence_threshold: 0.75,
      drift_threshold: 0.15,
      hard_stop_enabled: true,
      version: '2.5.0',
      ...overrides
    };
  }

  static createPrediction(overrides: Partial<PredictionInput> = {}): PredictionInput {
    return {
      prediction_id: faker.string.uuid(),
      model_version: 'v2.1.0',
      edge: parseFloat(faker.number.float({ min: 0, max: 0.2 }).toFixed(3)),
      confidence: parseFloat(faker.number.float({ min: 0.5, max: 1.0 }).toFixed(3)),
      drift_score: parseFloat(faker.number.float({ min: 0, max: 0.3 }).toFixed(3)),
      metadata: {
        sport: faker.helpers.arrayElement(['NBA', 'NFL', 'MLB', 'NHL']),
        game_time: faker.date.future().toISOString()
      },
      ...overrides
    };
  }

  static createValidPrediction(): PredictionInput {
    return this.createPrediction({
      edge: 0.08,
      confidence: 0.85,
      drift_score: 0.05
    });
  }

  static createNoBetPrediction(): PredictionInput {
    return this.createPrediction({
      edge: 0.03,
      confidence: 0.85,
      drift_score: 0.05
    });
  }

  static createHardStopPrediction(): PredictionInput {
    return this.createPrediction({
      edge: 0.02,
      confidence: 0.60,
      drift_score: 0.25
    });
  }

  static createPolicyEvaluationResult(
    predictionId: string,
    decision: 'Pick' | 'No-Bet' | 'Hard-Stop',
    overrides: Partial<PolicyEvaluationResult> = {}
  ): PolicyEvaluationResult {
    return {
      evaluation_id: faker.string.uuid(),
      prediction_id: predictionId,
      final_decision: decision,
      gate_results: [
        {
          gate_name: 'edge_gate',
          passed: decision === 'Pick',
          score: 0.08,
          threshold: 0.05,
          message: decision === 'Pick' ? 'Edge threshold met' : 'Edge below threshold'
        },
        {
          gate_name: 'confidence_gate',
          passed: true,
          score: 0.85,
          threshold: 0.75,
          message: 'Confidence threshold met'
        },
        {
          gate_name: 'drift_gate',
          passed: decision !== 'Hard-Stop',
          score: 0.25,
          threshold: 0.15,
          message: decision === 'Hard-Stop' ? 'Drift exceeded threshold' : 'Drift within limits'
        }
      ],
      hard_stop_triggered: decision === 'Hard-Stop',
      hard_stop_cause: decision === 'Hard-Stop' ? 'drift_threshold_exceeded' : undefined,
      timestamp: new Date().toISOString(),
      ...overrides
    };
  }

  static createHardStopStatus(active: boolean, overrides: Partial<HardStopStatus> = {}): HardStopStatus {
    return {
      active,
      triggered_at: active ? new Date().toISOString() : undefined,
      cause: active ? 'drift_threshold_exceeded' : undefined,
      recommendation: active ? 'Review model performance before continuing' : undefined,
      affected_predictions: active ? 47 : 0,
      ...overrides
    };
  }

  static createDailyRunStatus(overrides: Partial<DailyRunStatus> = {}): DailyRunStatus {
    return {
      run_id: faker.string.uuid(),
      status: 'running',
      total_predictions: 150,
      processed_count: 89,
      hard_stop_count: 0,
      started_at: new Date().toISOString(),
      ...overrides
    };
  }

  static createPerformanceMetrics(overrides: Partial<PerformanceMetrics> = {}): PerformanceMetrics {
    return {
      endpoint: '/api/v1/policy/evaluate',
      latency_p50_ms: 250,
      latency_p95_ms: 450,
      latency_p99_ms: 650,
      throughput_rps: 50,
      network_condition: '3g',
      ...overrides
    };
  }
}
