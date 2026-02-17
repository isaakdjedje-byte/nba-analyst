/**
 * Fetch Missing NBA Games (2016-2025)
 * Récupère les matchs manquants via ESPN API
 */

import axios from 'axios';
import { DuckDBStorage } from '../src/data-fetch/storage/duckdb-storage';
import * as fs from 'fs';

interface NBAGame {
  id: string;
  date: string;
  season: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  winner: string;
}

// Dates de début et fin pour chaque saison manquante
// Récupération de toutes les saisons manquantes
const SEASONS_TO_FETCH = [
  { season: 2016, start: '20161025', end: '20170412', name: '2016-17' },
  { season: 2017, start: '20171017', end: '20180411', name: '2017-18' },
  { season: 2018, start: '20181016', end: '20190410', name: '2018-19' },
  { season: 2019, start: '20191022', end: '20200415', name: '2019-20' },
  { season: 2020, start: '20201222', end: '20210516', name: '2020-21' },
  { season: 2021, start: '20211019', end: '20220410', name: '2021-22' },
  { season: 2022, start: '20221018', end: '20230409', name: '2022-23' },
  { season: 2023, start: '20231024', end: '20240414', name: '2023-24' },
  { season: 2024, start: '20241022', end: '20250413', name: '2024-25' }, // Fin saison estimée
];

class MissingGamesFetcher {
  private duckdb: DuckDBStorage;
  private delay = 500; // ms entre les requêtes

  constructor() {
    this.duckdb = new DuckDBStorage();
  }

  async fetchAll(): Promise<void> {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     Fetching Missing NBA Games (2016-2025)                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    await this.duckdb.init();
    console.log('✅ DuckDB initialized\n');

    // Créer table temporaire pour les nouveaux matchs
    await this.createTempTable();

    let totalFetched = 0;

    for (const seasonInfo of SEASONS_TO_FETCH) {
      try {
        console.log(`\n📅 Season ${seasonInfo.name} (${seasonInfo.start} to ${seasonInfo.end})`);
        const count = await this.fetchSeason(seasonInfo);
        totalFetched += count;
        console.log(`   ✅ Fetched ${count} games`);
      } catch (error) {
        console.error(`   ❌ Error fetching season ${seasonInfo.name}:`, (error as Error).message);
      }
    }

    // Fusionner avec la table existante
    await this.mergeWithExisting();

    // Résumé
    const result = await this.duckdb.query('SELECT season, COUNT(*) as games FROM github_games GROUP BY season ORDER BY season');
    console.log('\n📊 Final Summary:');
    console.log(`   Total games fetched: ${totalFetched}`);
    console.log('\n   All seasons now available:');
    for (const row of result) {
      console.log(`     ${row.season}: ${row.games} games`);
    }

    await this.duckdb.close();
    console.log('\n✅ All missing games imported!');
  }

  private async createTempTable(): Promise<void> {
    await this.duckdb.run(`
      DROP TABLE IF EXISTS nba_games_new;
      CREATE TABLE nba_games_new (
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
        source VARCHAR DEFAULT 'espn',
        imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async fetchSeason(season: { season: number; start: string; end: string; name: string }): Promise<number> {
    const games: NBAGame[] = [];
    
    // Générer toutes les dates de la saison
    const dates = this.generateDates(season.start, season.end);
    console.log(`   Total dates to fetch: ${dates.length}`);

    let fetched = 0;
    let errors = 0;

    for (const date of dates) {
      try {
        const dayGames = await this.fetchDay(date, season.season);
        games.push(...dayGames);
        fetched += dayGames.length;
        
        if (fetched % 100 === 0) {
          console.log(`   Progress: ${fetched} games...`);
        }

        // Délai pour respecter rate limits
        await this.sleep(this.delay);
      } catch (error) {
        errors++;
        if (errors % 10 === 0) {
          console.warn(`   Warning: ${errors} errors so far`);
        }
      }
    }

    // Insérer les matchs
    if (games.length > 0) {
      await this.insertGames(games);
    }

    return games.length;
  }

  private async fetchDay(date: string, season: number): Promise<NBAGame[]> {
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      {
        params: { dates: date },
        timeout: 30000,
      }
    );

    const events = response.data.events || [];
    const games: NBAGame[] = [];

    for (const event of events) {
      const competition = event.competitions?.[0];
      if (!competition) continue;

      const home = competition.competitors?.find((c: any) => c.homeAway === 'home');
      const away = competition.competitors?.find((c: any) => c.homeAway === 'away');

      if (!home || !away) continue;

      // Ignorer les playoffs pour l'instant (on pourra les ajouter plus tard)
      if (event.season?.type !== 2) continue; // type 2 = regular season

      games.push({
        id: event.id,
        date: event.date?.split('T')[0] || date,
        season: season,
        home_team: home.team?.displayName,
        away_team: away.team?.displayName,
        home_score: parseInt(home.score || 0),
        away_score: parseInt(away.score || 0),
        winner: home.winner ? home.team?.displayName : away.team?.displayName,
      });
    }

    return games;
  }

  private async insertGames(games: NBAGame[]): Promise<void> {
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < games.length; i += BATCH_SIZE) {
      const batch = games.slice(i, i + BATCH_SIZE);
      
      const values = batch.map(g => `(
        '${g.id}',
        '${g.date}',
        ${g.season},
        '${g.home_team.replace(/'/g, "''")}',
        '${g.away_team.replace(/'/g, "''")}',
        ${g.home_score},
        ${g.away_score},
        '${g.winner.replace(/'/g, "''")}',
        NULL, NULL, NULL, NULL, NULL,
        false,
        'espn',
        CURRENT_TIMESTAMP
      )`).join(',');

      const sql = `
        INSERT OR REPLACE INTO nba_games_new 
        (game_id, date, season, home_team, away_team, home_score, away_score, winner,
         elo_home_before, elo_home_after, elo_away_before, elo_away_after, forecast, is_playoffs, source, imported_at)
        VALUES ${values}
      `;

      await this.duckdb.run(sql);
    }
  }

  private async mergeWithExisting(): Promise<void> {
    console.log('\n🔀 Merging with existing data...');

    // Insérer les nouveaux matchs dans github_games
    await this.duckdb.run(`
      INSERT OR REPLACE INTO github_games
      SELECT * FROM nba_games_new
    `);

    // Supprimer la table temporaire
    await this.duckdb.run(`DROP TABLE IF EXISTS nba_games_new`);

    console.log('   ✅ Merge complete');
  }

  private generateDates(start: string, end: string): string[] {
    const dates: string[] = [];
    const startDate = new Date(
      parseInt(start.slice(0, 4)),
      parseInt(start.slice(4, 6)) - 1,
      parseInt(start.slice(6, 8))
    );
    const endDate = new Date(
      parseInt(end.slice(0, 4)),
      parseInt(end.slice(4, 6)) - 1,
      parseInt(end.slice(6, 8))
    );

    const current = new Date(startDate);
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      dates.push(`${year}${month}${day}`);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI entry point
async function main() {
  const fetcher = new MissingGamesFetcher();
  await fetcher.fetchAll();
}

if (require.main === module) {
  main().catch(console.error);
}

export default MissingGamesFetcher;
