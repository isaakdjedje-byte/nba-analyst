import { describe, expect, it } from 'vitest';
import {
  getContinuousLearningConfig,
  shouldPromoteModel,
  shouldTriggerRetraining,
  type ContinuousLearningConfig,
} from './continuous-learning-service';

function baseConfig(): ContinuousLearningConfig {
  return {
    enabled: true,
    autoRetrainEnabled: true,
    retrainDayOfWeekUtc: 1,
    retrainLookbackDays: 730,
    minResolvedPredictionsForRetrain: 100,
    minAccuracyImprovement: 0.005,
    minCalibrationImprovement: 0.002,
    outcomeResolutionLimit: 500,
  };
}

describe('continuous-learning-service helpers', () => {
  it('loads sane default config', () => {
    const cfg = getContinuousLearningConfig();
    expect(typeof cfg.enabled).toBe('boolean');
    expect(cfg.retrainLookbackDays).toBeGreaterThan(0);
    expect(cfg.outcomeResolutionLimit).toBeGreaterThan(0);
  });

  it('does not trigger retraining when not retrain day', () => {
    const decision = shouldTriggerRetraining({
      config: baseConfig(),
      now: new Date('2026-02-17T12:00:00.000Z'), // Tuesday
      resolvedPredictions: 200,
    });

    expect(decision.trigger).toBe(false);
    expect(decision.reason).toContain('not_retrain_day');
  });

  it('does not trigger retraining with insufficient resolved predictions', () => {
    const decision = shouldTriggerRetraining({
      config: baseConfig(),
      now: new Date('2026-02-16T12:00:00.000Z'), // Monday
      resolvedPredictions: 50,
    });

    expect(decision.trigger).toBe(false);
    expect(decision.reason).toContain('insufficient_resolved_predictions');
  });

  it('triggers retraining on schedule with enough resolved data', () => {
    const decision = shouldTriggerRetraining({
      config: baseConfig(),
      now: new Date('2026-02-16T12:00:00.000Z'), // Monday
      resolvedPredictions: 200,
    });

    expect(decision.trigger).toBe(true);
  });

  it('promotes candidate when accuracy and calibration improve', () => {
    const result = shouldPromoteModel({
      config: baseConfig(),
      current: {
        accuracy: 0.58,
        precision: 0.58,
        recall: 0.58,
        f1Score: 0.58,
        logLoss: 0.67,
        auc: 0.61,
        calibrationError: 0.08,
      },
      candidate: {
        accuracy: 0.59,
        precision: 0.59,
        recall: 0.58,
        f1Score: 0.585,
        logLoss: 0.65,
        auc: 0.62,
        calibrationError: 0.07,
      },
    });

    expect(result.promote).toBe(true);
  });

  it('does not promote when candidate is weaker', () => {
    const result = shouldPromoteModel({
      config: baseConfig(),
      current: {
        accuracy: 0.59,
        precision: 0.58,
        recall: 0.58,
        f1Score: 0.58,
        logLoss: 0.65,
        auc: 0.62,
        calibrationError: 0.07,
      },
      candidate: {
        accuracy: 0.58,
        precision: 0.58,
        recall: 0.58,
        f1Score: 0.58,
        logLoss: 0.67,
        auc: 0.61,
        calibrationError: 0.09,
      },
    });

    expect(result.promote).toBe(false);
  });
});
