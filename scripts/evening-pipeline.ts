/**
 * Evening Pipeline (18h-20h)
 * Automated workflow for pre-game predictions
 */

import { initCache, closeCache, RedisCache } from '../src/data-fetch/cache/redis-cache';
import { OddsRealtimeProvider } from '../src/data-fetch/providers/odds-realtime';
import { InjuriesRealtimeProvider } from '../src/data-fetch/providers/injuries-realtime';
import { ESPNLineupsProvider } from '../src/data-fetch/providers/espn-lineups';
import { LiveFeatureEngineering } from '../src/data-fetch/features/live-features';
import { DuckDBStorage } from '../src/data-fetch/storage/duckdb-storage';

interface PipelineConfig {
  oddsApiKey: string;
  redisUrl: string;
}

export class EveningPipeline {
  private cache: RedisCache;
  private oddsProvider: OddsRealtimeProvider;
  private injuriesProvider: InjuriesRealtimeProvider;
  private lineupsProvider: ESPNLineupsProvider;
  private featureEngineering: LiveFeatureEngineering;
  private duckdb: DuckDBStorage;

  constructor() {
    this.cache = new RedisCache();
    this.oddsProvider = new OddsRealtimeProvider(this.cache);
    this.injuriesProvider = new InjuriesRealtimeProvider(this.cache);
    this.lineupsProvider = new ESPNLineupsProvider(this.cache);
    this.featureEngineering = new LiveFeatureEngineering(this.cache);
    this.duckdb = new DuckDBStorage();
  }

  /**
   * Run complete evening pipeline
   */
  async run(): Promise<void> {
    const startTime = Date.now();
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║            EVENING PIPELINE (18:00 - 20:00)                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    try {
      // Initialize connections
      console.log('🔌 Initializing connections...');
      await this.cache.connect();
      await this.duckdb.init();
      console.log('✅ Connections initialized\n');

      // Step 1: Fetch opening odds (18:00)
      console.log('📊 Step 1: Fetching opening odds...');
      const openingOdds = await this.oddsProvider.fetchOpeningOdds();
      console.log(`✅ Fetched ${openingOdds.length} odds entries\n`);

      // Step 2: Fetch injury reports (18:05)
      console.log('🏥 Step 2: Fetching injury reports...');
      const injuries = await this.injuriesProvider.fetchInjuryReports();
      console.log(`✅ Fetched ${injuries.length} injury reports\n`);

      // Step 3: Fetch starting lineups (18:10)
      console.log('🏀 Step 3: Fetching starting lineups...');
      const lineups = await this.lineupsProvider.fetchStartingLineups();
      console.log(`✅ Fetched lineups for ${lineups.length} games\n`);

      // Step 4: Calculate live features (18:15)
      console.log('⚙️  Step 4: Calculating live features...');
      const features = await this.featureEngineering.calculateAllLiveFeatures();
      console.log(`✅ Calculated features for ${Object.keys(features).length} games\n`);

      // Step 5: Generate predictions (18:20)
      console.log('🎯 Step 5: Generating predictions...');
      const predictions = await this.generatePredictions(features);
      console.log(`✅ Generated ${predictions.length} predictions\n`);

      // Save predictions to database
      await this.savePredictions(predictions);

      // Print summary
      const duration = (Date.now() - startTime) / 1000 / 60;
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║                     PIPELINE COMPLETE                        ║');
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log(`║  Odds fetched:     ${String(openingOdds.length).padEnd(38)} ║`);
      console.log(`║  Injuries:        ${String(injuries.length).padEnd(38)} ║`);
      console.log(`║  Lineups:         ${String(lineups.length).padEnd(38)} ║`);
      console.log(`║  Predictions:     ${String(predictions.length).padEnd(38)} ║`);
      console.log(`║  Duration:        ${String(duration.toFixed(1) + ' min').padEnd(38)} ║`);
      console.log('╚══════════════════════════════════════════════════════════════╝\n');

      // Print cache stats
      const cacheStats = await this.cache.getStats();
      console.log('📦 Cache Status:');
      console.log(`   Odds:     ${cacheStats.odds}`);
      console.log(`   Injuries: ${cacheStats.injuries}`);
      console.log(`   Lineups:  ${cacheStats.lineups}`);
      console.log(`   Live:     ${cacheStats.live}`);
      console.log(`   Total:    ${cacheStats.total}`);

    } catch (error) {
      console.error('\n❌ Pipeline failed:', (error as Error).message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Generate predictions from features
   */
  private async generatePredictions(features: Record<string, any>): Promise<any[]> {
    const predictions: any[] = [];

    for (const [gameId, gameFeatures] of Object.entries(features)) {
      // Simple prediction model
      // In production, this would use your trained ML model
      const prediction = this.calculatePrediction(gameId, gameFeatures);
      predictions.push(prediction);
    }

    return predictions;
  }

  /**
   * Calculate prediction for a game
   */
  private calculatePrediction(gameId: string, features: any): any {
    // Simple heuristic model
    // In production, replace with actual ML model inference
    const homeAdvantage = 0.6;
    const injuryImpact = (features.awayInjuryImpact - features.homeInjuryImpact) * 0.05;
    const restImpact = (features.awayRestDays - features.homeRestDays) * 0.02;
    
    const winProbability = Math.min(Math.max(
      homeAdvantage + injuryImpact + restImpact,
      0.1
    ), 0.9);

    return {
      gameId,
      homeWinProbability: winProbability,
      awayWinProbability: 1 - winProbability,
      confidence: this.calculateConfidence(features),
      spreadPrediction: (winProbability - 0.5) * 20, // Estimated spread
      totalPrediction: 220, // Average NBA total
      features: features,
      generatedAt: new Date(),
    };
  }

  /**
   * Calculate prediction confidence
   */
  private calculateConfidence(features: any): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence with confirmed lineups
    if (features.lineupsConfirmed) confidence += 0.15;

    // Decrease confidence with injuries
    if (features.homeStarsOut > 0 || features.awayStarsOut > 0) confidence -= 0.1;

    // Decrease confidence with sharp line movement
    if (features.sharpIndicator) confidence -= 0.1;

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Save predictions to database
   */
  private async savePredictions(predictions: any[]): Promise<void> {
    // Create table if not exists
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS predictions (
        game_id VARCHAR PRIMARY KEY,
        home_win_prob FLOAT,
        away_win_prob FLOAT,
        confidence FLOAT,
        spread_pred FLOAT,
        total_pred FLOAT,
        features JSON,
        generated_at TIMESTAMP
      )
    `;

    await this.duckdb.run(createTableSQL);

    // Insert predictions
    for (const pred of predictions) {
      const insertSQL = `
        INSERT OR REPLACE INTO predictions
        VALUES (
          '${pred.gameId}',
          ${pred.homeWinProbability},
          ${pred.awayWinProbability},
          ${pred.confidence},
          ${pred.spreadPrediction},
          ${pred.totalPrediction},
          '${JSON.stringify(pred.features).replace(/'/g, "''")}',
          '${pred.generatedAt.toISOString()}'
        )
      `;

      try {
        await this.duckdb.run(insertSQL);
      } catch (error) {
        console.warn(`Failed to save prediction for ${pred.gameId}:`, error);
      }
    }

    console.log(`✅ Saved ${predictions.length} predictions to database`);
  }

  /**
   * Run pre-game pipeline (20:00 - before games)
   * Fetches closing odds and updates predictions
   */
  async runPreGame(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              PRE-GAME PIPELINE (20:00)                       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    try {
      await this.cache.connect();
      await this.duckdb.init();

      // Fetch closing odds
      console.log('📊 Fetching closing odds...');
      const closingOdds = await this.oddsProvider.fetchClosingOdds();
      console.log(`✅ Fetched ${closingOdds.length} closing odds`);

      // Detect sharp movements
      console.log('🔍 Detecting sharp line movements...');
      let sharpCount = 0;
      for (const odds of closingOdds) {
        const sharp = await this.oddsProvider.detectSharpMovement(odds.gameId);
        if (sharp?.hasSharpMovement) {
          sharpCount++;
          console.log(`   ⚠️  Sharp movement detected: ${odds.homeTeam} vs ${odds.awayTeam}`);
        }
      }
      console.log(`✅ Detected ${sharpCount} sharp movements\n`);

      // Calculate bet sizes (Kelly Criterion)
      console.log('💰 Calculating bet sizes...');
      const betSizes = await this.calculateBetSizes();
      console.log(`✅ Calculated bet sizes for ${betSizes.length} predictions`);

    } catch (error) {
      console.error('\n❌ Pre-game pipeline failed:', (error as Error).message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Calculate bet sizes using Kelly Criterion
   */
  private async calculateBetSizes(): Promise<any[]> {
    // Query predictions from database
    const predictions = await this.duckdb.query('SELECT * FROM predictions');
    const betSizes: any[] = [];

    for (const pred of predictions) {
      const gameId = String(pred.game_id);
      const homeWinProb = Number(pred.home_win_prob ?? 0);
      const confidence = Number(pred.confidence ?? 0);

      // Get cached odds
      const odds = await this.cache.getOdds(gameId);
      
      if (odds) {
        // Kelly Criterion: f* = (bp - q) / b
        // b = odds, p = probability, q = 1-p
        const p = homeWinProb;
        const q = 1 - p;
        const b = 1; // Assume even odds for simplicity
        
        const kellyFraction = (b * p - q) / b;
        const betSize = Math.max(0, kellyFraction * 0.25); // Quarter Kelly for safety

        betSizes.push({
          gameId: pred.game_id,
          betSize,
          confidence,
          expectedValue: betSize * (p * b - q),
        });
      }
    }

    return betSizes;
  }

  /**
   * Cleanup connections
   */
  private async cleanup(): Promise<void> {
    await this.featureEngineering.close();
    await closeCache();
  }
}

// CLI entry point
async function main() {
  const pipeline = new EveningPipeline();
  
  const command = process.argv[2];
  
  if (command === 'pre-game') {
    await pipeline.runPreGame();
  } else {
    await pipeline.run();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default EveningPipeline;
