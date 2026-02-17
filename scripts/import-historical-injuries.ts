/**
 * Import Historical Injuries (2010-2021)
 * Scrapes ESPN or uses alternative sources
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { DuckDBStorage } from '../src/data-fetch/storage/duckdb-storage';

interface InjuryConfig {
  sources: string[];
  startYear: number;
  endYear: number;
}

interface HistoricalInjury {
  gameId: string;
  playerId: string;
  playerName: string;
  team: string;
  season: number;
  status: 'Available' | 'Questionable' | 'Out' | 'Doubtful' | 'Probable';
  reason: string;
  reportDate: Date;
  source: string;
}

const ESPN_INJURY_URL = 'https://www.espn.com/nba/injuries';

export class HistoricalInjuriesImporter {
  private config: InjuryConfig;
  private duckdb: DuckDBStorage;

  constructor() {
    this.config = {
      sources: ['espn', 'basketball-reference'],
      startYear: 2010,
      endYear: 2021,
    };
    this.duckdb = new DuckDBStorage();
  }

  async import(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Importing Historical Injuries (2010-2021)                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    try {
      // Initialize DuckDB
      await this.duckdb.init();
      console.log('✅ DuckDB initialized\n');

      // Create table
      await this.createTable();

      // Note: Historical injury data is hard to get programmatically
      // We'll create a structure and populate with available data
      console.log('📊 Historical injury data notes:');
      console.log('   - ESPN has limited historical data');
      console.log('   - Basketball-Reference has some injury data');
      console.log('   - Most comprehensive source: NBA.com (2021+)');
      console.log('   - Alternative: Manual collection or paid sources\n');

      // Try to fetch what we can
      const injuries = await this.fetchAvailableData();
      
      if (injuries.length > 0) {
        await this.importInjuries(injuries);
        await this.createIndexes();
      }

      // Print summary
      await this.printSummary();

      console.log('\n✅ Import complete!');
      console.log('\n💡 Note: For comprehensive historical injury data (2010-2021), consider:');
      console.log('   1. NBA.com API (subscription)');
      console.log('   2. Sportradar historical data');
      console.log('   3. Manual collection from ESPN archives');

    } catch (error) {
      console.error('\n❌ Import failed:', (error as Error).message);
      throw error;
    } finally {
      await this.duckdb.close();
    }
  }

  private async createTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS injuries_historical (
        game_id VARCHAR,
        player_id VARCHAR,
        player_name VARCHAR,
        team VARCHAR,
        season INTEGER,
        status VARCHAR, -- 'Available', 'Questionable', 'Out', 'Doubtful', 'Probable'
        reason VARCHAR,
        report_date TIMESTAMP,
        source VARCHAR,
        PRIMARY KEY (game_id, player_id, report_date)
      )
    `;

    await this.duckdb.run(createTableSQL);
  }

  private async fetchAvailableData(): Promise<HistoricalInjury[]> {
    const injuries: HistoricalInjury[] = [];

    // Try to get current injuries as a sample
    console.log('📥 Fetching sample injury data...');
    
    try {
      // ESPN current injuries
      const espnInjuries = await this.fetchFromESPN();
      injuries.push(...espnInjuries);
    } catch (error) {
      console.warn('⚠️  Could not fetch ESPN data:', (error as Error).message);
    }

    return injuries;
  }

  private async fetchFromESPN(): Promise<HistoricalInjury[]> {
    const injuries: HistoricalInjury[] = [];

    try {
      const response = await axios.get(ESPN_INJURY_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      
      $('table tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 4) {
          const playerName = $(cells[0]).text().trim();
          const position = $(cells[1]).text().trim();
          const status = $(cells[2]).text().trim();
          const reason = $(cells[3]).text().trim();
          
          const teamHeader = $(row).closest('div').prev('div').text().trim();
          const team = teamHeader.replace(/\s*Injury Report\s*$/i, '').trim();

          if (playerName && status) {
            injuries.push({
              gameId: `sample_${team}_${Date.now()}`,
              playerId: `${team}_${playerName.replace(/\s+/g, '_')}`,
              playerName,
              team,
              season: new Date().getFullYear(),
              status: this.normalizeStatus(status),
              reason,
              reportDate: new Date(),
              source: 'espn',
            });
          }
        }
      });

    } catch (error) {
      console.warn('ESPN fetch failed:', (error as Error).message);
    }

    return injuries;
  }

  private normalizeStatus(status: string): HistoricalInjury['status'] {
    const normalized = status.toLowerCase().trim();
    
    if (normalized.includes('out')) return 'Out';
    if (normalized.includes('doubtful')) return 'Doubtful';
    if (normalized.includes('questionable')) return 'Questionable';
    if (normalized.includes('probable')) return 'Probable';
    
    return 'Available';
  }

  private async importInjuries(injuries: HistoricalInjury[]): Promise<void> {
    for (const injury of injuries) {
      const insertSQL = `
        INSERT OR REPLACE INTO injuries_historical
        VALUES (
          '${injury.gameId}',
          '${injury.playerId}',
          '${injury.playerName}',
          '${injury.team}',
          ${injury.season},
          '${injury.status}',
          '${injury.reason.replace(/'/g, "''")}',
          '${injury.reportDate.toISOString()}',
          '${injury.source}'
        )
      `;

      try {
        await this.duckdb.run(insertSQL);
      } catch (error) {
        console.warn(`Failed to insert injury for ${injury.playerName}:`, (error as Error).message);
      }
    }
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_injuries_hist_season ON injuries_historical(season)',
      'CREATE INDEX IF NOT EXISTS idx_injuries_hist_team ON injuries_historical(team)',
      'CREATE INDEX IF NOT EXISTS idx_injuries_hist_player ON injuries_historical(player_id)',
      'CREATE INDEX IF NOT EXISTS idx_injuries_hist_date ON injuries_historical(report_date)',
    ];

    for (const indexSQL of indexes) {
      await this.duckdb.run(indexSQL);
    }
  }

  private async printSummary(): Promise<void> {
    const countSQL = 'SELECT COUNT(*) as total FROM injuries_historical';
    const seasonSQL = `
      SELECT season, COUNT(*) as count 
      FROM injuries_historical 
      GROUP BY season 
      ORDER BY season
    `;
    const statusSQL = `
      SELECT status, COUNT(*) as count 
      FROM injuries_historical 
      GROUP BY status
    `;

    try {
      const countResult = await this.duckdb.query(countSQL);
      const seasonResult = await this.duckdb.query(seasonSQL);
      const statusResult = await this.duckdb.query(statusSQL);

      console.log('\n📊 Import Summary:');
      console.log(`   Total injury records: ${countResult[0]?.total || 0}`);
      console.log('\n   By Season:');
      for (const row of seasonResult) {
        console.log(`     ${row.season}: ${row.count} records`);
      }
      console.log('\n   By Status:');
      for (const row of statusResult) {
        console.log(`     ${row.status}: ${row.count}`);
      }
    } catch (error) {
      console.log('   No historical injury data available yet');
    }
  }
}

// CLI entry point
async function main() {
  const importer = new HistoricalInjuriesImporter();
  await importer.import();
}

if (require.main === module) {
  main().catch(console.error);
}

export default HistoricalInjuriesImporter;
