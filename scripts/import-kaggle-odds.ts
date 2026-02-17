/**
 * Import Kaggle NBA Odds Dataset (2008-2023)
 * Requires Kaggle API credentials
 */

import { DuckDBStorage } from '../src/data-fetch/storage/duckdb-storage';
import * as fs from 'fs';
import * as path from 'path';

interface KaggleConfig {
  dataset: string;
  outputDir: string;
}

const KAGGLE_DATASET = 'rj467dj/nba-odds-data';

export class KaggleOddsImporter {
  private config: KaggleConfig;
  private duckdb: DuckDBStorage;

  constructor() {
    this.config = {
      dataset: KAGGLE_DATASET,
      outputDir: './data/kaggle',
    };
    this.duckdb = new DuckDBStorage();
  }

  async import(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Importing Kaggle NBA Odds (2008-2023)                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    try {
      // Initialize DuckDB
      await this.duckdb.init();
      console.log('✅ DuckDB initialized\n');

      // Check if Kaggle CLI is available
      const hasKaggle = await this.checkKaggleCLI();
      
      if (hasKaggle) {
        console.log('📥 Downloading from Kaggle...');
        await this.downloadFromKaggle();
      } else {
        console.log('⚠️  Kaggle CLI not available');
        console.log('   Please manually download:');
        console.log(`   https://www.kaggle.com/datasets/${this.config.dataset}`);
        console.log(`   Place CSV files in: ${this.config.outputDir}`);
        return;
      }

      // Import to DuckDB
      console.log('💾 Importing to DuckDB...');
      await this.importToDuckDB();

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

  private async checkKaggleCLI(): Promise<boolean> {
    try {
      const { execSync } = require('child_process');
      execSync('kaggle --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private async downloadFromKaggle(): Promise<void> {
    const { execSync } = require('child_process');
    
    // Create output directory
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    try {
      execSync(
        `kaggle datasets download -d ${this.config.dataset} -p "${this.config.outputDir}" --unzip`,
        { stdio: 'inherit', timeout: 300000 }
      );
    } catch (error) {
      throw new Error(`Failed to download Kaggle dataset: ${(error as Error).message}`);
    }
  }

  private async importToDuckDB(): Promise<void> {
    // Create table schema
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS odds_historical (
        game_id VARCHAR,
        date DATE,
        home_team VARCHAR,
        away_team VARCHAR,
        bookmaker VARCHAR,
        market VARCHAR, -- 'spread', 'total', 'ml'
        open_line FLOAT,
        close_line FLOAT,
        line_movement FLOAT,
        home_ml INTEGER,
        away_ml INTEGER,
        over_under FLOAT,
        home_spread FLOAT,
        home_implied_prob FLOAT,
        away_implied_prob FLOAT,
        source VARCHAR DEFAULT 'kaggle',
        imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (game_id, bookmaker, market)
      )
    `;

    await this.duckdb.run(createTableSQL);

    // Find CSV files
    const csvFiles = this.findCSVFiles(this.config.outputDir);
    
    if (csvFiles.length === 0) {
      throw new Error('No CSV files found in ' + this.config.outputDir);
    }

    console.log(`   Found ${csvFiles.length} CSV files`);

    // Import each file
    for (const csvFile of csvFiles) {
      console.log(`   Importing ${path.basename(csvFile)}...`);
      
      const importSQL = `
        INSERT OR REPLACE INTO odds_historical
        SELECT 
          game_id,
          date::DATE,
          home_team,
          away_team,
          bookmaker,
          market,
          open_line::FLOAT,
          close_line::FLOAT,
          CASE 
            WHEN open_line IS NOT NULL AND close_line IS NOT NULL 
            THEN close_line - open_line 
            ELSE 0 
          END as line_movement,
          home_ml::INTEGER,
          away_ml::INTEGER,
          over_under::FLOAT,
          home_spread::FLOAT,
          home_implied_prob::FLOAT,
          away_implied_prob::FLOAT,
          'kaggle' as source,
          CURRENT_TIMESTAMP
        FROM read_csv_auto('${csvFile.replace(/\\/g, '/')}')
        WHERE date >= '2008-01-01'
      `;

      try {
         await this.duckdb.run(importSQL);
      } catch (error) {
        console.warn(`   Warning: Failed to import ${path.basename(csvFile)}:`, (error as Error).message);
      }
    }
  }

  private findCSVFiles(dir: string): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }

    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...this.findCSVFiles(fullPath));
      } else if (item.endsWith('.csv')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_odds_hist_date ON odds_historical(date)',
      'CREATE INDEX IF NOT EXISTS idx_odds_hist_game ON odds_historical(game_id)',
      'CREATE INDEX IF NOT EXISTS idx_odds_hist_bookmaker ON odds_historical(bookmaker)',
      'CREATE INDEX IF NOT EXISTS idx_odds_hist_market ON odds_historical(market)',
    ];

    for (const indexSQL of indexes) {
      await this.duckdb.run(indexSQL);
    }
  }

  private async printSummary(): Promise<void> {
    const countSQL = 'SELECT COUNT(*) as total FROM odds_historical';
    const marketSQL = `
      SELECT market, COUNT(*) as count 
      FROM odds_historical 
      GROUP BY market
    `;
    const bookmakerSQL = `
      SELECT bookmaker, COUNT(*) as count 
      FROM odds_historical 
      GROUP BY bookmaker 
      ORDER BY count DESC 
      LIMIT 10
    `;

    const countResult = await this.duckdb.query(countSQL);
    const marketResult = await this.duckdb.query(marketSQL);
    const bookmakerResult = await this.duckdb.query(bookmakerSQL);

    console.log('\n📊 Import Summary:');
    console.log(`   Total odds entries: ${countResult[0]?.total || 0}`);
    console.log('\n   By Market:');
    for (const row of marketResult) {
      console.log(`     ${row.market}: ${row.count}`);
    }
    console.log('\n   Top Bookmakers:');
    for (const row of bookmakerResult) {
      console.log(`     ${row.bookmaker}: ${row.count}`);
    }
  }
}

// CLI entry point
async function main() {
  const importer = new KaggleOddsImporter();
  await importer.import();
}

if (require.main === module) {
  main().catch(console.error);
}

export default KaggleOddsImporter;
