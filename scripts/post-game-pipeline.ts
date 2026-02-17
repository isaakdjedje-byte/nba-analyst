/**
 * Post-Game Pipeline (22h-23h)
 * Fetches results, updates ELO, calculates ROI
 */

import { initCache, closeCache, RedisCache } from '../src/data-fetch/cache/redis-cache';
import { DuckDBStorage } from '../src/data-fetch/storage/duckdb-storage';
import axios from 'axios';

interface GameResult {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner: string;
  date: Date;
}

interface EloRatings {
  [team: string]: number;
}

class PostGamePipeline {
  private cache: RedisCache | null = null;
  private duckdb: DuckDBStorage | null = null;
  private eloRatings: EloRatings = {};

  async run(): Promise<void> {
    const startTime = Date.now();
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              POST-GAME PIPELINE (22h-23h)                   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    try {
      // Initialize
      await this.initialize();

      // Step 1: Fetch results
      await this.fetchResults();

      // Step 2: Update ELO ratings
      await this.updateEloRatings();

      // Step 3: Calculate rolling stats
      await this.calculateRollingStats();

      // Step 4: Validate predictions
      await this.validatePredictions();

      // Step 5: Update performance metrics
      await this.updatePerformanceMetrics();

      // Print summary
      const duration = (Date.now() - startTime) / 1000;
      console.log(`\n✅ Pipeline complete in ${duration.toFixed(1)}s`);

    } catch (error) {
      console.error('\n❌ Pipeline failed:', (error as Error).message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async initialize(): Promise<void> {
    console.log('🔄 Initializing services...\n');
    
    this.cache = await initCache();
    this.duckdb = new DuckDBStorage();
    await this.duckdb.init();

    // Load current ELO ratings
    await this.loadEloRatings();

    console.log('✅ Services initialized\n');
  }

  private async fetchResults(): Promise<void> {
    console.log('📊 STEP 1: Fetching game results...');
    console.log('   Source: ESPN API');
    
    try {
      const response = await axios.get(
        'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
        {
          params: {
            dates: this.getYesterdayDate(),
          },
          timeout: 30000,
        }
      );

      const games = response.data.events || [];
      const results: GameResult[] = [];

      for (const game of games) {
        if (game.competitions && game.competitions.length > 0) {
          const competition = game.competitions[0];
          const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home')?.team?.displayName;
          const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away')?.team?.displayName;
          const homeScore = parseInt(competition.competitors.find((c: any) => c.homeAway === 'home')?.score || 0);
          const awayScore = parseInt(competition.competitors.find((c: any) => c.homeAway === 'away')?.score || 0);

          if (homeTeam && awayTeam) {
            results.push({
              gameId: game.id,
              homeTeam,
              awayTeam,
              homeScore,
              awayScore,
              winner: homeScore > awayScore ? homeTeam : awayTeam,
              date: new Date(),
            });
          }
        }
      }

      // Save results to database
      await this.saveResults(results);

      console.log(`✅ Fetched ${results.length} game results\n`);
    } catch (error) {
      console.error('❌ Failed to fetch results:', (error as Error).message);
    }
  }

  private async updateEloRatings(): Promise<void> {
    console.log('📈 STEP 2: Updating ELO ratings...');
    
    try {
      // Get yesterday's games from database
      const sql = `
        SELECT game_id, home_team, away_team, home_score, away_score, winner
        FROM raw_games
        WHERE date = '${this.getYesterdayDate()}'
        ORDER BY date
      `;

      const games = await this.duckdb!.query(sql);
      let updatedCount = 0;

      for (const game of games as Array<Record<string, unknown>>) {
        const homeTeam = String(game.home_team ?? '');
        const awayTeam = String(game.away_team ?? '');
        const homeScore = Number(game.home_score ?? 0);
        const awayScore = Number(game.away_score ?? 0);
        const winner = String(game.winner ?? '');

        const homeEloBefore = this.eloRatings[homeTeam] || 1500;
        const awayEloBefore = this.eloRatings[awayTeam] || 1500;

        // Calculate ELO update
        const { homeEloAfter, awayEloAfter } = this.calculateEloUpdate(
          homeEloBefore,
          awayEloBefore,
          homeScore,
          awayScore,
          winner === homeTeam
        );

        // Update ratings
        this.eloRatings[homeTeam] = homeEloAfter;
        this.eloRatings[awayTeam] = awayEloAfter;

        // Save to database
        await this.saveEloUpdate(game, homeEloBefore, awayEloBefore, homeEloAfter, awayEloAfter);
        updatedCount++;
      }

      // Save current ELO ratings
      await this.saveEloRatings();

      console.log(`✅ Updated ELO for ${updatedCount} teams\n`);
    } catch (error) {
      console.error('❌ Failed to update ELO:', (error as Error).message);
    }
  }

  private calculateEloUpdate(
    homeElo: number,
    awayElo: number,
    homeScore: number,
    awayScore: number,
    homeWon: boolean
  ): { homeEloAfter: number; awayEloAfter: number } {
    const K = 20; // ELO constant
    const homeAdvantage = 100; // Home court advantage

    // Expected scores
    const homeExpected = 1 / (1 + Math.pow(10, (awayElo - homeElo - homeAdvantage) / 400));
    const awayExpected = 1 - homeExpected;

    // Actual scores (using margin of victory multiplier)
    const margin = Math.abs(homeScore - awayScore);
    const movMultiplier = Math.log(margin + 1) * (2.2 / ((homeElo - awayElo) * 0.001 + 2.2));

    const homeActual = homeWon ? 1 : 0;
    const awayActual = 1 - homeActual;

    // Update ratings
    const homeEloAfter = homeElo + K * movMultiplier * (homeActual - homeExpected);
    const awayEloAfter = awayElo + K * movMultiplier * (awayActual - awayExpected);

    return { homeEloAfter, awayEloAfter };
  }

  private async calculateRollingStats(): Promise<void> {
    console.log('📊 STEP 3: Calculating rolling statistics...');
    
    try {
      // Calculate 5, 10, 20 game rolling averages
      const windows = [5, 10, 20];
      
      for (const window of windows) {
        const sql = `
          INSERT OR REPLACE INTO team_rolling_stats
          SELECT 
            team,
            ${window} as window_size,
            AVG(pts) as avg_pts,
            AVG(fg_pct) as avg_fg_pct,
            AVG(tp_pct) as avg_tp_pct,
            AVG(efg_pct) as avg_efg_pct,
            AVG(tov_pct) as avg_tov_pct,
            AVG(off_rating) as avg_off_rating,
            AVG(def_rating) as avg_def_rating,
            COUNT(*) as games_played,
            CURRENT_TIMESTAMP as calculated_at
          FROM team_stats
          WHERE date >= DATE('now', '-${window} days')
          GROUP BY team
        `;

        try {
          await this.duckdb!.query(sql);
        } catch (error) {
          console.warn(`Could not calculate ${window}-game averages:`, error);
        }
      }

      console.log('✅ Calculated rolling statistics\n');
    } catch (error) {
      console.error('❌ Failed to calculate rolling stats:', (error as Error).message);
    }
  }

  private async validatePredictions(): Promise<void> {
    console.log('🎯 STEP 4: Validating predictions...');
    
    try {
      // Get yesterday's predictions and results
      const sql = `
        SELECT 
          p.game_id,
          p.predicted_winner,
          p.confidence,
          r.winner as actual_winner,
          CASE WHEN p.predicted_winner = r.winner THEN 1 ELSE 0 END as correct
        FROM predictions p
        JOIN raw_games r ON p.game_id = r.game_id
        WHERE r.date = '${this.getYesterdayDate()}'
      `;

      const results = await this.duckdb!.query(sql);
      
      if (results.length > 0) {
        const correct = results.filter((r: any) => r.correct === 1).length;
        const accuracy = (correct / results.length) * 100;
        const avgConfidence = results.reduce((sum: number, r: any) => sum + r.confidence, 0) / results.length;

        console.log(`   Predictions: ${results.length}`);
        console.log(`   Correct: ${correct} (${accuracy.toFixed(1)}%)`);
        console.log(`   Avg Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

        // Save validation results
        await this.saveValidationResults(results.length, correct, accuracy);
      } else {
        console.log('   No predictions to validate');
      }

      console.log('✅ Validated predictions\n');
    } catch (error) {
      console.error('❌ Failed to validate predictions:', (error as Error).message);
    }
  }

  private async updatePerformanceMetrics(): Promise<void> {
    console.log('💰 STEP 5: Updating performance metrics...');
    
    try {
      // Calculate ROI from betting history
      const roiSql = `
        SELECT 
          COUNT(*) as total_bets,
          SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN result = 'win' THEN amount * odds ELSE -amount END) as profit,
          AVG(CASE WHEN result = 'win' THEN odds ELSE 0 END) as avg_odds
        FROM betting_history
        WHERE date >= DATE('now', '-30 days')
      `;

      try {
        const roiResult = await this.duckdb!.query(roiSql);
        if (roiResult.length > 0) {
          const roi = roiResult[0] as Record<string, unknown>;
          const totalBets = Number(roi.total_bets ?? 0);
          const wins = Number(roi.wins ?? 0);
          const profit = Number(roi.profit ?? 0);
          const roiPct = totalBets > 0 ? (profit / totalBets) * 100 : 0;
          
          console.log(`   Last 30 days:`);
          console.log(`   Bets: ${totalBets}`);
          console.log(`   Wins: ${wins} (${(totalBets > 0 ? (wins / totalBets) * 100 : 0).toFixed(1)}%)`);
          console.log(`   ROI: ${roiPct.toFixed(1)}%`);
        }
      } catch (error) {
        console.log('   No betting history available');
      }

      console.log('✅ Updated performance metrics\n');
    } catch (error) {
      console.error('❌ Failed to update metrics:', (error as Error).message);
    }
  }

  private async loadEloRatings(): Promise<void> {
    try {
      const sql = 'SELECT team, elo_rating FROM elo_ratings WHERE season = 2024';
      const results = await this.duckdb!.query(sql);
      
      for (const row of results as Array<Record<string, unknown>>) {
        const team = String(row.team ?? '');
        const rating = Number(row.elo_rating ?? 1500);
        this.eloRatings[team] = rating;
      }
    } catch (error) {
      console.log('   Initializing default ELO ratings (1500)');
    }
  }

  private async saveEloRatings(): Promise<void> {
    // Save current ELO ratings
    for (const [team, rating] of Object.entries(this.eloRatings)) {
      const sql = `
        INSERT OR REPLACE INTO elo_ratings (team, elo_rating, season, updated_at)
        VALUES ('${team}', ${rating}, 2024, CURRENT_TIMESTAMP)
      `;
      
      try {
        await this.duckdb!.query(sql);
      } catch (error) {
        // Table might not exist
      }
    }
  }

  private async saveResults(results: GameResult[]): Promise<void> {
    for (const result of results) {
      const sql = `
        INSERT OR REPLACE INTO raw_games (game_id, date, home_team, away_team, home_score, away_score, winner)
        VALUES ('${result.gameId}', '${result.date.toISOString().split('T')[0]}', 
                '${result.homeTeam}', '${result.awayTeam}', 
                ${result.homeScore}, ${result.awayScore}, '${result.winner}')
      `;
      
      try {
        await this.duckdb!.query(sql);
      } catch (error) {
        console.warn(`Failed to save result for ${result.gameId}`);
      }
    }
  }

  private async saveEloUpdate(
    game: any,
    homeEloBefore: number,
    awayEloBefore: number,
    homeEloAfter: number,
    awayEloAfter: number
  ): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO elo_history 
      (game_id, home_team, away_team, home_elo_before, away_elo_before, 
       home_elo_after, away_elo_after, date)
      VALUES ('${game.game_id}', '${game.home_team}', '${game.away_team}',
              ${homeEloBefore}, ${awayEloBefore}, ${homeEloAfter}, ${awayEloAfter},
              '${this.getYesterdayDate()}')
    `;
    
    try {
      await this.duckdb!.query(sql);
    } catch (error) {
      // Table might not exist
    }
  }

  private async saveValidationResults(total: number, correct: number, accuracy: number): Promise<void> {
    const sql = `
      INSERT INTO prediction_validation 
      (date, total_predictions, correct_predictions, accuracy, calculated_at)
      VALUES ('${this.getYesterdayDate()}', ${total}, ${correct}, ${accuracy}, CURRENT_TIMESTAMP)
    `;
    
    try {
      await this.duckdb!.query(sql);
    } catch (error) {
      // Table might not exist
    }
  }

  private getYesterdayDate(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0].replace(/-/g, '');
  }

  private async cleanup(): Promise<void> {
    if (this.duckdb) {
      await this.duckdb.close();
    }
    await closeCache();
  }
}

// CLI entry point
async function main() {
  const pipeline = new PostGamePipeline();
  await pipeline.run();
}

if (require.main === module) {
  main().catch(console.error);
}

export default PostGamePipeline;
