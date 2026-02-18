/**
 * ML Training Service
 * 
 * Manages model training lifecycle:
 * - Fetches historical data
 * - Prepares training datasets
 * - Trains models
 * - Evaluates performance
 * - Persists model artifacts
 * - Tracks model versions
 */

import { prisma } from '@/server/db/client';
import type { Prisma } from '@prisma/client';
import { FeatureEngineeringService } from '@/server/ml/features/feature-engineering';
import { ModelFeatures } from '@/server/ml/features/types';
import {
  LogisticRegressionModel,
  TrainingExample,
  TrainingResult,
} from '@/server/ml/models/logistic-regression';
import { XGBoostModel } from '@/server/ml/models/xgboost-model';
import { BoxScore } from '@/server/ingestion/schema/nba-schemas';

// =============================================================================
// TYPES
// =============================================================================

export interface TrainingConfig {
  // Data split
  trainTestSplit: number; // 0.8 = 80% train, 20% test
  minTrainingSamples: number; // Minimum games needed
  shuffleSeed: number;
  
  // Training params
  learningRate: number;
  maxIterations: number;
  regularizationLambda: number;
  
  // Performance thresholds
  minAccuracy: number;
  minPrecision: number;
  minRecall: number;
}

export interface ModelVersion {
  id: string;
  version: string;
  algorithm: 'logistic-regression' | 'xgboost';
  createdAt: Date;
  trainingDataStart: Date;
  trainingDataEnd: Date;
  numTrainingSamples: number;
  numTestSamples: number;
  metrics: ModelMetrics;
  weightsHash: string;
  isActive: boolean;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  logLoss: number;
  auc: number; // Area under ROC curve
  calibrationError: number; // ECE - Expected Calibration Error
}

export interface TrainingJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  config: TrainingConfig;
  progress: {
    currentStep: string;
    current: number;
    total: number;
  };
  result?: {
    modelVersion: ModelVersion;
    trainingResult: TrainingResult;
  };
  error?: string;
}

export interface HistoricalGameResult {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName?: string;
  awayTeamName?: string;
  seasonType?: string;
  matchDate: Date;
  homeScore: number;
  awayScore: number;
  homeWon: boolean;
  boxScore: BoxScore;
}

// Team features calculated from box scores
interface CalculatedTeamFeatures {
  games: number;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
  winRate: number;
  offensiveRating: number;
  defensiveRating: number;
  form: number;
  restDays: number;
}

// H2H stats
interface H2HStats {
  games: number;
  homeWins: number;
  avgPointDiff: number;
}

interface HistoricalGameRow {
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  gameDate: Date;
}

export interface BinaryPrediction {
  prob: number;
  actual: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

/**
 * Calculate AUC-ROC using rank statistics (Mann-Whitney U).
 * Returns value in [0, 1].
 */
export function calculateAUC(predictions: BinaryPrediction[]): number {
  if (predictions.length === 0) return 0.5;

  const rows = predictions
    .filter((p) => (p.actual === 0 || p.actual === 1) && Number.isFinite(p.prob))
    .map((p) => ({ prob: clamp01(p.prob), actual: p.actual }));

  const positives = rows.filter((p) => p.actual === 1).length;
  const negatives = rows.filter((p) => p.actual === 0).length;
  if (positives === 0 || negatives === 0) return 0.5;

  const sorted = [...rows].sort((a, b) => a.prob - b.prob);
  let rank = 1;
  let sumPositiveRanks = 0;

  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].prob === sorted[i].prob) {
      j++;
    }

    const avgRank = (rank + (rank + (j - i))) / 2;
    for (let k = i; k <= j; k++) {
      if (sorted[k].actual === 1) {
        sumPositiveRanks += avgRank;
      }
    }

    rank += j - i + 1;
    i = j + 1;
  }

  const auc = (sumPositiveRanks - (positives * (positives + 1)) / 2) / (positives * negatives);
  return clamp01(auc);
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  trainTestSplit: 0.8,
  minTrainingSamples: 100,
  shuffleSeed: 42,
  learningRate: 0.01,
  maxIterations: 5000,
  regularizationLambda: 0.01,
  minAccuracy: 0.55, // Better than coin flip
  minPrecision: 0.55,
  minRecall: 0.55,
};

// =============================================================================
// TRAINING SERVICE
// =============================================================================

export class TrainingService {
  private featureService: FeatureEngineeringService;
  private config: TrainingConfig;
  private currentJob: TrainingJob | null = null;

  constructor(
    featureService: FeatureEngineeringService,
    config: Partial<TrainingConfig> = {}
  ) {
    this.featureService = featureService;
    this.config = { ...DEFAULT_TRAINING_CONFIG, ...config };
  }

  /**
   * Fetch historical game results from database
   */
  private async fetchHistoricalGames(
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalGameResult[]> {
    // Query completed games from database
    const dbGames = await prisma.game.findMany({
      where: {
        gameDate: {
          gte: startDate,
          lte: endDate,
        },
        // Only games that have scores (completed)
        homeScore: { not: null },
        awayScore: { not: null },
      },
      include: {
        boxScore: true,
      },
    });

    const games: HistoricalGameResult[] = [];

    // For each game, create historical result
    for (const game of dbGames) {
      const homeWon = game.homeScore > game.awayScore;
      
      if (!game.boxScore) {
        continue;
      }

      const boxScore: BoxScore = {
        gameId: game.externalId,
        homeTeam: {
          teamId: game.homeTeamId,
          points: game.homeScore,
          rebounds: game.boxScore.homeRebounds,
          assists: game.boxScore.homeAssists,
          steals: game.boxScore.homeSteals,
          blocks: game.boxScore.homeBlocks,
          turnovers: game.boxScore.homeTurnovers,
          fieldGoalPercentage: game.boxScore.homeFgPct,
          threePointPercentage: game.boxScore.home3pPct,
          freeThrowPercentage: game.boxScore.homeFtPct,
        },
        awayTeam: {
          teamId: game.awayTeamId,
          points: game.awayScore,
          rebounds: game.boxScore.awayRebounds,
          assists: game.boxScore.awayAssists,
          steals: game.boxScore.awaySteals,
          blocks: game.boxScore.awayBlocks,
          turnovers: game.boxScore.awayTurnovers,
          fieldGoalPercentage: game.boxScore.awayFgPct,
          threePointPercentage: game.boxScore.away3pPct,
          freeThrowPercentage: game.boxScore.awayFtPct,
        },
        homePlayers: [],
        awayPlayers: [],
      };

      games.push({
        gameId: game.externalId,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        seasonType: game.seasonType,
        matchDate: game.gameDate,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        homeWon,
        boxScore,
      });
    }

    console.log(`Fetched ${games.length} historical games from database`);
    return games;
  }

  /**
   * Prepare training examples from historical games
   */
  private async prepareTrainingData(
    games: HistoricalGameResult[]
  ): Promise<TrainingExample[]> {
    const examples: TrainingExample[] = [];

    for (const game of games) {
      try {
        // Fetch historical box scores for both teams from database
        // Get recent games and box scores for both teams
        const homeTeamGames = await prisma.game.findMany({
          where: {
            OR: [
              { homeTeamId: game.homeTeamId },
              { awayTeamId: game.homeTeamId },
            ],
            gameDate: { lt: game.matchDate },
            homeScore: { not: null },
            awayScore: { not: null },
          },
          orderBy: { gameDate: 'desc' },
          take: 10,
          include: { boxScore: true },
        });

        const awayTeamGames = await prisma.game.findMany({
          where: {
            OR: [
              { homeTeamId: game.awayTeamId },
              { awayTeamId: game.awayTeamId },
            ],
            gameDate: { lt: game.matchDate },
            homeScore: { not: null },
            awayScore: { not: null },
          },
          orderBy: { gameDate: 'desc' },
          take: 10,
          include: { boxScore: true },
        });
        
        // Calculate real features from games
        const homeFeatures = this.calculateTeamFeaturesFromGames(homeTeamGames, game.homeTeamId);
        const awayFeatures = this.calculateTeamFeaturesFromGames(awayTeamGames, game.awayTeamId);
        
        // Get head-to-head games
        const h2hGames = await prisma.game.findMany({
          where: {
            OR: [
              { homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId },
              { homeTeamId: game.awayTeamId, awayTeamId: game.homeTeamId },
            ],
            gameDate: { lt: game.matchDate },
            homeScore: { not: null },
            awayScore: { not: null },
          },
          orderBy: { gameDate: 'desc' },
          take: 5,
        });
        
        const h2hStats = this.calculateH2HStats(h2hGames, game.homeTeamId);

        // Create real model features with normalization
        // Normalize ratings from ~110 to 0-1 scale
        const normalizeRating = (rating: number) => (rating - 100) / 40; // 80-120 -> -0.5 to 0.5
        const normalizeRest = (days: number) => days / 5; // 0-5 -> 0-1
        
        const modelFeatures: ModelFeatures = {
          homeWinRate: homeFeatures.winRate,
          homeOffensiveRating: normalizeRating(homeFeatures.offensiveRating),
          homeDefensiveRating: normalizeRating(homeFeatures.defensiveRating),
          homeForm: homeFeatures.form,
          homeRestAdvantage: normalizeRest(homeFeatures.restDays),
          awayWinRate: awayFeatures.winRate,
          awayOffensiveRating: normalizeRating(awayFeatures.offensiveRating),
          awayDefensiveRating: normalizeRating(awayFeatures.defensiveRating),
          awayForm: awayFeatures.form,
          homeAdvantage: homeFeatures.winRate - awayFeatures.winRate,
          h2hAdvantage: h2hStats.games > 0 ? (h2hStats.homeWins / h2hStats.games - 0.5) * 2 : 0, // -1 to 1
          matchupStrength: (homeFeatures.winRate + awayFeatures.winRate) / 2,
          isBackToBack: homeFeatures.restDays === 0 || awayFeatures.restDays === 0 ? 1 : 0,
          daysRestDiff: (homeFeatures.restDays - awayFeatures.restDays) / 5, // -1 to 1
          isPlayoff: game.seasonType === 'Playoffs' ? 1 : 0,
        };

        // Create training example
        examples.push({
          features: modelFeatures,
          label: game.homeWon ? 1 : 0,
        });
      } catch (error) {
        console.error(`Error processing game ${game.gameId}:`, error);
      }
    }

     // Debug: Log feature statistics
    if (examples.length > 0) {
      const avgHomeWinRate = examples.reduce((sum, ex) => sum + ex.features.homeWinRate, 0) / examples.length;
      const avgAwayWinRate = examples.reduce((sum, ex) => sum + ex.features.awayWinRate, 0) / examples.length;
      const homeWins = examples.filter(ex => ex.label === 1).length;
      console.log(`  Created ${examples.length} training examples`);
      console.log(`    Home wins: ${homeWins} (${(homeWins/examples.length*100).toFixed(1)}%)`);
      console.log(`    Avg homeWinRate: ${avgHomeWinRate.toFixed(3)}`);
      console.log(`    Avg awayWinRate: ${avgAwayWinRate.toFixed(3)}`);
    }
    
    return examples;
  }

  /**
   * Split data into train/test sets
   */
  private splitData(examples: TrainingExample[]): { train: TrainingExample[]; test: TrainingExample[] } {
    // Deterministic Fisher-Yates shuffle for reproducible train/test splits.
    const shuffled = [...examples];
    const nextRandom = this.createSeededRng(this.config.shuffleSeed);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(nextRandom() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const splitIndex = Math.floor(shuffled.length * this.config.trainTestSplit);
    
    return {
      train: shuffled.slice(0, splitIndex),
      test: shuffled.slice(splitIndex),
    };
  }

  /**
   * Evaluate model on test set
   */
  private evaluateModel(
    model: LogisticRegressionModel,
    testExamples: TrainingExample[]
  ): ModelMetrics {
    let truePositives = 0;
    let trueNegatives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let logLoss = 0;
    const predictions: { prob: number; actual: number }[] = [];

    for (const example of testExamples) {
      const result = model.predict(example.features);
      const predicted = result.homeWinProbability >= 0.5 ? 1 : 0;
      const actual = example.label;

      // Classification metrics
      if (predicted === 1 && actual === 1) truePositives++;
      else if (predicted === 0 && actual === 0) trueNegatives++;
      else if (predicted === 1 && actual === 0) falsePositives++;
      else if (predicted === 0 && actual === 1) falseNegatives++;

      // Log loss
      const epsilon = 1e-15;
      const prob = result.homeWinProbability;
      logLoss -= actual * Math.log(prob + epsilon) + (1 - actual) * Math.log(1 - prob + epsilon);

      // Store for AUC calculation
      predictions.push({ prob, actual });
    }

    const total = testExamples.length;
    const accuracy = (truePositives + trueNegatives) / total;
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    
    // Debug: Show prediction distribution
    const homePredictions = predictions.filter(p => p.prob >= 0.5).length;
    const awayPredictions = predictions.filter(p => p.prob < 0.5).length;
    const avgProb = predictions.reduce((sum, p) => sum + p.prob, 0) / predictions.length;
    console.log(`    Model evaluation:`);
    console.log(`      Total predictions: ${total}`);
    console.log(`      Home predictions: ${homePredictions} (${(homePredictions/total*100).toFixed(1)}%)`);
    console.log(`      Away predictions: ${awayPredictions} (${(awayPredictions/total*100).toFixed(1)}%)`);
    console.log(`      Avg probability: ${avgProb.toFixed(3)}`);
    console.log(`      Accuracy: ${(accuracy*100).toFixed(1)}%`);
    console.log(`      True Positives: ${truePositives}, True Negatives: ${trueNegatives}`);
    console.log(`      False Positives: ${falsePositives}, False Negatives: ${falseNegatives}`);

    const auc = calculateAUC(predictions);

    // Calculate calibration error (ECE)
    const calibrationError = this.calculateCalibrationError(predictions);

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      logLoss: logLoss / total,
      auc,
      calibrationError,
    };
  }

  private createSeededRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  /**
   * Calculate Expected Calibration Error
   */
  private calculateCalibrationError(predictions: { prob: number; actual: number }[]): number {
    const numBins = 10;
    const bins = new Array(numBins).fill(0).map(() => ({ count: 0, sumProb: 0, sumActual: 0 }));

    for (const pred of predictions) {
      const binIndex = Math.min(Math.floor(pred.prob * numBins), numBins - 1);
      bins[binIndex].count++;
      bins[binIndex].sumProb += pred.prob;
      bins[binIndex].sumActual += pred.actual;
    }

    let ece = 0;
    const total = predictions.length;

    for (const bin of bins) {
      if (bin.count > 0) {
        const avgProb = bin.sumProb / bin.count;
        const avgActual = bin.sumActual / bin.count;
        ece += (bin.count / total) * Math.abs(avgProb - avgActual);
      }
    }

    return ece;
  }

  /**
   * Start training job
   */
  async startTraining(startDate: Date, endDate: Date): Promise<TrainingJob> {
    const job: TrainingJob = {
      id: `train-${Date.now()}`,
      status: 'running',
      startedAt: new Date(),
      config: this.config,
      progress: {
        currentStep: 'Fetching historical data',
        current: 0,
        total: 4,
      },
    };

    this.currentJob = job;

    try {
      // Step 1: Fetch historical games
      job.progress.currentStep = 'Fetching historical data';
      job.progress.current = 1;
      const games = await this.fetchHistoricalGames(startDate, endDate);

      if (games.length < this.config.minTrainingSamples) {
        throw new Error(`Insufficient training data: ${games.length} games, need ${this.config.minTrainingSamples}`);
      }

      // Step 2: Prepare training data
      job.progress.currentStep = 'Preparing training data';
      job.progress.current = 2;
      const examples = await this.prepareTrainingData(games);

      if (examples.length < this.config.minTrainingSamples) {
        throw new Error(`Insufficient valid training examples: ${examples.length}`);
      }

      // Step 3: Split and train
      job.progress.currentStep = 'Training model';
      job.progress.current = 3;
      const { train, test } = this.splitData(examples);

      const model = new LogisticRegressionModel({
        learningRate: this.config.learningRate,
        maxIterations: this.config.maxIterations,
        regularizationLambda: this.config.regularizationLambda,
      });

      const trainingResult = model.train(train);

      // Step 4: Evaluate
      job.progress.currentStep = 'Evaluating model';
      job.progress.current = 4;
      const metrics = this.evaluateModel(model, test);

      // Validate metrics meet thresholds
      if (metrics.accuracy < this.config.minAccuracy) {
        throw new Error(`Model accuracy ${metrics.accuracy.toFixed(3)} below threshold ${this.config.minAccuracy}`);
      }

      // Create model version with unique timestamp
      const now = new Date();
      const modelVersion: ModelVersion = {
        id: `model-${Date.now()}`,
        version: `v${now.toISOString().split('T')[0].replace(/-/g, '')}-${Date.now().toString().slice(-6)}`,
        algorithm: 'logistic-regression',
        createdAt: new Date(),
        trainingDataStart: startDate,
        trainingDataEnd: endDate,
        numTrainingSamples: train.length,
        numTestSamples: test.length,
        metrics,
        weightsHash: this.hashWeights(trainingResult.weights),
        isActive: false, // Needs manual activation
      };

      // Save model to database
      await this.saveModel(modelVersion, model);

      // Update job
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = {
        modelVersion,
        trainingResult,
      };

      return job;
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Save model to database
   */
  private async saveModel(version: ModelVersion, model: LogisticRegressionModel): Promise<void> {
    const weights = model.getWeights();
    if (!weights) throw new Error('Model weights not available');

    // Store in database
    await prisma.mLModel.create({
      data: {
        id: version.id,
        version: version.version,
        algorithm: version.algorithm,
        createdAt: version.createdAt,
        trainingDataStart: version.trainingDataStart,
        trainingDataEnd: version.trainingDataEnd,
        numTrainingSamples: version.numTrainingSamples,
        numTestSamples: version.numTestSamples,
        accuracy: version.metrics.accuracy,
        precision: version.metrics.precision,
        recall: version.metrics.recall,
        f1Score: version.metrics.f1Score,
        logLoss: version.metrics.logLoss,
        auc: version.metrics.auc,
        calibrationError: version.metrics.calibrationError,
        weightsHash: version.weightsHash,
        weights: weights as unknown as Prisma.JsonObject,
        isActive: version.isActive,
      },
    });
  }

  /**
   * Hash weights for integrity check
   */
  private hashWeights(weights: { bias: number; weights: number[] }): string {
    const data = `${weights.bias}:${weights.weights.join(',')}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Load active model
   */
  async loadActiveModel(): Promise<{ version: ModelVersion; model: LogisticRegressionModel } | null> {
    const dbModel = await prisma.mLModel.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!dbModel) return null;

    // Reconstruct model
    if (dbModel.algorithm !== 'logistic-regression') {
      return null;
    }

    const model = new LogisticRegressionModel();
    const rawWeights = dbModel.weights as unknown;
    const weights = typeof rawWeights === 'string' ? JSON.parse(rawWeights) : rawWeights;
    model.setWeights(weights);

    const version: ModelVersion = {
      id: dbModel.id,
      version: dbModel.version,
      algorithm: dbModel.algorithm as 'logistic-regression' | 'xgboost',
      createdAt: dbModel.createdAt,
      trainingDataStart: dbModel.trainingDataStart,
      trainingDataEnd: dbModel.trainingDataEnd,
      numTrainingSamples: dbModel.numTrainingSamples,
      numTestSamples: dbModel.numTestSamples,
      metrics: {
        accuracy: dbModel.accuracy,
        precision: dbModel.precision,
        recall: dbModel.recall,
        f1Score: dbModel.f1Score,
        logLoss: dbModel.logLoss,
        auc: dbModel.auc,
        calibrationError: dbModel.calibrationError,
      },
      weightsHash: dbModel.weightsHash,
      isActive: dbModel.isActive,
    };

    return { version, model };
  }

  /**
   * Load active model for any supported algorithm
   */
  async loadActiveModelGeneric(): Promise<{
    version: ModelVersion;
    model: LogisticRegressionModel | XGBoostModel;
  } | null> {
    const dbModel = await prisma.mLModel.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!dbModel) return null;

    const rawWeights = dbModel.weights as unknown;
    const weights = typeof rawWeights === 'string' ? JSON.parse(rawWeights) : rawWeights;

    let model: LogisticRegressionModel | XGBoostModel;
    if (dbModel.algorithm === 'xgboost') {
      const xgb = new XGBoostModel();
      xgb.setState(weights);
      model = xgb;
    } else {
      const lr = new LogisticRegressionModel();
      lr.setWeights(weights);
      model = lr;
    }

    const version: ModelVersion = {
      id: dbModel.id,
      version: dbModel.version,
      algorithm: dbModel.algorithm as 'logistic-regression' | 'xgboost',
      createdAt: dbModel.createdAt,
      trainingDataStart: dbModel.trainingDataStart,
      trainingDataEnd: dbModel.trainingDataEnd,
      numTrainingSamples: dbModel.numTrainingSamples,
      numTestSamples: dbModel.numTestSamples,
      metrics: {
        accuracy: dbModel.accuracy,
        precision: dbModel.precision,
        recall: dbModel.recall,
        f1Score: dbModel.f1Score,
        logLoss: dbModel.logLoss,
        auc: dbModel.auc,
        calibrationError: dbModel.calibrationError,
      },
      weightsHash: dbModel.weightsHash,
      isActive: dbModel.isActive,
    };

    return { version, model };
  }

  /**
   * Activate a model version
   */
  async activateModel(modelId: string): Promise<void> {
    // Deactivate current
    await prisma.mLModel.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Activate new
    await prisma.mLModel.update({
      where: { id: modelId },
      data: { isActive: true, activatedAt: new Date() },
    });
  }

  /**
   * Calculate team features from games with box scores
   */
  private calculateTeamFeaturesFromGames(
    games: HistoricalGameRow[],
    teamId: number
  ): CalculatedTeamFeatures {
    if (games.length === 0) {
      return {
        games: 0,
        wins: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        winRate: 0.5,
        offensiveRating: 0,
        defensiveRating: 0,
        form: 0.5,
        restDays: 0,
      };
    }

    let wins = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;
    let last5Wins = 0;
    
    // Get last 5 games for form calculation
    const recentGames = games.slice(0, 5);
    
    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      const isHomeTeam = g.homeTeamId === teamId;
      const teamPoints = isHomeTeam ? g.homeScore : g.awayScore;
      const oppPoints = isHomeTeam ? g.awayScore : g.homeScore;
      
      pointsFor += teamPoints;
      pointsAgainst += oppPoints;
      
      if (teamPoints > oppPoints) {
        wins++;
        if (i < 5) last5Wins++;
      }
    }
    
    const totalGames = games.length;
    const winRate = totalGames > 0 ? wins / totalGames : 0.5;
    const form = recentGames.length > 0 ? last5Wins / recentGames.length : 0.5;

    let restDays = 0;
    if (games.length > 1) {
      const latest = new Date(games[0].gameDate).getTime();
      const previous = new Date(games[1].gameDate).getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      restDays = Math.max(0, Math.floor((latest - previous) / dayMs));
    }
    
    // Calculate ratings (simplified)
    const avgPointsFor = totalGames > 0 ? pointsFor / totalGames : 100;
    const avgPointsAgainst = totalGames > 0 ? pointsAgainst / totalGames : 100;
    const offensiveRating = 100 + (avgPointsFor - 100) * 0.5;
    const defensiveRating = 100 - (avgPointsAgainst - 100) * 0.5;
    
    return {
      games: totalGames,
      wins,
      pointsFor,
      pointsAgainst,
      winRate,
      offensiveRating,
      defensiveRating,
      form,
      restDays,
    };
  }

  /**
   * Calculate H2H stats
   */
  private calculateH2HStats(games: HistoricalGameRow[], homeTeamId: number): H2HStats {
    if (games.length === 0) {
      return {
        games: 0,
        homeWins: 0,
        avgPointDiff: 0,
      };
    }

    let homeWins = 0;
    let totalPointDiff = 0;

    for (const game of games) {
      const isHome = game.homeTeamId === homeTeamId;
      const homeScore = isHome ? game.homeScore : game.awayScore;
      const awayScore = isHome ? game.awayScore : game.homeScore;
      
      if (homeScore > awayScore) {
        homeWins++;
      }
      
      totalPointDiff += (homeScore - awayScore);
    }

    return {
      games: games.length,
      homeWins,
      avgPointDiff: games.length > 0 ? totalPointDiff / games.length : 0,
    };
  }

  /**
   * Get training job status
   */
  getJobStatus(): TrainingJob | null {
    return this.currentJob;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createTrainingService(
  featureService: FeatureEngineeringService,
  config?: Partial<TrainingConfig>
): TrainingService {
  return new TrainingService(featureService, config);
}
