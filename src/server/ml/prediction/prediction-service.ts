/**
 * ML Prediction Service
 * 
 * Provides real-time predictions for NBA games.
 * Integrates with the feature engineering pipeline and trained models.
 */

import { prisma } from '@/server/db/client';
import { FeatureEngineeringService, createFeatureEngineeringService } from '@/server/ml/features/feature-engineering';
import { FeatureRecord, FeatureValidationResult } from '@/server/ml/features/types';
import { LogisticRegressionModel, PredictionResult as ModelPredictionResult } from '@/server/ml/models/logistic-regression';
import { TrainingService, createTrainingService } from '@/server/ml/training/training-service';
import { Game, BoxScore } from '@/server/ingestion/schema/nba-schemas';
import { TIME } from '@/lib/constants';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// =============================================================================
// TYPES
// =============================================================================

export interface PredictionInput {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  scheduledAt: Date;
}

export interface PredictionOutput {
  matchId: string;
  prediction: {
    winner: 'HOME' | 'AWAY';
    confidence: number;
    homeWinProbability: number;
    awayWinProbability: number;
  };
  score: {
    predictedHomeScore: number;
    predictedAwayScore: number;
    totalPoints: number;
  };
  overUnder: {
    line: number;
    prediction: 'OVER' | 'UNDER';
    confidence: number;
  };
  model: {
    version: string;
    algorithm: string;
    featureCount: number;
    featureQuality: number;
  };
  features: {
    homeWinRate: number;
    awayWinRate: number;
    homeAdvantage: number;
    h2hAdvantage: number;
    restAdvantage: number;
  };
  traceId: string;
}

export interface PredictionError {
  code: 'MODEL_NOT_FOUND' | 'FEATURES_INVALID' | 'INSUFFICIENT_DATA' | 'PREDICTION_FAILED';
  message: string;
  details?: Record<string, unknown>;
}

export interface PredictionOptions {
  useCache?: boolean;
  forceRefresh?: boolean;
  minQualityScore?: number;
}

export interface CachedPrediction {
  id: string;
  matchId: string;
  output: PredictionOutput;
  computedAt: Date;
  expiresAt: Date;
}

// =============================================================================
// PREDICTION SERVICE
// =============================================================================

export class PredictionService {
  private featureService: FeatureEngineeringService;
  private trainingService: TrainingService;
  private currentModel: { version: string; algorithm: string; model: LogisticRegressionModel } | null = null;
  private modelLoadedAt: Date | null = null;

  constructor() {
    this.featureService = createFeatureEngineeringService();
    this.trainingService = createTrainingService(this.featureService);
  }

  /**
   * Load the active model
   */
  private async loadActiveModel(): Promise<void> {
    if (this.currentModel && this.modelLoadedAt) {
      const age = Date.now() - this.modelLoadedAt.getTime();
      if (age < TIME.HOUR_MS) {
        return;
      }
    }

    const result = await this.trainingService.loadActiveModel();
    
    if (!result) {
      throw new Error('No active model found. Please train and activate a model first.');
    }

    this.currentModel = {
      version: result.version.version,
      algorithm: result.version.algorithm,
      model: result.model,
    };
    this.modelLoadedAt = new Date();
  }

  /**
   * Normalize conference values to schema-compatible enum
   */
  private normalizeConference(value: string | null | undefined): 'East' | 'West' {
    return value?.toLowerCase() === 'west' ? 'West' : 'East';
  }

  /**
   * Normalize season type to schema-compatible enum
   */
  private normalizeSeasonType(value: string | null | undefined): 'Regular Season' | 'Pre Season' | 'Playoffs' | 'All Star' {
    if (!value) return 'Regular Season';
    const normalized = value.toLowerCase();
    if (normalized.includes('playoff')) return 'Playoffs';
    if (normalized.includes('pre')) return 'Pre Season';
    if (normalized.includes('all')) return 'All Star';
    return 'Regular Season';
  }

  /**
   * Map persisted game + box score rows to ingestion box score schema
   */
  private toIngestionBoxScore(game: {
    externalId: number;
    homeTeamId: number;
    awayTeamId: number;
    boxScore: {
      homePoints: number;
      homeRebounds: number;
      homeAssists: number;
      homeSteals: number;
      homeBlocks: number;
      homeTurnovers: number;
      homeFgPct: number;
      home3pPct: number;
      homeFtPct: number;
      awayPoints: number;
      awayRebounds: number;
      awayAssists: number;
      awaySteals: number;
      awayBlocks: number;
      awayTurnovers: number;
      awayFgPct: number;
      away3pPct: number;
      awayFtPct: number;
    } | null;
  }): BoxScore | null {
    const bs = game.boxScore;
    if (!bs) return null;

    return {
      gameId: game.externalId,
      homeTeam: {
        teamId: game.homeTeamId,
        points: bs.homePoints,
        rebounds: bs.homeRebounds,
        assists: bs.homeAssists,
        steals: bs.homeSteals,
        blocks: bs.homeBlocks,
        turnovers: bs.homeTurnovers,
        fieldGoalPercentage: bs.homeFgPct,
        threePointPercentage: bs.home3pPct,
        freeThrowPercentage: bs.homeFtPct,
      },
      awayTeam: {
        teamId: game.awayTeamId,
        points: bs.awayPoints,
        rebounds: bs.awayRebounds,
        assists: bs.awayAssists,
        steals: bs.awaySteals,
        blocks: bs.awayBlocks,
        turnovers: bs.awayTurnovers,
        fieldGoalPercentage: bs.awayFgPct,
        threePointPercentage: bs.away3pPct,
        freeThrowPercentage: bs.awayFtPct,
      },
      homePlayers: [],
      awayPlayers: [],
    };
  }

  /**
   * Fetch historical box scores for a team
   */
  private async fetchTeamBoxScores(
    teamId: number,
    beforeDate: Date,
    limit: number = 20
  ): Promise<BoxScore[]> {
    const games = await prisma.game.findMany({
      where: {
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        gameDate: { lt: beforeDate },
        status: 'completed',
        boxScore: { isNot: null },
      },
      include: {
        boxScore: true,
      },
      orderBy: { gameDate: 'desc' },
      take: limit,
    });

    return games
      .map((game) => this.toIngestionBoxScore(game))
      .filter((boxScore): boxScore is BoxScore => boxScore !== null);
  }

  /**
   * Fetch head-to-head games
   */
  private async fetchH2HGames(
    teamId1: number,
    teamId2: number,
    limit: number = 5
  ): Promise<Game[]> {
    const games = await prisma.game.findMany({
      where: {
        OR: [
          { homeTeamId: teamId1, awayTeamId: teamId2 },
          { homeTeamId: teamId2, awayTeamId: teamId1 },
        ],
        status: 'completed',
      },
      orderBy: { gameDate: 'desc' },
      take: limit,
    });

    return games.map((game) => ({
      id: game.externalId,
      season: game.season,
      seasonType: this.normalizeSeasonType(game.seasonType),
      status: 'completed',
      date: game.gameDate.toISOString(),
      homeTeam: {
        id: game.homeTeamId,
        name: game.homeTeamName,
        city: '',
        abbreviation: game.homeTeamAbbreviation,
        conference: this.normalizeConference(game.homeTeamConference),
        division: '',
      },
      awayTeam: {
        id: game.awayTeamId,
        name: game.awayTeamName,
        city: '',
        abbreviation: game.awayTeamAbbreviation,
        conference: this.normalizeConference(game.awayTeamConference),
        division: '',
      },
      homeScore: game.homeScore ?? undefined,
      awayScore: game.awayScore ?? undefined,
      arena: game.arena ?? undefined,
      attendance: game.attendance ?? undefined,
    }));
  }

  /**
   * Check cache for existing prediction
   */
  private async checkCache(matchId: string): Promise<PredictionOutput | null> {
    const cached = await prisma.featureStore.findUnique({
      where: { matchId },
    });

    if (!cached) return null;

    const age = Date.now() - cached.computedAt.getTime();
    if (age > TIME.HOUR_MS) return null;

    // Parse features from cache
    const featureRecord = cached.features as unknown as FeatureRecord;
    
    // Make prediction using cached features
    if (!this.currentModel) {
      await this.loadActiveModel();
    }

    if (!this.currentModel) {
      return null;
    }

    const prediction = this.currentModel.model.predict(featureRecord.modelFeatures);

    return this.formatPredictionOutput(
      featureRecord,
      prediction,
      this.currentModel.version,
      this.currentModel.algorithm
    );
  }

  /**
   * Compute features for a game
   */
  private async computeFeatures(
    input: PredictionInput
  ): Promise<{ features: FeatureRecord; validation: FeatureValidationResult }> {
    // Fetch historical data
    const homeBoxScores = await this.fetchTeamBoxScores(
      input.homeTeamId,
      input.scheduledAt,
      20
    );

    const awayBoxScores = await this.fetchTeamBoxScores(
      input.awayTeamId,
      input.scheduledAt,
      20
    );

    const h2hGames = await this.fetchH2HGames(input.homeTeamId, input.awayTeamId, 5);

    // Create synthetic game object
    const syntheticGame: Game = {
      id: input.gameId,
      season: input.scheduledAt.getFullYear(),
      seasonType: 'Regular Season',
      status: 'scheduled',
      date: input.scheduledAt.toISOString(),
      homeTeam: {
        id: input.homeTeamId,
        name: input.homeTeamName,
        city: '',
        abbreviation: '',
        conference: 'East',
        division: '',
      },
      awayTeam: {
        id: input.awayTeamId,
        name: input.awayTeamName,
        city: '',
        abbreviation: '',
        conference: 'East',
        division: '',
      },
    };

    // Compute features
    const featureRecord = await this.featureService.computeMatchFeatures(
      syntheticGame,
      homeBoxScores,
      awayBoxScores,
      h2hGames
    );

    // Validate features
    const validation = this.featureService.validateFeatures(featureRecord);

    // Cache features
    await this.cacheFeatures(featureRecord);

    return { features: featureRecord, validation };
  }

  /**
   * Cache computed features
   */
  private async cacheFeatures(features: FeatureRecord): Promise<void> {
    await prisma.featureStore.upsert({
      where: { matchId: features.matchId },
      create: {
        id: `feat-${features.matchId}`,
        matchId: features.matchId,
        homeTeamId: features.homeTeamId,
        awayTeamId: features.awayTeamId,
        matchDate: features.matchDate,
        features: features as unknown as object,
        featuresHash: features.dataVersion,
        freshnessScore: features.freshnessScore,
        computedAt: features.computedAt,
        dataVersion: features.dataVersion,
      },
      update: {
        features: features as unknown as object,
        featuresHash: features.dataVersion,
        freshnessScore: features.freshnessScore,
        computedAt: features.computedAt,
        dataVersion: features.dataVersion,
      },
    });
  }

  /**
   * Format prediction output
   */
  private formatPredictionOutput(
    features: FeatureRecord,
    prediction: ModelPredictionResult,
    modelVersion: string,
    algorithm: string
  ): PredictionOutput {
    const { homeFeatures, awayFeatures, modelFeatures } = features;

    // Calculate predicted scores
    // Use team averages + adjustments
    const baseHomeScore = homeFeatures.pointsScoredAvg;
    const baseAwayScore = awayFeatures.pointsScoredAvg;
    
    // Adjust based on opponent defense
    const homeDefenseAdj = (awayFeatures.defensiveRating - 100) / 10; // Points above/below average
    const awayDefenseAdj = (homeFeatures.defensiveRating - 100) / 10;
    
    // Adjust based on prediction confidence
    const confidenceFactor = prediction.confidence * 5; // Up to 5 point swing
    
    const predictedHomeScore = Math.round(baseHomeScore - homeDefenseAdj + (prediction.predictedWinner === 'HOME' ? confidenceFactor : -confidenceFactor));
    const predictedAwayScore = Math.round(baseAwayScore - awayDefenseAdj + (prediction.predictedWinner === 'AWAY' ? confidenceFactor : -confidenceFactor));
    
    // Over/under prediction
    const totalPoints = predictedHomeScore + predictedAwayScore;
    const overUnderLine = Math.round(totalPoints / 2) * 2 + 0.5; // Standard line
    const overUnderPrediction = totalPoints > overUnderLine ? 'OVER' : 'UNDER';

    return {
      matchId: features.matchId,
      prediction: {
        winner: prediction.predictedWinner,
        confidence: prediction.confidence,
        homeWinProbability: prediction.homeWinProbability,
        awayWinProbability: prediction.awayWinProbability,
      },
      score: {
        predictedHomeScore,
        predictedAwayScore,
        totalPoints,
      },
      overUnder: {
        line: overUnderLine,
        prediction: overUnderPrediction,
        confidence: prediction.confidence,
      },
      model: {
        version: modelVersion,
        algorithm,
        featureCount: Object.keys(modelFeatures).length,
        featureQuality: features.freshnessScore,
      },
      features: {
        homeWinRate: homeFeatures.winRate,
        awayWinRate: awayFeatures.winRate,
        homeAdvantage: modelFeatures.homeAdvantage,
        h2hAdvantage: modelFeatures.h2hAdvantage,
        restAdvantage: modelFeatures.homeRestAdvantage,
      },
      traceId: `pred-${features.matchId}-${Date.now()}`,
    };
  }

  /**
   * Make a prediction for a game
   */
  async predict(
    input: PredictionInput,
    options: PredictionOptions = {}
  ): Promise<PredictionOutput> {
    const { useCache = true, minQualityScore = 0.5 } = options;
    
    const traceId = `pred-${input.gameId}-${Date.now()}`;

    try {
      // Step 1: Load model
      await this.loadActiveModel();

      if (!this.currentModel) {
        throw this.createError('MODEL_NOT_FOUND', 'No active model available');
      }

      // Step 2: Check cache
      if (useCache && !options.forceRefresh) {
        const cached = await this.checkCache(input.gameId.toString());
        if (cached) {
          logger.debug({ traceId }, 'Returning cached prediction');
          return cached;
        }
      }

      // Step 3: Compute features
      logger.debug({ traceId, homeTeam: input.homeTeamName, awayTeam: input.awayTeamName }, 'Computing features');
      const { features, validation } = await this.computeFeatures(input);

      if (!validation.valid) {
        throw this.createError(
          'FEATURES_INVALID',
          `Feature validation failed: ${validation.missingFeatures.join(', ')}`
        );
      }

      if (validation.qualityScore < minQualityScore) {
        throw this.createError(
          'INSUFFICIENT_DATA',
          `Feature quality ${validation.qualityScore.toFixed(2)} below threshold ${minQualityScore}`
        );
      }

      // Step 4: Make prediction
      logger.debug({ traceId, modelVersion: this.currentModel.version }, 'Making prediction');
      const prediction = this.currentModel.model.predict(features.modelFeatures);

      // Step 5: Format output
      const output = this.formatPredictionOutput(
        features,
        prediction,
        this.currentModel.version,
        this.currentModel.algorithm
      );

      return output;
    } catch (error) {
      if (this.isPredictionError(error)) {
        throw error;
      }
      
      throw this.createError(
        'PREDICTION_FAILED',
        error instanceof Error ? error.message : 'Unknown prediction error'
      );
    }
  }

  /**
   * Make predictions for multiple games
   */
  async predictBatch(
    inputs: PredictionInput[],
    options: PredictionOptions = {}
  ): Promise<{ predictions: PredictionOutput[]; errors: { input: PredictionInput; error: PredictionError }[] }> {
    const predictions: PredictionOutput[] = [];
    const errors: { input: PredictionInput; error: PredictionError }[] = [];

    for (const input of inputs) {
      try {
        const prediction = await this.predict(input, options);
        predictions.push(prediction);
      } catch (error) {
        const predError = this.isPredictionError(error) 
          ? error 
          : this.createError('PREDICTION_FAILED', String(error));
        errors.push({ input, error: predError });
      }
    }

    return { predictions, errors };
  }

  /**
   * Create prediction error
   */
  private createError(code: PredictionError['code'], message: string): PredictionError {
    return { code, message };
  }

  /**
   * Check if error is a prediction error
   */
  private isPredictionError(error: unknown): error is PredictionError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as PredictionError).code === 'string'
    );
  }

  /**
   * Get model info
   */
  async getModelInfo(): Promise<{ version: string; algorithm: string; loadedAt: Date | null } | null> {
    if (!this.currentModel) {
      return null;
    }

    return {
      version: this.currentModel.version,
      algorithm: this.currentModel.algorithm,
      loadedAt: this.modelLoadedAt,
    };
  }

  /**
   * Get feature importance from current model
   */
  async getFeatureImportance(): Promise<Record<string, number> | null> {
    if (!this.currentModel) {
      await this.loadActiveModel();
    }

    if (!this.currentModel) {
      return null;
    }

    return this.currentModel.model.getFeatureImportance();
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let predictionServiceInstance: PredictionService | null = null;

export function getPredictionService(): PredictionService {
  if (!predictionServiceInstance) {
    predictionServiceInstance = new PredictionService();
  }
  return predictionServiceInstance;
}

export function createPredictionService(): PredictionService {
  return new PredictionService();
}
