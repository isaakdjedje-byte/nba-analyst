/**
 * ML Monitoring Service
 * 
 * Tracks model performance, data drift, and prediction quality.
 * Provides real-time metrics and alerting.
 */

import { prisma } from '@/server/db/client';

// =============================================================================
// TYPES
// =============================================================================

export interface PredictionMetrics {
  // Time window
  date: Date;
  window: 'day' | 'week' | 'month';
  
  // Volume
  totalPredictions: number;
  pickCount: number;
  noBetCount: number;
  hardStopCount: number;
  
  // Accuracy (resolved predictions)
  resolvedCount: number;
  correctPredictions: number;
  accuracy: number;
  
  // Calibration
  avgPredictedProbability: number;
  avgActualOutcome: number;
  calibrationError: number;
  
  // Confidence distribution
  highConfidenceRate: number;  // > 0.7
  mediumConfidenceRate: number; // 0.55 - 0.7
  lowConfidenceRate: number;   // < 0.55
  
  // Model info
  modelVersion: string;
  algorithm: string;
}

export interface DriftMetrics {
  featureName: string;
  baselineMean: number;
  currentMean: number;
  driftScore: number; // |current - baseline| / std
  isSignificant: boolean;
  lastUpdated: Date;
}

export interface FeatureDriftReport {
  timestamp: Date;
  modelVersion: string;
  driftedFeatures: DriftMetrics[];
  totalDriftScore: number;
  alertLevel: 'none' | 'low' | 'medium' | 'high';
}

export interface ModelHealthStatus {
  modelVersion: string;
  isHealthy: boolean;
  lastPredictionAt: Date;
  predictionsInLastHour: number;
  avgLatencyMs: number;
  errorRate: number;
  issues: string[];
}

export interface LatestModelSummary {
  version: string;
  algorithm: string;
  trainedAt: Date;
  activatedAt: Date | null;
  trainingDataStart: Date;
  trainingDataEnd: Date;
  numTrainingSamples: number;
  numTestSamples: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  logLoss: number;
  auc: number;
  calibrationError: number;
}

export interface MonitoringConfig {
  calibrationCheckInterval: number; // hours
  driftCheckInterval: number;      // hours
  accuracyThreshold: number;       // minimum accuracy
  calibrationThreshold: number;   // maximum calibration error
  driftThreshold: number;          // maximum drift score
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  calibrationCheckInterval: 24,
  driftCheckInterval: 24,
  accuracyThreshold: 0.52,      // Better than coin flip
  calibrationThreshold: 0.1,     // ECE < 10%
  driftThreshold: 2.0,           // 2 standard deviations
};

// =============================================================================
// MONITORING SERVICE
// =============================================================================

export class MonitoringService {
  private config: MonitoringConfig;
  private baselineStats: Map<string, { mean: number; std: number }> = new Map();

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
  }

  private toNumber(value: unknown, fallback: number = 0): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : fallback;
    }
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  }

  /**
   * Record a prediction event
   */
  async recordPrediction(prediction: {
    predictionId: string;
    modelVersion: string;
    algorithm: string;
    features: Record<string, number>;
    predictedProbability: number;
    predictedWinner: 'HOME' | 'AWAY';
    confidence: number;
    latencyMs: number;
  }): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO prediction_logs (
        id,
        prediction_id,
        model_version,
        algorithm,
        features,
        predicted_probability,
        predicted_winner,
        confidence,
        latency_ms,
        created_at
      ) VALUES (
        ${`log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`},
        ${prediction.predictionId},
        ${prediction.modelVersion},
        ${prediction.algorithm},
        ${JSON.stringify(prediction.features)},
        ${prediction.predictedProbability},
        ${prediction.predictedWinner},
        ${prediction.confidence},
        ${prediction.latencyMs},
        NOW()
      )
    `;
  }

  /**
   * Record actual outcome (when game completes)
   */
  async recordOutcome(
    predictionId: string,
    actualWinner: 'HOME' | 'AWAY',
    homeScore: number,
    awayScore: number
  ): Promise<void> {
    await prisma.$executeRaw`
      UPDATE prediction_logs
      SET 
        actual_winner = ${actualWinner},
        home_score = ${homeScore},
        away_score = ${awayScore},
        resolved_at = NOW(),
        correct = (predicted_winner = ${actualWinner})
      WHERE prediction_id = ${predictionId}
    `;
  }

  /**
   * Get metrics for a time window
   */
  async getMetrics(
    window: 'day' | 'week' | 'month',
    modelVersion?: string
  ): Promise<PredictionMetrics> {
    const windowDays = window === 'day' ? 1 : window === 'week' ? 7 : 30;

    const results = modelVersion
      ? await prisma.$queryRaw<{
          total: number;
          resolved: number;
          correct: number;
          avg_prob: number;
          avg_actual: number;
          high_conf: number;
          med_conf: number;
          low_conf: number;
        }[]>`
          SELECT
            COUNT(*) as total,
            COUNT(actual_winner) as resolved,
            SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct,
            AVG(predicted_probability) as avg_prob,
            AVG(CASE WHEN actual_winner = 'HOME' THEN 1 ELSE 0 END) as avg_actual,
            SUM(CASE WHEN confidence > 0.7 THEN 1 ELSE 0 END)::float / COUNT(*) as high_conf,
            SUM(CASE WHEN confidence BETWEEN 0.55 AND 0.7 THEN 1 ELSE 0 END)::float / COUNT(*) as med_conf,
            SUM(CASE WHEN confidence < 0.55 THEN 1 ELSE 0 END)::float / COUNT(*) as low_conf
          FROM prediction_logs
          WHERE created_at > NOW() - (${windowDays} * INTERVAL '1 day')
            AND model_version = ${modelVersion}
        `
      : await prisma.$queryRaw<{
          total: number;
          resolved: number;
          correct: number;
          avg_prob: number;
          avg_actual: number;
          high_conf: number;
          med_conf: number;
          low_conf: number;
        }[]>`
          SELECT
            COUNT(*) as total,
            COUNT(actual_winner) as resolved,
            SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct,
            AVG(predicted_probability) as avg_prob,
            AVG(CASE WHEN actual_winner = 'HOME' THEN 1 ELSE 0 END) as avg_actual,
            SUM(CASE WHEN confidence > 0.7 THEN 1 ELSE 0 END)::float / COUNT(*) as high_conf,
            SUM(CASE WHEN confidence BETWEEN 0.55 AND 0.7 THEN 1 ELSE 0 END)::float / COUNT(*) as med_conf,
            SUM(CASE WHEN confidence < 0.55 THEN 1 ELSE 0 END)::float / COUNT(*) as low_conf
          FROM prediction_logs
          WHERE created_at > NOW() - (${windowDays} * INTERVAL '1 day')
        `;

    const row = results[0];
    const resolvedCount = this.toNumber(row?.resolved, 0);
    const correctCount = this.toNumber(row?.correct, 0);
    const totalCount = this.toNumber(row?.total, 0);
    const avgProb = this.toNumber(row?.avg_prob, 0);
    const avgActual = this.toNumber(row?.avg_actual, 0);

    return {
      date: new Date(),
      window,
      totalPredictions: totalCount,
      pickCount: totalCount, // Simplified
      noBetCount: 0,
      hardStopCount: 0,
      resolvedCount,
      correctPredictions: correctCount,
      accuracy: resolvedCount > 0 ? correctCount / resolvedCount : 0,
      avgPredictedProbability: avgProb,
      avgActualOutcome: avgActual,
      calibrationError: Math.abs(avgProb - avgActual),
      highConfidenceRate: this.toNumber(row?.high_conf, 0),
      mediumConfidenceRate: this.toNumber(row?.med_conf, 0),
      lowConfidenceRate: this.toNumber(row?.low_conf, 0),
      modelVersion: modelVersion || 'unknown',
      algorithm: 'unknown',
    };
  }

  /**
   * Calculate calibration bins
   */
  async getCalibrationData(
    modelVersion?: string,
    numBins: number = 10
  ): Promise<{ bin: number; predicted: number; observed: number; count: number }[]> {
    const results = modelVersion
      ? await prisma.$queryRaw<{
          bin: number;
          avg_pred: number;
          avg_actual: number;
          count: number;
        }[]>`
          SELECT
            FLOOR(predicted_probability * ${numBins}) as bin,
            AVG(predicted_probability) as avg_pred,
            AVG(CASE WHEN actual_winner = 'HOME' THEN 1 ELSE 0 END) as avg_actual,
            COUNT(*) as count
          FROM prediction_logs
          WHERE actual_winner IS NOT NULL
            AND model_version = ${modelVersion}
          GROUP BY 1
          ORDER BY 1
        `
      : await prisma.$queryRaw<{
          bin: number;
          avg_pred: number;
          avg_actual: number;
          count: number;
        }[]>`
          SELECT
            FLOOR(predicted_probability * ${numBins}) as bin,
            AVG(predicted_probability) as avg_pred,
            AVG(CASE WHEN actual_winner = 'HOME' THEN 1 ELSE 0 END) as avg_actual,
            COUNT(*) as count
          FROM prediction_logs
          WHERE actual_winner IS NOT NULL
          GROUP BY 1
          ORDER BY 1
        `;

    return results.map(r => ({
      bin: this.toNumber(r.bin, 0),
      predicted: this.toNumber(r.avg_pred, 0),
      observed: this.toNumber(r.avg_actual, 0),
      count: this.toNumber(r.count, 0),
    }));
  }

  /**
   * Detect feature drift
   */
  async detectDrift(
    modelVersion: string,
    baselineWindow: number = 30, // days
    currentWindow: number = 7     // days
  ): Promise<FeatureDriftReport> {
    // Get baseline feature statistics
    const baselineResults = await prisma.$queryRaw<{
      feature_name: string;
      mean: number;
      std: number;
    }[]>`
      SELECT 
        key as feature_name,
        AVG((value)::float) as mean,
        STDDEV((value)::float) as std
      FROM prediction_logs,
        JSONB_EACH_TEXT(features)
      WHERE model_version = ${modelVersion}
        AND created_at > NOW() - (${baselineWindow} * INTERVAL '1 day')
        AND created_at < NOW() - (${currentWindow} * INTERVAL '1 day')
      GROUP BY key
    `;

    // Get current feature statistics
    const currentResults = await prisma.$queryRaw<{
      feature_name: string;
      mean: number;
    }[]>`
      SELECT 
        key as feature_name,
        AVG((value)::float) as mean
      FROM prediction_logs,
        JSONB_EACH_TEXT(features)
      WHERE model_version = ${modelVersion}
        AND created_at > NOW() - (${currentWindow} * INTERVAL '1 day')
      GROUP BY key
    `;

    // Calculate drift
    const driftedFeatures: DriftMetrics[] = [];
    let totalDriftScore = 0;

    for (const current of currentResults) {
      const baseline = baselineResults.find(b => b.feature_name === current.feature_name);
      
      if (baseline) {
        const baselineMean = baseline.mean;
        const currentMean = current.mean;
        const std = baseline.std || 0.01; // Avoid division by zero
        
        const driftScore = Math.abs(currentMean - baselineMean) / std;
        const isSignificant = driftScore > this.config.driftThreshold;
        
        if (isSignificant) {
          driftedFeatures.push({
            featureName: current.feature_name,
            baselineMean,
            currentMean,
            driftScore,
            isSignificant,
            lastUpdated: new Date(),
          });
        }
        
        totalDriftScore += driftScore;
      }
    }

    // Determine alert level
    let alertLevel: FeatureDriftReport['alertLevel'] = 'none';
    if (driftedFeatures.length > 5) alertLevel = 'high';
    else if (driftedFeatures.length > 2) alertLevel = 'medium';
    else if (driftedFeatures.length > 0) alertLevel = 'low';

    return {
      timestamp: new Date(),
      modelVersion,
      driftedFeatures,
      totalDriftScore,
      alertLevel,
    };
  }

  /**
   * Get model health status
   */
  async getModelHealth(modelVersion: string): Promise<ModelHealthStatus> {
    const lastHour = await prisma.$queryRaw<{
      count: number;
      avg_latency: number;
      last_prediction: Date;
    }[]>`
      SELECT 
        COUNT(*) as count,
        AVG(latency_ms) as avg_latency,
        MAX(created_at) as last_prediction
      FROM prediction_logs
      WHERE model_version = ${modelVersion}
        AND created_at > NOW() - INTERVAL '1 hour'
    `;

    const errors = await prisma.$queryRaw<{
      error_count: number;
    }[]>`
      SELECT COUNT(*) as error_count
      FROM prediction_logs
      WHERE model_version = ${modelVersion}
        AND created_at > NOW() - INTERVAL '24 hours'
        AND error IS NOT NULL
    `;

    const totalLast24h = await prisma.$queryRaw<{
      count: number;
    }[]>`
      SELECT COUNT(*) as count
      FROM prediction_logs
      WHERE model_version = ${modelVersion}
        AND created_at > NOW() - INTERVAL '24 hours'
    `;

    const issues: string[] = [];
    const predictionsInLastHour = this.toNumber(lastHour[0]?.count, 0);
    const avgLatency = this.toNumber(lastHour[0]?.avg_latency, 0);
    const errorCount = this.toNumber(errors[0]?.error_count, 0);
    const total24h = this.toNumber(totalLast24h[0]?.count, 0);
    const errorRate = total24h > 0 ? errorCount / total24h : 0;

    if (predictionsInLastHour === 0) {
      issues.push('No predictions in last hour');
    }
    if (avgLatency > 1000) {
      issues.push(`High latency: ${avgLatency.toFixed(0)}ms`);
    }
    if (errorRate > 0.05) {
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
    }

    return {
      modelVersion,
      isHealthy: issues.length === 0,
      lastPredictionAt: lastHour[0]?.last_prediction,
      predictionsInLastHour,
      avgLatencyMs: avgLatency,
      errorRate,
      issues,
    };
  }

  /**
   * Get feature importance from predictions
   */
  async getFeatureImportanceFromPredictions(
    modelVersion: string,
    limit: number = 20
  ): Promise<{ feature: string; importance: number }[]> {
    // Calculate correlation with correct predictions
    const results = await prisma.$queryRaw<{
      feature: string;
      correlation: number;
    }[]>`
      SELECT 
        key as feature,
        CORR(
          (value)::float,
          CASE WHEN correct THEN 1 ELSE 0 END
        ) as correlation
      FROM prediction_logs,
        JSONB_EACH_TEXT(features)
      WHERE model_version = ${modelVersion}
        AND correct IS NOT NULL
      GROUP BY key
      ORDER BY ABS(CORR((value)::float, CASE WHEN correct THEN 1 ELSE 0 END)) DESC
      LIMIT ${limit}
    `;

    return results.map(r => ({
      feature: r.feature,
      importance: Math.abs(r.correlation ?? 0),
    }));
  }

  /**
   * Generate monitoring dashboard data
   */
  async getDashboardData(): Promise<{
    dailyMetrics: PredictionMetrics[];
    modelHealth: ModelHealthStatus[];
    drift: FeatureDriftReport | null;
    calibration: { bin: number; predicted: number; observed: number; count: number }[];
    latestModel: LatestModelSummary | null;
  }> {
    // Get last 7 days of metrics from prediction logs
    const dailyRows = await prisma.$queryRaw<{
      day: Date;
      total: number;
      resolved: number;
      correct: number;
      avg_prob: number | null;
      avg_actual: number | null;
      high_conf: number | null;
      med_conf: number | null;
      low_conf: number | null;
    }[]>`
      SELECT
        DATE(created_at) as day,
        COUNT(*)::int as total,
        COUNT(actual_winner)::int as resolved,
        SUM(CASE WHEN correct THEN 1 ELSE 0 END)::int as correct,
        AVG(predicted_probability) as avg_prob,
        AVG(CASE WHEN actual_winner = 'HOME' THEN 1 ELSE 0 END) as avg_actual,
        SUM(CASE WHEN confidence > 0.7 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)::float as high_conf,
        SUM(CASE WHEN confidence BETWEEN 0.55 AND 0.7 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)::float as med_conf,
        SUM(CASE WHEN confidence < 0.55 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)::float as low_conf
      FROM prediction_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `;

    const dailyMetrics: PredictionMetrics[] = dailyRows.map((row) => {
      const resolved = this.toNumber(row.resolved, 0);
      const correct = this.toNumber(row.correct, 0);
      const total = this.toNumber(row.total, 0);
      const avgProb = this.toNumber(row.avg_prob, 0);
      const avgActual = this.toNumber(row.avg_actual, 0);

      return {
        date: row.day,
        window: 'day',
        totalPredictions: total,
        pickCount: total,
        noBetCount: 0,
        hardStopCount: 0,
        resolvedCount: resolved,
        correctPredictions: correct,
        accuracy: resolved > 0 ? correct / resolved : 0,
        avgPredictedProbability: avgProb,
        avgActualOutcome: avgActual,
        calibrationError: Math.abs(avgProb - avgActual),
        highConfidenceRate: this.toNumber(row.high_conf, 0),
        mediumConfidenceRate: this.toNumber(row.med_conf, 0),
        lowConfidenceRate: this.toNumber(row.low_conf, 0),
        modelVersion: 'mixed',
        algorithm: 'mixed',
      };
    });

    // Get active models health
    const activeModels = await prisma.$queryRaw<{ model_version: string }[]>`
      SELECT DISTINCT model_version
      FROM prediction_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const modelHealth: ModelHealthStatus[] = [];
    for (const { model_version } of activeModels) {
      modelHealth.push(await this.getModelHealth(model_version));
    }

    // Get drift for most used model
    const mostUsedModel = await prisma.$queryRaw<{ model_version: string }[]>`
      SELECT model_version
      FROM prediction_logs
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY model_version
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `;

    let drift: FeatureDriftReport | null = null;
    if (mostUsedModel.length > 0) {
      drift = await this.detectDrift(mostUsedModel[0].model_version);
    }

    // Get calibration data
    const calibration = await this.getCalibrationData();

    // Get active model summary
    const activeModel = await prisma.mLModel.findFirst({
      where: { isActive: true },
      orderBy: { activatedAt: 'desc' },
    });

    const latestModel: LatestModelSummary | null = activeModel
      ? {
          version: activeModel.version,
          algorithm: activeModel.algorithm,
          trainedAt: activeModel.createdAt,
          activatedAt: activeModel.activatedAt,
          trainingDataStart: activeModel.trainingDataStart,
          trainingDataEnd: activeModel.trainingDataEnd,
          numTrainingSamples: activeModel.numTrainingSamples,
          numTestSamples: activeModel.numTestSamples,
          accuracy: activeModel.accuracy,
          precision: activeModel.precision,
          recall: activeModel.recall,
          f1Score: activeModel.f1Score,
          logLoss: activeModel.logLoss,
          auc: activeModel.auc,
          calibrationError: activeModel.calibrationError,
        }
      : null;

    return {
      dailyMetrics,
      modelHealth,
      drift,
      calibration,
      latestModel,
    };
  }

  /**
   * Run health check and return alerts
   */
  async runHealthCheck(): Promise<{
    healthy: boolean;
    alerts: string[];
    recommendations: string[];
  }> {
    const alerts: string[] = [];
    const recommendations: string[] = [];

    // Check accuracy
    const metrics = await this.getMetrics('week');
    if (metrics.accuracy < this.config.accuracyThreshold && metrics.resolvedCount > 10) {
      alerts.push(`Accuracy ${(metrics.accuracy * 100).toFixed(1)}% below threshold ${(this.config.accuracyThreshold * 100).toFixed(1)}%`);
      recommendations.push('Consider retraining model with recent data');
    }

    // Check calibration
    if (metrics.calibrationError > this.config.calibrationThreshold) {
      alerts.push(`Calibration error ${(metrics.calibrationError * 100).toFixed(1)}% above threshold ${(this.config.calibrationThreshold * 100).toFixed(1)}%`);
      recommendations.push('Model is overconfident - consider calibration techniques');
    }

    // Check drift
    const activeModels = await prisma.$queryRaw<{ model_version: string }[]>`
      SELECT DISTINCT model_version
      FROM prediction_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    for (const { model_version } of activeModels) {
      const drift = await this.detectDrift(model_version);
      if (drift.alertLevel === 'high') {
        alerts.push(`High feature drift detected for model ${model_version}`);
        recommendations.push('Retrain model with current data distribution');
      }
    }

    return {
      healthy: alerts.length === 0,
      alerts,
      recommendations,
    };
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createMonitoringService(
  config?: Partial<MonitoringConfig>
): MonitoringService {
  return new MonitoringService(config);
}
