/**
 * Import NBA UTC CSV files (2023, 2024, 2025)
 * Source: kyleskom/NBA-Machine-Learning-Sports-Betting
 * These files contain game schedules (no odds yet)
 */

import { DuckDBStorage } from '../src/data-fetch/storage/duckdb-storage';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

interface UTCGame {
  match_number: number;
  round: number;
  date: string;
  location: string;
  home_team: string;
  away_team: string;
  result?: string;
}

const SEASONS = [
  { year: 2023, file: 'data/nba-2023.csv' },
  { year: 2024, file: 'data/nba-2024.csv' },
  { year: 2025, file: 'data/nba-2025.csv' },
];

class UTCDataImporter {
  private duckdb: DuckDBStorage;

  constructor() {
    this.duckdb = new DuckDBStorage();
  }

  async importAll(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Importing NBA UTC CSV Files (2023-2025)                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    await this.duckdb.init();
    console.log('✅ DuckDB initialized\n');

    // Create table
    await this.createTable();

    let totalImported = 0;

    for (const season of SEASONS) {
      try {
        const count = await this.importSeason(season.year, season.file);
        totalImported += count;
        console.log(`   ✅ ${season.year}: ${count} games`);
      } catch (error) {
        console.error(`   ❌ ${season.year}:`, (error as Error).message);
      }
    }

    console.log(`\n✅ Total imported: ${totalImported} games`);

    // Show summary
    const result = await this.duckdb.query(
      'SELECT season, COUNT(*) FROM nba_utc_games GROUP BY season ORDER BY season'
    );
    console.log('\n📊 Summary:');
    for (const row of result) {
      console.log(`   ${row.season}: ${row.count} games`);
    }

    await this.duckdb.close();
  }

  private async createTable(): Promise<void> {
    await this.duckdb.run(`
      DROP TABLE IF EXISTS nba_utc_games;
      CREATE TABLE nba_utc_games (
        season INTEGER,
        match_number INTEGER,
        round INTEGER,
        date TIMESTAMP,
        location VARCHAR,
        home_team VARCHAR,
        away_team VARCHAR,
        result VARCHAR,
        source VARCHAR DEFAULT 'kyleskom'
      )
    `);
  }

  private async importSeason(year: number, filePath: string): Promise<number> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      cast: true,
    });

    const games: UTCGame[] = [];

    for (const record of records as any[]) {
      // Parse date (format: "22/10/2024 23:30")
      const dateParts = record.Date?.split(' ');
      if (!dateParts || dateParts.length !== 2) continue;

      const [day, month, yearPart] = dateParts[0].split('/');
      const [hour, minute] = dateParts[1].split(':');
      
      const dateStr = `${yearPart}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour}:${minute}:00`;

      games.push({
        match_number: parseInt(record['Match Number']) || 0,
        round: parseInt(record['Round Number']) || 0,
        date: dateStr,
        location: record.Location || '',
        home_team: record['Home Team'] || '',
        away_team: record['Away Team'] || '',
        result: record.Result || '',
      });
    }

    // Insert in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      
      const values = batch.map(g => `(
        ${year},
        ${g.match_number},
        ${g.round},
        '${g.date}',
        '${g.location.replace(/'/g, "''")}',
        '${g.home_team.replace(/'/g, "''")}',
        '${g.away_team.replace(/'/g, "''")}',
        '${(g.result || '').replace(/'/g, "''")}',
        'kyleskom'
      )`).join(',');

      const sql = `
        INSERT INTO nba_utc_games 
        (season, match_number, round, date, location, home_team, away_team, result, source)
        VALUES ${values}
      `;

      await this.duckdb.run(sql);
    }

    return games.length;
  }
}

// CLI entry
async function main() {
  const importer = new UTCDataImporter();
  await importer.importAll();
}

if (require.main === module) {
  main().catch(console.error);
}

export default UTCDataImporter;
