/**
 * Hybrid Prediction System (A + B)
 * 
 * Combines Python V3 and TypeScript LogisticRegression
 * - Uses TypeScript for speed (90% of predictions)
 * - Uses Python V3 for high-confidence/edge cases (10%)
 * 
 * Usage: npx tsx scripts/hybrid-prediction-system.ts
 */

import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { LogisticRegressionModel } from '../src/server/ml/models/logistic-regression';
import { ModelFeatures } from '../src/server/ml/features/types';

const prisma = new PrismaClient();

interface HybridConfig {
  pythonThreshold: number; // Confidence threshold to use Python
  pythonMinConfidence: number; // Minimum confidence for Python predictions
  fallbackToTypescript: boolean; // Fallback if Python fails
  pythonBaseUrl: string;
}

interface PredictionResult {
  predictedWinner: 'HOME' | 'AWAY';
  homeWinProbability: number;
  confidence: number;
  modelUsed: 'TypeScript' | 'Python' | 'Fallback';
  latency: number;
  pythonConfidence?: number;
  tsConfidence?: number;
}

const DEFAULT_CONFIG: HybridConfig = {
  pythonThreshold: 0.75, // Use Python if TS confidence > 75%
  pythonMinConfidence: 0.60, // Only use Python if it has >60% confidence
  fallbackToTypescript: true,
  pythonBaseUrl: 'http://localhost:8000'
};

class HybridPredictionSystem {
  private config: HybridConfig;
  private tsModel: LogisticRegressionModel | null = null;
  private pythonAvailable: boolean = false;

  constructor(config: Partial<HybridConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    console.log('Initializing Hybrid Prediction System...');
    
    // Load TypeScript model
    const activeModel = await prisma.mLModel.findFirst({
      where: { isActive: true, algorithm: 'logistic-regression' },
      orderBy: { createdAt: 'desc' }
    });

    const fallbackModel = activeModel ?? await prisma.mLModel.findFirst({
      where: { algorithm: 'logistic-regression' },
      orderBy: { createdAt: 'desc' }
    });

    if (fallbackModel?.weights) {
      this.tsModel = new LogisticRegressionModel();
      
      // Get weights - Prisma returns JSON as object, not string
      let weights = fallbackModel.weights as any;
      
      // If somehow it's still a string (edge case), parse it
      if (typeof weights === 'string') {
        try {
          weights = JSON.parse(weights);
        } catch (e) {
          console.error('❌ Failed to parse weights JSON:', e.message);
          this.tsModel = null;
        }
      }
      
      // Validate weights structure
      if (!weights || !weights.weights || !Array.isArray(weights.weights)) {
        console.error('❌ Invalid weights structure in database');
        console.log('   Weights type:', typeof weights);
        console.log('   Weights keys:', weights ? Object.keys(weights) : 'null');
        this.tsModel = null;
      } else {
        // Use setWeights method (proper way to load model)
        this.tsModel.setWeights(weights);
        console.log('✅ TypeScript model loaded');
      }
    } else {
      console.log('⚠️  No active TypeScript model found');
    }

    // Check Python service
    try {
      const response = await fetch(`${this.config.pythonBaseUrl}/health`, {
        signal: AbortSignal.timeout(2000)
      });
      this.pythonAvailable = response.ok;
      console.log(this.pythonAvailable ? '✅ Python service available' : '⚠️  Python service unavailable');
    } catch {
      console.log('⚠️  Python service not running (fallback to TypeScript only)');
      this.pythonAvailable = false;
    }

    console.log();
  }

  async predict(features: ModelFeatures, pythonV3Features?: any): Promise<PredictionResult> {
    const start = Date.now();

    // Step 1: Get TypeScript prediction (fast)
    if (!this.tsModel) {
      throw new Error('TypeScript model not loaded');
    }

    const tsResult = this.tsModel.predict(features);
    const tsConfidence = tsResult.confidence;

    // Step 2: Decide if we need Python
    const shouldUsePython = this.pythonAvailable && 
                           tsConfidence >= this.config.pythonThreshold && 
                           pythonV3Features;

    if (!shouldUsePython) {
      // Use TypeScript only
      return {
        predictedWinner: tsResult.predictedWinner,
        homeWinProbability: tsResult.homeWinProbability,
        confidence: tsConfidence,
        modelUsed: 'TypeScript',
        latency: Date.now() - start,
        tsConfidence
      };
    }

    // Step 3: Get Python prediction for high-confidence cases
    try {
      const pythonResult = await this.callPythonService(pythonV3Features);
      const latency = Date.now() - start;

      // Check if Python prediction is good enough
      if (pythonResult.confidence >= this.config.pythonMinConfidence) {
        return {
          predictedWinner: pythonResult.predictedWinner,
          homeWinProbability: pythonResult.probability,
          confidence: pythonResult.confidence,
          modelUsed: 'Python',
          latency,
          pythonConfidence: pythonResult.confidence,
          tsConfidence
        };
      }

      // Python confidence too low, use TypeScript
      return {
        predictedWinner: tsResult.predictedWinner,
        homeWinProbability: tsResult.homeWinProbability,
        confidence: tsConfidence,
        modelUsed: 'Fallback',
        latency,
        pythonConfidence: pythonResult.confidence,
        tsConfidence
      };

    } catch (error) {
      // Python failed, fallback to TypeScript
      if (this.config.fallbackToTypescript) {
        return {
          predictedWinner: tsResult.predictedWinner,
          homeWinProbability: tsResult.homeWinProbability,
          confidence: tsConfidence,
          modelUsed: 'Fallback',
          latency: Date.now() - start,
          tsConfidence
        };
      }
      throw error;
    }
  }

  private async callPythonService(features: any): Promise<{ predictedWinner: 'HOME' | 'AWAY', probability: number, confidence: number }> {
    try {
      const response = await fetch(`${this.config.pythonBaseUrl}/predict/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_type: '2025',
          features
        })
      });

      if (!response.ok) {
        throw new Error(`Python service error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || typeof data.prediction === 'undefined') {
        throw new Error('Invalid response from Python service');
      }
      
      return {
        predictedWinner: data.prediction === 1 ? 'HOME' : 'AWAY',
        probability: data.home_win_probability ?? 0.5,
        confidence: data.confidence ?? 0.5
      };
    } catch (error) {
      console.error('Python service call failed:', error);
      throw error;
    }
  }

  async batchPredict(games: Array<{ features: ModelFeatures, pythonFeatures?: any }>): Promise<PredictionResult[]> {
    const results: PredictionResult[] = [];
    let tsCount = 0;
    let pythonCount = 0;
    let fallbackCount = 0;

    console.log(`Processing ${games.length} predictions with hybrid system...`);
    
    for (let i = 0; i < games.length; i++) {
      const result = await this.predict(games[i].features, games[i].pythonFeatures);
      results.push(result);

      // Count model usage
      if (result.modelUsed === 'TypeScript') tsCount++;
      else if (result.modelUsed === 'Python') pythonCount++;
      else fallbackCount++;

      if ((i + 1) % 10 === 0) {
        console.log(`  ${i + 1}/${games.length} processed...`);
      }
    }

    console.log();
    console.log('Hybrid System Statistics:');
    console.log(`  TypeScript only: ${tsCount} (${(tsCount / games.length * 100).toFixed(1)}%)`);
    console.log(`  Python enhanced: ${pythonCount} (${(pythonCount / games.length * 100).toFixed(1)}%)`);
    console.log(`  Fallback:        ${fallbackCount} (${(fallbackCount / games.length * 100).toFixed(1)}%)`);
    console.log();

    return results;
  }
}

// Demo function
async function runDemo() {
  console.log('='.repeat(70));
  console.log('HYBRID PREDICTION SYSTEM (A + B)');
  console.log('='.repeat(70));
  console.log();

  const hybrid = new HybridPredictionSystem({
    pythonThreshold: 0.70,
    pythonMinConfidence: 0.60,
    fallbackToTypescript: true
  });

  await hybrid.initialize();

  // Sample games
  const testGames = [
    {
      features: {
        homeWinRate: 0.72,
        homeOffensiveRating: 116,
        homeDefensiveRating: 110,
        homeForm: 0.7,
        homeRestAdvantage: 0,
        awayWinRate: 0.45,
        awayOffensiveRating: 108,
        awayDefensiveRating: 114,
        awayForm: 0.4,
        homeAdvantage: 1,
        h2hAdvantage: 0.1,
        matchupStrength: 0.65,
        isBackToBack: 0,
        daysRestDiff: 0,
        isPlayoff: 0
      } as ModelFeatures,
      pythonFeatures: {
        elo_diff: 245,
        elo_diff_norm: 0.806,
        home_last10_wins: 0.7,
        away_last10_wins: 0.4,
        spread_num: -6.5,
        over_under: 228.5,
        ml_home_prob: 0.72,
        ml_away_prob: 0.28,
        rest_days_home: 2,
        rest_days_away: 2,
        season_norm: 0.87
      }
    },
    {
      features: {
        homeWinRate: 0.50,
        homeOffensiveRating: 110,
        homeDefensiveRating: 110,
        homeForm: 0.5,
        homeRestAdvantage: 0,
        awayWinRate: 0.50,
        awayOffensiveRating: 110,
        awayDefensiveRating: 110,
        awayForm: 0.5,
        homeAdvantage: 1,
        h2hAdvantage: 0,
        matchupStrength: 0.5,
        isBackToBack: 0,
        daysRestDiff: 0,
        isPlayoff: 0
      } as ModelFeatures,
      pythonFeatures: {
        elo_diff: 10,
        elo_diff_norm: 0.512,
        home_last10_wins: 0.5,
        away_last10_wins: 0.5,
        spread_num: -2,
        over_under: 220,
        ml_home_prob: 0.55,
        ml_away_prob: 0.45,
        rest_days_home: 2,
        rest_days_away: 2,
        season_norm: 0.87
      }
    }
  ];

  console.log('Testing hybrid predictions...');
  console.log();

  for (let i = 0; i < testGames.length; i++) {
    const game = testGames[i];
    console.log(`Game ${i + 1}:`);
    
    try {
      const result = await hybrid.predict(game.features, game.pythonFeatures);
      
      console.log(`  Model used: ${result.modelUsed}`);
      console.log(`  Prediction: ${result.predictedWinner}`);
      console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`  Probability: ${(result.homeWinProbability * 100).toFixed(1)}%`);
      console.log(`  Latency: ${result.latency}ms`);
      
      if (result.tsConfidence) {
        console.log(`  TS Confidence: ${(result.tsConfidence * 100).toFixed(1)}%`);
      }
      if (result.pythonConfidence) {
        console.log(`  Python Confidence: ${(result.pythonConfidence * 100).toFixed(1)}%`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
    
    console.log();
  }

  console.log('='.repeat(70));
  console.log('Hybrid System Benefits:');
  console.log('  ✅ Fast TypeScript for 70-90% of predictions');
  console.log('  ✅ Python V3 for high-confidence edge cases');
  console.log('  ✅ Automatic fallback on Python failure');
  console.log('  ✅ Best of both worlds: speed + accuracy');
  console.log('='.repeat(70));
}

// Export for use in production
export { HybridPredictionSystem };
export type { HybridConfig };

// Run if called directly
if (require.main === module) {
  runDemo()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}
