/**
 * Import GitHub NBA Dataset (2010-2024)
 * Downloads CSV files from GitHub and imports into DuckDB
 * Uses csv-parse for robust CSV parsing with proper quote handling
 */

import axios from 'axios';
import { DuckDBStorage } from '../src/data-fetch/storage/duckdb-storage';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface GameRecord {
  game_id: string;
  date: string;
  season: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  winner: string;
  elo_home_before: number;
  elo_home_after: number;
  elo_away_before: number;
  elo_away_after: number;
  forecast: number;
  is_playoffs: boolean;
}

interface CsvRecord {
  game_id: string;
  year_id: string;
  date_game: string;
  team_id: string;
  opp_id: string;
  pts: string;
  opp_pts: string;
  elo_i: string;
  elo_n: string;
  opp_elo_i: string;
  opp_elo_n: string;
  forecast: string;
  is_playoffs: string;
  game_location: string;
  [key: string]: string;
}

const GITHUB_DATASET_URL = 'https://raw.githubusercontent.com/fivethirtyeight/data/master/nba-elo/nbaallelo.csv';

export class GitHubDataImporter {
  private outputDir: string;
  private duckdb: DuckDBStorage;

  constructor() {
    this.outputDir = './data/github';
    this.duckdb = new DuckDBStorage();
  }

  async import(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Importing GitHub NBA Dataset (2010-2024)                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    try {
      // Initialize DuckDB
      await this.duckdb.init();
      console.log('✅ DuckDB initialized\n');

      // Create output directory
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
      }

      // Download dataset
      console.log('📥 Downloading dataset...');
      const csvPath = await this.downloadFile(GITHUB_DATASET_URL, 'nbaallelo.csv');
      console.log(`✅ Downloaded to ${csvPath}\n`);

      // Parse and import
      console.log('💾 Parsing and importing to DuckDB...');
      await this.parseAndImport(csvPath);

      // Create indexes
      console.log('🔍 Creating indexes...');
      await this.createIndexes();

      // Print summary
      await this.printSummary();

      console.log('\n✅ Import complete!');

    } catch (error) {
      console.error('\n❌ Import failed:', (error as Error).message);
      throw error;
    } finally {
      await this.duckdb.close();
    }
  }

  private async downloadFile(url: string, filename: string): Promise<string> {
    const outputPath = path.join(this.outputDir, filename);
    
    try {
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 120000,
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(outputPath));
        writer.on('error', reject);
      });

    } catch (error) {
      throw new Error(`Failed to download ${url}: ${(error as Error).message}`);
    }
  }

  private async parseAndImport(csvPath: string): Promise<void> {
    // Create table
    await this.createTable();

    // Read and parse CSV
    const content = fs.readFileSync(csvPath, 'utf-8');
    
    console.log('   Parsing CSV with csv-parse...');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      cast: true,
      relax_quotes: true,
      relax_column_count: true,
    });

    console.log(`   Parsed ${records.length} total rows`);

    // Filter for season >= 2010 and home games
    const gameRecords: GameRecord[] = [];
    
    for (const record of records as CsvRecord[]) {
      const yearId = parseInt(record.year_id);
      if (isNaN(yearId) || yearId < 2010) continue;
      if (record.game_location !== 'H') continue;

      // Parse date (format: 11/1/1946)
      const dateParts = record.date_game?.split('/');
      if (!dateParts || dateParts.length !== 3) continue;

      const dateStr = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;

      const gameRecord: GameRecord = {
        game_id: record.game_id,
        date: dateStr,
        season: yearId,
        home_team: record.team_id,
        away_team: record.opp_id,
        home_score: parseInt(record.pts) || 0,
        away_score: parseInt(record.opp_pts) || 0,
        winner: '',
        elo_home_before: parseFloat(record.elo_i) || 0,
        elo_home_after: parseFloat(record.elo_n) || 0,
        elo_away_before: parseFloat(record.opp_elo_i) || 0,
        elo_away_after: parseFloat(record.opp_elo_n) || 0,
        forecast: parseFloat(record.forecast) || 0,
        is_playoffs: record.is_playoffs === '1',
      };

      gameRecord.winner = gameRecord.home_score > gameRecord.away_score 
        ? gameRecord.home_team 
        : gameRecord.away_team;

      gameRecords.push(gameRecord);
    }

    console.log(`   Filtered to ${gameRecords.length} home games from 2010+\n`);

    // Insert in batches
    const BATCH_SIZE = 1000;
    let inserted = 0;

    for (let i = 0; i < gameRecords.length; i += BATCH_SIZE) {
      const batch = gameRecords.slice(i, i + BATCH_SIZE);
      await this.insertBatch(batch);
      inserted += batch.length;
      
      if (inserted % 5000 === 0 || inserted === gameRecords.length) {
        console.log(`   Inserted ${inserted}/${gameRecords.length} games...`);
      }
    }

    console.log(`✅ Successfully imported ${inserted} games\n`);
  }

  private async createTable(): Promise<void> {
    const sql = `
      DROP TABLE IF EXISTS github_games;
      CREATE TABLE github_games (
        game_id VARCHAR PRIMARY KEY,
        date DATE,
        season INTEGER,
        home_team VARCHAR,
        away_team VARCHAR,
        home_score INTEGER,
        away_score INTEGER,
        winner VARCHAR,
        elo_home_before FLOAT,
        elo_home_after FLOAT,
        elo_away_before FLOAT,
        elo_away_after FLOAT,
        forecast FLOAT,
        is_playoffs BOOLEAN,
        source VARCHAR DEFAULT 'github',
        imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await this.duckdb.run(sql);
  }

  private async insertBatch(records: GameRecord[]): Promise<void> {
    const values = records.map(r => `(
      '${r.game_id.replace(/'/g, "''")}',
      '${r.date}',
      ${r.season},
      '${r.home_team.replace(/'/g, "''")}',
      '${r.away_team.replace(/'/g, "''")}',
      ${r.home_score},
      ${r.away_score},
      '${r.winner.replace(/'/g, "''")}',
      ${r.elo_home_before},
      ${r.elo_home_after},
      ${r.elo_away_before},
      ${r.elo_away_after},
      ${r.forecast},
      ${r.is_playoffs},
      'github',
      CURRENT_TIMESTAMP
    )`).join(',');
    
    const sql = `
      INSERT INTO github_games 
      (game_id, date, season, home_team, away_team, home_score, away_score, winner,
       elo_home_before, elo_home_after, elo_away_before, elo_away_after, forecast, is_playoffs, source, imported_at)
      VALUES ${values}
    `;
    
    await this.duckdb.run(sql);
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX idx_github_games_date ON github_games(date)',
      'CREATE INDEX idx_github_games_season ON github_games(season)',
      'CREATE INDEX idx_github_games_home_team ON github_games(home_team)',
      'CREATE INDEX idx_github_games_away_team ON github_games(away_team)',
      'CREATE INDEX idx_github_games_game_id ON github_games(game_id)',
    ];

    for (const sql of indexes) {
      try {
        await this.duckdb.run(sql);
      } catch (error) {
        // Index might already exist
      }
    }
  }

  private async printSummary(): Promise<void> {
    try {
      const countResult = await this.duckdb.query('SELECT COUNT(*) as total FROM github_games');
      const seasonResult = await this.duckdb.query(`
        SELECT season, COUNT(*) as games 
        FROM github_games 
        GROUP BY season 
        ORDER BY season DESC
        LIMIT 10
      `);

      console.log('\n📊 Import Summary:');
      console.log(`   Total games imported: ${countResult[0]?.total || 0}`);
      console.log('\n   By Season:');
      for (const row of seasonResult) {
        console.log(`     ${row.season}: ${row.games} games`);
      }
    } catch (error) {
      console.warn('Could not print summary:', error);
    }
  }
}

// CLI entry point
async function main() {
  const importer = new GitHubDataImporter();
  await importer.import();
}

if (require.main === module) {
  main().catch(console.error);
}

export default GitHubDataImporter;
