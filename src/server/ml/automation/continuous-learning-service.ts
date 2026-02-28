import { prisma } from '@/server/db/client';
import { createFeatureEngineeringService } from '@/server/ml/features/feature-engineering';
import { createMonitoringService, type PredictionMetrics } from '@/server/ml/monitoring/monitoring-service';
import { resolvePredictionOutcomes, type OutcomeResolutionResult } from '@/server/ml/monitoring/outcome-resolution-service';
import { createTrainingService, type ModelMetrics } from '@/server/ml/training/training-service';

export interface ContinuousLearningConfig {
  enabled: boolean;
  autoRetrainEnabled: boolean;
  retrainDayOfWeekUtc: number;
  retrainLookbackDays: number;
  minResolvedPredictionsForRetrain: number;
  minAccuracyImprovement: number;
  minCalibrationImprovement: number;
  outcomeResolutionLimit: number;
}

export interface ContinuousLearningResult {
  feedbackExecuted: boolean;
  outcomeResolution: OutcomeResolutionResult;
  weeklyMetrics: PredictionMetrics;
  health: {
    healthy: boolean;
    alerts: string[];
    recommendations: string[];
  };
  retraining: {
    attempted: boolean;
    promoted: boolean;
    reason: string;
    candidateModelVersion?: string;
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getContinuousLearningConfig(): ContinuousLearningConfig {
  return {
    enabled: parseBoolean(process.env.CONTINUOUS_LEARNING_ENABLED, true),
    autoRetrainEnabled: parseBoolean(process.env.AUTO_RETRAIN_ENABLED, false),
    retrainDayOfWeekUtc: parseNumber(process.env.AUTO_RETRAIN_DAY_OF_WEEK_UTC, 1), // Monday
    retrainLookbackDays: parseNumber(process.env.AUTO_RETRAIN_LOOKBACK_DAYS, 730),
    minResolvedPredictionsForRetrain: parseNumber(process.env.AUTO_RETRAIN_MIN_RESOLVED, 150),
    minAccuracyImprovement: parseNumber(process.env.AUTO_RETRAIN_MIN_ACCURACY_IMPROVEMENT, 0.005),
    minCalibrationImprovement: parseNumber(process.env.AUTO_RETRAIN_MIN_CALIBRATION_IMPROVEMENT, 0.002),
    outcomeResolutionLimit: parseNumber(process.env.OUTCOME_RESOLUTION_LIMIT, 500),
  };
}

export function shouldTriggerRetraining(params: {
  config: ContinuousLearningConfig;
  now: Date;
  resolvedPredictions: number;
}): { trigger: boolean; reason: string } {
  const { config, now, resolvedPredictions } = params;

  if (!config.autoRetrainEnabled) {
    return { trigger: false, reason: 'auto_retrain_disabled' };
  }

  if (resolvedPredictions < config.minResolvedPredictionsForRetrain) {
    return {
      trigger: false,
      reason: `insufficient_resolved_predictions(${resolvedPredictions}<${config.minResolvedPredictionsForRetrain})`,
    };
  }

  const utcDay = now.getUTCDay();
  if (utcDay !== config.retrainDayOfWeekUtc) {
    return { trigger: false, reason: `not_retrain_day(utc=${utcDay})` };
  }

  return { trigger: true, reason: 'scheduled_retrain_day' };
}

export function shouldPromoteModel(params: {
  candidate: ModelMetrics;
  current: ModelMetrics;
  config: ContinuousLearningConfig;
}): { promote: boolean; reason: string } {
  const { candidate, current, config } = params;

  const accuracyDelta = candidate.accuracy - current.accuracy;
  const calibrationDelta = current.calibrationError - candidate.calibrationError;

  const accuracyPass = accuracyDelta >= config.minAccuracyImprovement;
  const calibrationPass = calibrationDelta >= config.minCalibrationImprovement;

  if (accuracyPass && calibrationPass) {
    return {
      promote: true,
      reason: `improved_accuracy(${accuracyDelta.toFixed(4)})_and_calibration(${calibrationDelta.toFixed(4)})`,
    };
  }

  if (accuracyPass && candidate.calibrationError <= current.calibrationError) {
    return {
      promote: true,
      reason: `improved_accuracy(${accuracyDelta.toFixed(4)})_with_non_worse_calibration`,
    };
  }

  return {
    promote: false,
    reason: `candidate_not_better(accDelta=${accuracyDelta.toFixed(4)},calDelta=${calibrationDelta.toFixed(4)})`,
  };
}

export async function runContinuousLearningCycle(): Promise<ContinuousLearningResult> {
  const config = getContinuousLearningConfig();

  if (!config.enabled) {
    const monitoring = createMonitoringService();
    return {
      feedbackExecuted: false,
      outcomeResolution: { scanned: 0, resolved: 0, skipped: 0, errors: 0 },
      weeklyMetrics: await monitoring.getMetrics('week'),
      health: await monitoring.runHealthCheck(),
      retraining: {
        attempted: false,
        promoted: false,
        reason: 'continuous_learning_disabled',
      },
    };
  }

  const monitoring = createMonitoringService();

  const outcomeResolution = await resolvePredictionOutcomes(config.outcomeResolutionLimit);
  const weeklyMetrics = await monitoring.getMetrics('week');
  const health = await monitoring.runHealthCheck();

  const retrainDecision = shouldTriggerRetraining({
    config,
    now: new Date(),
    resolvedPredictions: weeklyMetrics.resolvedCount,
  });

  if (!retrainDecision.trigger) {
    return {
      feedbackExecuted: true,
      outcomeResolution,
      weeklyMetrics,
      health,
      retraining: {
        attempted: false,
        promoted: false,
        reason: retrainDecision.reason,
      },
    };
  }

  const activeModel = await prisma.mLModel.findFirst({
    where: { isActive: true },
    orderBy: { activatedAt: 'desc' },
  });

  if (!activeModel) {
    return {
      feedbackExecuted: true,
      outcomeResolution,
      weeklyMetrics,
      health,
      retraining: {
        attempted: false,
        promoted: false,
        reason: 'no_active_model',
      },
    };
  }

  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - config.retrainLookbackDays);

  const featureService = createFeatureEngineeringService();
  const trainingService = createTrainingService(featureService);

  const trainingJob = await trainingService.startTraining(startDate, endDate);
  if (trainingJob.status !== 'completed' || !trainingJob.result) {
    return {
      feedbackExecuted: true,
      outcomeResolution,
      weeklyMetrics,
      health,
      retraining: {
        attempted: true,
        promoted: false,
        reason: trainingJob.error || 'training_failed',
      },
    };
  }

  const currentMetrics: ModelMetrics = {
    accuracy: activeModel.accuracy,
    precision: activeModel.precision,
    recall: activeModel.recall,
    f1Score: activeModel.f1Score,
    logLoss: activeModel.logLoss,
    auc: activeModel.auc,
    calibrationError: activeModel.calibrationError,
  };

  const promotion = shouldPromoteModel({
    candidate: trainingJob.result.modelVersion.metrics,
    current: currentMetrics,
    config,
  });

  if (!promotion.promote) {
    return {
      feedbackExecuted: true,
      outcomeResolution,
      weeklyMetrics,
      health,
      retraining: {
        attempted: true,
        promoted: false,
        reason: promotion.reason,
        candidateModelVersion: trainingJob.result.modelVersion.version,
      },
    };
  }

  await trainingService.activateModel(trainingJob.result.modelVersion.id);

  return {
    feedbackExecuted: true,
    outcomeResolution,
    weeklyMetrics,
    health,
    retraining: {
      attempted: true,
      promoted: true,
      reason: promotion.reason,
      candidateModelVersion: trainingJob.result.modelVersion.version,
    },
  };
}
