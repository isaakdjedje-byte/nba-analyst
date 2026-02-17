/**
 * Import NBA Odds from GitHub Repository
 * Source: kyleskom/NBA-Machine-Learning-Sports-Betting
 * Multiple tables per season (odds_2007-08, odds_2008-09, etc.)
 */

import { DuckDBStorage } from '../src/data-fetch/storage/duckdb-storage';
import * as fs from 'fs';
import * as path from 'path';

interface SeasonTable {
  name: string;
  season: number;
}

export class GitHubOddsImporter {
  private dataDir: string;
  private duckdb: DuckDBStorage;

  constructor() {
    this.dataDir = './data/github-odds';
    this.duckdb = new DuckDBStorage();
  }

  async import(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Importing NBA Odds from GitHub (kyleskom)                ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    try {
      await this.duckdb.init();
      console.log('✅ DuckDB initialized\n');

      // Import odds data from all season tables
      await this.importOddsData();

      console.log('\n✅ Import complete!');

    } catch (error) {
      console.error('\n❌ Import failed:', (error as Error).message);
      throw error;
    } finally {
      await this.duckdb.close();
    }
  }

  private async importOddsData(): Promise<void> {
    console.log('💾 Importing Odds Data...');
    
    const dbPath = path.join(this.dataDir, 'OddsData.sqlite');
    if (!fs.existsSync(dbPath)) {
      throw new Error('OddsData.sqlite not found');
    }

    // Create target table
    await this.duckdb.run(`
      DROP TABLE IF EXISTS odds_historical;
      CREATE TABLE odds_historical (
        season INTEGER,
        date DATE,
        home_team VARCHAR,
        away_team VARCHAR,
        over_under FLOAT,
        spread FLOAT,
        ml_home VARCHAR,
        ml_away VARCHAR,
        total_points INTEGER,
        win_margin INTEGER,
        days_rest_home INTEGER,
        days_rest_away INTEGER,
        source VARCHAR DEFAULT 'kyleskom'
      )
    `);

    // Attach SQLite database
    const attachSQL = `ATTACH '${dbPath.replace(/\\/g, '/')}' AS odds_db (TYPE sqlite)`;
    await this.duckdb.run(attachSQL);

    // Get list of tables and filter for odds tables
    // Try to query the SQLite database directly through DuckDB
    const tablesResult = await this.duckdb.query(`
      SELECT * FROM odds_db.sqlite_master 
      WHERE type='table' AND name LIKE 'odds_%'
    `);

    const tables: SeasonTable[] = tablesResult
      .map((t: any) => t.name)
      .filter((name: string) => name.match(/odds_\d{4}-\d{2}/))
      .map((name: string) => {
        const match = name.match(/odds_(\d{4})-\d{2}/);
        return {
          name,
          season: match ? parseInt(match[1]) : 0
        };
      })
      .filter((t: SeasonTable) => t.season >= 2010)
      .sort((a: SeasonTable, b: SeasonTable) => a.season - b.season);

    console.log(`   Found ${tables.length} season tables from 2010+`);

    let totalImported = 0;

    // Import each season table
    for (const table of tables) {
      try {
        // Use INSERT INTO instead of CREATE TABLE AS to avoid column issues
        await this.duckdb.run(`
          INSERT INTO odds_historical
          SELECT 
            ${table.season} as season,
            Date as date,
            Home as home_team,
            Away as away_team,
            OU as over_under,
            Spread as spread,
            ML_Home as ml_home,
            ML_Away as ml_away,
            Points as total_points,
            Win_Margin as win_margin,
            Days_Rest_Home as days_rest_home,
            Days_Rest_Away as days_rest_away,
            'kyleskom' as source
          FROM odds_db."${table.name}"
        `);

        const countResult = await this.duckdb.query(
          `SELECT COUNT(*) as cnt FROM odds_historical WHERE season = ${table.season}`
        );
        const seasonCount = Number(countResult[0]?.cnt ?? 0);
        totalImported += seasonCount;
        
        console.log(`   ✅ ${table.season}-${table.season + 1}: ${seasonCount} games`);
      } catch (error) {
        console.warn(`   ⚠️  Failed to import ${table.name}:`, (error as Error).message);
      }
    }

    // Detach
    await this.duckdb.run(`DETACH odds_db`);

    // Create indexes
    await this.createIndexes();

    // Print summary
    const finalCount = await this.duckdb.query('SELECT COUNT(*) as total FROM odds_historical');
    console.log(`\n✅ Total imported: ${finalCount[0]?.total || 0} odds records`);
    
    const seasonSummary = await this.duckdb.query(`
      SELECT season, COUNT(*) as games 
      FROM odds_historical 
      GROUP BY season 
      ORDER BY season
    `);
    
    console.log('\n   By Season:');
    for (const row of seasonSummary) {
      const season = Number(row.season ?? 0);
      const games = Number(row.games ?? 0);
      console.log(`     ${season}-${season + 1}: ${games} games`);
    }
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX idx_odds_date ON odds_historical(date)',
      'CREATE INDEX idx_odds_season ON odds_historical(season)',
      'CREATE INDEX idx_odds_home ON odds_historical(home_team)',
      'CREATE INDEX idx_odds_away ON odds_historical(away_team)',
    ];

    for (const sql of indexes) {
      try {
        await this.duckdb.run(sql);
      } catch (error) {
        // Ignore index errors
      }
    }
  }
}

// CLI entry point
async function main() {
  const importer = new GitHubOddsImporter();
  await importer.import();
}

if (require.main === module) {
  main().catch(console.error);
}

export default GitHubOddsImporter;
