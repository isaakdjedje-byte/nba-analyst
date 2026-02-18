/**
 * Fetch Odds from The Odds API for 2025 Season
 * Rate Limit: 500 requests/day on free tier
 * Strategy: Fetch once per day, cache results
 */

import axios from 'axios';
import { DuckDBStorage } from '../src/data-fetch/storage/duckdb-storage';

interface OddsConfig {
  apiKey: string;
  baseUrl: string;
  sport: string;
  regions: string;
  markets: string;
}

const oddsApiKey = process.env.THE_ODDS_API_KEY;
if (!oddsApiKey) {
  throw new Error('THE_ODDS_API_KEY is required to run fetch-odds-api-2025.ts');
}

const CONFIG: OddsConfig = {
  apiKey: oddsApiKey,
  baseUrl: 'https://api.the-odds-api.com/v4',
  sport: 'basketball_nba',
  regions: 'us',
  markets: 'spreads,totals,h2h',
};

class OddsAPIFetcher {
  private duckdb: DuckDBStorage;
  private requestCount = 0;
  private readonly MAX_REQUESTS = 450; // Leave buffer for safety
  private readonly REQUEST_DELAY = 1200; // 1.2s between requests

  constructor() {
    this.duckdb = new DuckDBStorage();
  }

  async fetch2025Odds(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Fetching 2025 Odds from The Odds API                    ║');
    console.log('║     Rate Limit: 500 requests/day                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    try {
      await this.duckdb.init();
      console.log('✅ DuckDB initialized\n');

      // Create table for odds
      await this.createOddsTable();

      // Check how many requests we can make
      const existingCount = await this.getExistingOddsCount();
      console.log(`📊 Existing 2025 odds in database: ${existingCount}`);
      
      const remainingRequests = this.MAX_REQUESTS - this.requestCount;
      console.log(`🔄 Remaining API requests available: ${remainingRequests}\n`);

      // Fetch current odds
      console.log('📥 Fetching current odds...');
      const odds = await this.fetchCurrentOdds();
      
      if (odds.length > 0) {
        await this.saveOdds(odds);
        console.log(`\n✅ Saved ${odds.length} odds entries`);
      } else {
        console.log('\n⚠️ No odds data returned from API');
      }

      // Check API usage
      await this.checkApiUsage();

      console.log('\n✅ Odds fetch complete!');

    } catch (error) {
      console.error('\n❌ Error:', (error as Error).message);
      if ((error as Error).message.includes('429')) {
        console.error('   Rate limit exceeded. Please wait before retrying.');
      }
    } finally {
      await this.duckdb.close();
    }
  }

  private async createOddsTable(): Promise<void> {
    await this.duckdb.run(`
      CREATE TABLE IF NOT EXISTS odds_api_2025 (
        game_id VARCHAR,
        bookmaker VARCHAR,
        market VARCHAR,
        home_team VARCHAR,
        away_team VARCHAR,
        commence_time TIMESTAMP,
        open_line FLOAT,
        close_line FLOAT,
        line_movement FLOAT,
        home_implied_prob FLOAT,
        away_implied_prob FLOAT,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (game_id, bookmaker, market)
      )
    `);

    // Create indexes
    await this.duckdb.run(`
      CREATE INDEX IF NOT EXISTS idx_odds_2025_game ON odds_api_2025(game_id)
    `);
    await this.duckdb.run(`
      CREATE INDEX IF NOT EXISTS idx_odds_2025_date ON odds_api_2025(commence_time)
    `);
  }

  private async getExistingOddsCount(): Promise<number> {
    try {
      const result = await this.duckdb.query(`
        SELECT COUNT(DISTINCT game_id) as count 
        FROM odds_api_2025 
        WHERE commence_time >= '2024-10-01'
      `);
      return Number(result[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }

  private async fetchCurrentOdds(): Promise<any[]> {
    const allOdds: any[] = [];
    
    try {
      console.log('   Making API request...');
      
      const response = await axios.get(
        `${CONFIG.baseUrl}/sports/${CONFIG.sport}/odds`,
        {
          params: {
            apiKey: CONFIG.apiKey,
            regions: CONFIG.regions,
            markets: CONFIG.markets,
            oddsFormat: 'american',
            dateFormat: 'iso',
          },
          timeout: 30000,
        }
      );

      this.requestCount++;
      
      const games = response.data || [];
      console.log(`   📊 Received ${games.length} games from API`);

      for (const game of games) {
        const gameOdds = this.parseGameOdds(game);
        allOdds.push(...gameOdds);
      }

      // Respect rate limits
      await this.sleep(this.REQUEST_DELAY);

    } catch (error: any) {
      if (error.response?.status === 429) {
        console.error('   ⚠️ Rate limit hit (429). Stopping.');
        throw new Error('Rate limit exceeded');
      }
      console.error('   ⚠️ API Error:', error.message);
    }

    return allOdds;
  }

  private parseGameOdds(game: any): any[] {
    const odds: any[] = [];
    
    for (const bookmaker of game.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        const entry = {
          game_id: game.id,
          bookmaker: bookmaker.key,
          market: market.key,
          home_team: game.home_team,
          away_team: game.away_team,
          commence_time: game.commence_time,
          open_line: null, // Will be updated later
          close_line: this.extractLine(market, game.home_team),
          line_movement: 0,
          home_implied_prob: this.extractProbability(market, game.home_team),
          away_implied_prob: this.extractProbability(market, game.away_team),
        };
        
        odds.push(entry);
      }
    }
    
    return odds;
  }

  private extractLine(market: any, homeTeam: string): number | null {
    if (market.key === 'spreads') {
      const outcome = market.outcomes?.find((o: any) => o.name === homeTeam);
      return outcome?.point || null;
    } else if (market.key === 'totals') {
      return market.outcomes?.[0]?.point || null;
    } else if (market.key === 'h2h') {
      const outcome = market.outcomes?.find((o: any) => o.name === homeTeam);
      return outcome?.price || null;
    }
    return null;
  }

  private extractProbability(market: any, team: string): number {
    if (market.key !== 'h2h') return 0.5;
    
    const outcome = market.outcomes?.find((o: any) => o.name === team);
    const price = outcome?.price;
    
    if (!price) return 0.5;
    
    // Convert American odds to implied probability
    if (price > 0) {
      return 100 / (price + 100);
    } else {
      return Math.abs(price) / (Math.abs(price) + 100);
    }
  }

  private async saveOdds(odds: any[]): Promise<void> {
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < odds.length; i += BATCH_SIZE) {
      const batch = odds.slice(i, i + BATCH_SIZE);
      
      const values = batch.map(o => `(
        '${o.game_id}',
        '${o.bookmaker}',
        '${o.market}',
        '${o.home_team.replace(/'/g, "''")}',
        '${o.away_team.replace(/'/g, "''")}',
        '${o.commence_time}',
        ${o.open_line || 'NULL'},
        ${o.close_line || 'NULL'},
        ${o.line_movement},
        ${o.home_implied_prob},
        ${o.away_implied_prob},
        CURRENT_TIMESTAMP
      )`).join(',');

      const sql = `
        INSERT OR REPLACE INTO odds_api_2025 
        (game_id, bookmaker, market, home_team, away_team, commence_time,
         open_line, close_line, line_movement, home_implied_prob, away_implied_prob, fetched_at)
        VALUES ${values}
      `;

      await this.duckdb.run(sql);
      
      if ((i + BATCH_SIZE) % 500 === 0) {
        console.log(`   💾 Saved ${Math.min(i + BATCH_SIZE, odds.length)}/${odds.length} odds...`);
      }
    }
  }

  private async checkApiUsage(): Promise<void> {
    try {
      const response = await axios.get(`${CONFIG.baseUrl}/sports`, {
        params: { apiKey: CONFIG.apiKey },
      });

      const headers = response.headers;
      const remaining = headers['x-requests-remaining'];
      const used = headers['x-requests-used'];
      
      console.log('\n📊 API Usage:');
      console.log(`   Requests used today: ${used || 'N/A'}`);
      console.log(`   Requests remaining: ${remaining || 'N/A'}`);
      
      this.requestCount++;
    } catch (error) {
      // Ignore error
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI entry
async function main() {
  const fetcher = new OddsAPIFetcher();
  await fetcher.fetch2025Odds();
}

if (require.main === module) {
  main().catch(console.error);
}

export default OddsAPIFetcher;
