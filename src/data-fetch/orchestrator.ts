/**
 * NBA Deep Data Fetcher Orchestrator
 * Coordinates multi-source data fetching and storage
 */

import { BasketballReferenceProvider } from './providers/basketball-reference';
import { NBAAPIWrapper } from './providers/nba-api-wrapper';
import { DataMerger } from './mergers/data-merger';
import { DuckDBStorage } from './storage/duckdb-storage';
import { loadConfig } from './config/fetch.config';
import { MasterGame } from './types/game.types';
import * as fs from 'fs';

interface FetchProgress {
  current_season: number;
  current_game: number;
  total_games_season: number;
  completed_games: string[];
  failed_games: Array<{ game_id: string; error: string }>;
  start_time: string;
  last_update: string;
}

type MergeGameNBAArg = Parameters<DataMerger['mergeGame']>[1];

export class DataFetchOrchestrator {
  private config = loadConfig();
  private bRefProvider: BasketballReferenceProvider;
  private nbaAPIWrapper: NBAAPIWrapper;
  private dataMerger: DataMerger;
  private duckdbStorage: DuckDBStorage;
  private progressFile = './logs/fetch-progress.json';

  constructor() {
    this.bRefProvider = new BasketballReferenceProvider();
    this.nbaAPIWrapper = new NBAAPIWrapper();
    this.dataMerger = new DataMerger();
    this.duckdbStorage = new DuckDBStorage();
  }

  /**
   * Main entry point: fetch all seasons
   */
  async fetchAllData(seasons?: number[]): Promise<void> {
    const seasonsToFetch = seasons || this.config.seasons;
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║       NBA DEEP DATA FETCHER v2.0 - Multi-Source              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`\n📅 Seasons: ${seasonsToFetch.join(', ')}`);
    console.log(`🔄 Sources: Basketball-Reference + NBA API`);
    console.log(`💾 Storage: PostgreSQL + DuckDB`);
    console.log(`⏱️  Estimated time: ~${seasonsToFetch.length * 1.2} hours\n`);

    // Initialize storage
    await this.duckdbStorage.init();

    const allGames: MasterGame[] = [];
    const startTime = Date.now();

    try {
      for (const season of seasonsToFetch) {
        const seasonGames = await this.fetchSeason(season);
        allGames.push(...seasonGames);
        
        // Save to storage after each season
        await this.duckdbStorage.saveGames(seasonGames);
        
        // Update progress
        this.updateProgress(season, seasonGames.length);
      }

      // Final summary
      const duration = (Date.now() - startTime) / 1000 / 60; // minutes
      console.log(`\n✅ Fetch complete!`);
      console.log(`   Total games: ${allGames.length}`);
      console.log(`   Duration: ${duration.toFixed(1)} minutes`);
      console.log(`   Average: ${(duration / allGames.length * 60).toFixed(1)} seconds/game`);

      await this.printSummary(allGames);

    } catch (error) {
      console.error('\n❌ Fetch failed:', (error as Error).message);
      console.log('\n💡 To resume, run: npm run data:fetch-resume');
      throw error;
    } finally {
      await this.duckdbStorage.close();
    }
  }

  /**
   * Fetch a single season
   */
  private async fetchSeason(season: number): Promise<MasterGame[]> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 SEASON ${season}`);
    console.log(`${'='.repeat(60)}`);

    // Step 1: Fetch from Basketball-Reference
    console.log('\n1️⃣  Fetching Basketball-Reference...');
    const bRefGames = await this.bRefProvider.fetchSeason(season);
    console.log(`   ✓ Retrieved ${bRefGames.length} games`);

    // Step 2: Enrich with NBA API (optional, slower)
    const mergedGames: MasterGame[] = [];
    
    if (this.config.sources.nbaAPI.enabled) {
      console.log('\n2️⃣  Enriching with NBA API...');
      
      for (let i = 0; i < bRefGames.length; i++) {
        const game = bRefGames[i];
        console.log(`   [${i + 1}/${bRefGames.length}] ${game.game_id}`);
        
        try {
          // Try to get NBA API data
          // Note: Need to convert B-Ref game_id to NBA API format
          const nbaAPIGameId = this.convertToNBAAPIGameId(game.game_id);
          const nbaAPIData = await this.nbaAPIWrapper.fetchGame(nbaAPIGameId);
          
          // Merge data
          const mergedGame = this.dataMerger.mergeGame(game, nbaAPIData as MergeGameNBAArg);
          
          // Validate
          const validation = this.dataMerger.validateGame(mergedGame);
          if (!validation.valid) {
            console.warn(`      ⚠️  Validation issues: ${validation.issues.join(', ')}`);
          }
          
          mergedGames.push(mergedGame);
          
        } catch (error) {
          console.warn(`      ⚠️  NBA API failed, using B-Ref only: ${(error as Error).message}`);
          // Use B-Ref data only
          const mergedGame = this.dataMerger.mergeGame(game, null);
          mergedGames.push(mergedGame);
        }
      }
    } else {
      console.log('\n2️⃣  NBA API disabled, using B-Ref only');
      for (const game of bRefGames) {
        const mergedGame = this.dataMerger.mergeGame(game, null);
        mergedGames.push(mergedGame);
      }
    }

    console.log(`\n✅ Season ${season} complete: ${mergedGames.length} games`);
    return mergedGames;
  }

  /**
   * Convert B-Ref game_id to NBA API game_id
   * B-Ref: 202403010LAL (YYYYMMDD0TEAM)
   * NBA: 0022300961 (002 + YY + GAMENO)
   * Note: This is approximate - exact mapping requires lookup
   */
  private convertToNBAAPIGameId(bRefGameId: string): string {
    // This is a placeholder - in production, you'd need to map these properly
    // For now, we'll try to fetch by season and teams
    return bRefGameId;
  }

  /**
   * Update progress file
   */
  private updateProgress(season: number, gamesCount: number): void {
    const progress: FetchProgress = {
      current_season: season,
      current_game: gamesCount,
      total_games_season: gamesCount,
      completed_games: [],
      failed_games: [],
      start_time: new Date().toISOString(),
      last_update: new Date().toISOString(),
    };

    fs.writeFileSync(this.progressFile, JSON.stringify(progress, null, 2));
  }

  /**
   * Resume from checkpoint
   */
  async resumeFromCheckpoint(): Promise<void> {
    if (!fs.existsSync(this.progressFile)) {
      console.log('No checkpoint found, starting fresh');
      return this.fetchAllData();
    }

    const progress: FetchProgress = JSON.parse(
      fs.readFileSync(this.progressFile, 'utf8')
    );

    console.log(`Resuming from season ${progress.current_season}`);
    
    const remainingSeasons = this.config.seasons.filter(
      s => s >= progress.current_season
    );

    return this.fetchAllData(remainingSeasons);
  }

  /**
   * Print summary statistics
   */
  async printSummary(games: MasterGame[]): Promise<void> {
    console.log('\n📊 FINAL SUMMARY');
    console.log('─'.repeat(60));

    // Count by season
    const seasonCounts = new Map<number, number>();
    games.forEach(g => {
      seasonCounts.set(g.season, (seasonCounts.get(g.season) || 0) + 1);
    });

    console.log('\nGames by season:');
    for (const [season, count] of seasonCounts.entries()) {
      console.log(`  ${season}: ${count} games`);
    }

    // Data quality
    const avgQuality = games.reduce((sum, g) => sum + g._data_quality, 0) / games.length;
    console.log(`\nAverage data quality: ${avgQuality.toFixed(1)}/100`);

    // Sources
    const bRefOnly = games.filter(g => g._sources.length === 1).length;
    const withNBAAPI = games.filter(g => g._sources.includes('nba-api')).length;
    console.log(`\nData sources:`);
    console.log(`  B-Ref only: ${bRefOnly}`);
    console.log(`  With NBA API: ${withNBAAPI}`);

    // Team coverage
    const teams = new Set<string>();
    games.forEach(g => {
      teams.add(g.home_team);
      teams.add(g.away_team);
    });
    console.log(`\nTeams covered: ${teams.size}`);

    console.log('\n' + '═'.repeat(60));
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<void> {
    if (!fs.existsSync(this.progressFile)) {
      console.log('No fetch in progress');
      return;
    }

    const progress: FetchProgress = JSON.parse(
      fs.readFileSync(this.progressFile, 'utf8')
    );

    console.log('Current fetch status:');
    console.log(`  Season: ${progress.current_season}`);
    console.log(`  Games: ${progress.current_game}/${progress.total_games_season}`);
    console.log(`  Started: ${progress.start_time}`);
    console.log(`  Last update: ${progress.last_update}`);
  }
}

// CLI entry point
if (require.main === module) {
  const orchestrator = new DataFetchOrchestrator();
  
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'resume':
      orchestrator.resumeFromCheckpoint().catch(console.error);
      break;
    case 'status':
      orchestrator.getStatus().catch(console.error);
      break;
    default:
      orchestrator.fetchAllData().catch(console.error);
  }
}
