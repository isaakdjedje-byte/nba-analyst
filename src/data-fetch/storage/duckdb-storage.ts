/**
 * DuckDB Storage
 * High-performance analytics storage for ML training data
 */

import * as duckdb from 'duckdb';
import { MasterGame } from '../types/game.types';
import { loadConfig } from '../config/fetch.config';

export class DuckDBStorage {
  private db: duckdb.Database | null = null;
  private config = loadConfig().storage.duckdb;

  constructor() {
    if (!this.config.enabled) {
      throw new Error('DuckDB storage is disabled');
    }
  }

  /**
   * Initialize database connection and tables
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new duckdb.Database(this.config.path, (err) => {
        if (err) {
          reject(new Error(`Failed to open DuckDB: ${err.message}`));
          return;
        }
        
        console.log(`✓ Connected to DuckDB: ${this.config.path}`);
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  /**
   * Create tables if they don't exist
   */
  private async createTables(): Promise<void> {
    const tables = [
      // Raw games data
      `CREATE TABLE IF NOT EXISTS raw_games (
        game_id VARCHAR PRIMARY KEY,
        date DATE,
        season INTEGER,
        home_team VARCHAR,
        away_team VARCHAR,
        home_score INTEGER,
        away_score INTEGER,
        winner VARCHAR,
        home_boxscore JSON,
        away_boxscore JSON,
        home_players JSON,
        away_players JSON,
        play_by_play JSON,
        shot_charts JSON,
        hustle_stats JSON,
        sources JSON,
        data_quality FLOAT,
        fetched_at TIMESTAMP
      )`,

      // Player stats flattened
      `CREATE TABLE IF NOT EXISTS player_stats (
        game_id VARCHAR,
        player_id VARCHAR,
        player_name VARCHAR,
        team VARCHAR,
        is_starter BOOLEAN,
        minutes FLOAT,
        pts INTEGER,
        fg INTEGER,
        fga INTEGER,
        fg_pct FLOAT,
        tp INTEGER,
        tpa INTEGER,
        tp_pct FLOAT,
        ft INTEGER,
        fta INTEGER,
        ft_pct FLOAT,
        orb INTEGER,
        drb INTEGER,
        trb INTEGER,
        ast INTEGER,
        stl INTEGER,
        blk INTEGER,
        tov INTEGER,
        pf INTEGER,
        plus_minus INTEGER,
        ts_pct FLOAT,
        efg_pct FLOAT,
        usg_pct FLOAT,
        avg_speed FLOAT,
        distance_miles FLOAT,
        touches INTEGER,
        passes INTEGER,
        contested_shots INTEGER,
        deflections INTEGER,
        PRIMARY KEY (game_id, player_id)
      )`,

      // Team stats summary
      `CREATE TABLE IF NOT EXISTS team_stats (
        game_id VARCHAR,
        team VARCHAR,
        is_home BOOLEAN,
        pts INTEGER,
        fg INTEGER,
        fga INTEGER,
        fg_pct FLOAT,
        tp INTEGER,
        tpa INTEGER,
        tp_pct FLOAT,
        ft INTEGER,
        fta INTEGER,
        ft_pct FLOAT,
        orb INTEGER,
        drb INTEGER,
        trb INTEGER,
        ast INTEGER,
        stl INTEGER,
        blk INTEGER,
        tov INTEGER,
        pf INTEGER,
        efg_pct FLOAT,
        tov_pct FLOAT,
        orb_pct FLOAT,
        ft_rate FLOAT,
        off_rating FLOAT,
        def_rating FLOAT,
        pace FLOAT,
        paint_pts INTEGER,
        fast_break_pts INTEGER,
        second_chance_pts INTEGER,
        PRIMARY KEY (game_id, team)
      )`,

      // Shot data
      `CREATE TABLE IF NOT EXISTS shots (
        game_id VARCHAR,
        player_id VARCHAR,
        player_name VARCHAR,
        team VARCHAR,
        period INTEGER,
        minutes_remaining INTEGER,
        seconds_remaining INTEGER,
        loc_x FLOAT,
        loc_y FLOAT,
        shot_zone VARCHAR,
        shot_distance FLOAT,
        shot_made BOOLEAN,
        shot_type VARCHAR,
        action_type VARCHAR
      )`,
    ];

    for (const sql of tables) {
      await this.run(sql);
    }

    console.log('✓ Tables created');
  }

  /**
   * Save games to database
   */
  async saveGames(games: MasterGame[]): Promise<void> {
    if (games.length === 0) return;

    console.log(`Saving ${games.length} games to DuckDB...`);

    // Insert games in batches
    const batchSize = 100;
    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      await this.insertGameBatch(batch);
      console.log(`  Saved ${Math.min(i + batchSize, games.length)}/${games.length}`);
    }

    // Insert related data
    await this.savePlayerStats(games);
    await this.saveTeamStats(games);
    await this.saveShots(games);
  }

  /**
   * Insert batch of games
   */
  private async insertGameBatch(games: MasterGame[]): Promise<void> {
    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO raw_games 
      (game_id, date, season, home_team, away_team, home_score, away_score, winner,
       home_boxscore, away_boxscore, home_players, away_players, play_by_play,
       shot_charts, hustle_stats, sources, data_quality, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const game of games) {
      await new Promise<void>((resolve, reject) => {
        stmt.run(
          game.game_id,
          game.date,
          game.season,
          game.home_team,
          game.away_team,
          game.home_score,
          game.away_score,
          game.winner,
          JSON.stringify(game.home_boxscore),
          JSON.stringify(game.away_boxscore),
          JSON.stringify(game.home_players),
          JSON.stringify(game.away_players),
          JSON.stringify(game.play_by_play),
          JSON.stringify(game.shot_charts || []),
          JSON.stringify(game.hustle_stats || []),
          JSON.stringify(game._sources),
          game._data_quality,
          game._fetched_at,
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    stmt.finalize();
  }

  /**
   * Save player stats
   */
  private async savePlayerStats(games: MasterGame[]): Promise<void> {
    const allPlayers: Array<Record<string, unknown>> = [];

    for (const game of games) {
      for (const player of game.home_players) {
        allPlayers.push({ ...player, game_id: game.game_id, team: game.home_team });
      }
      for (const player of game.away_players) {
        allPlayers.push({ ...player, game_id: game.game_id, team: game.away_team });
      }
    }

    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO player_stats
      (game_id, player_id, player_name, team, is_starter, minutes, pts, fg, fga, fg_pct,
       tp, tpa, tp_pct, ft, fta, ft_pct, orb, drb, trb, ast, stl, blk, tov, pf, plus_minus,
       ts_pct, efg_pct, usg_pct, avg_speed, distance_miles, touches, passes, contested_shots, deflections)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of allPlayers) {
      await new Promise<void>((resolve, reject) => {
        stmt.run(
          p.game_id,
          p.player_id,
          p.player_name,
          p.team,
          p.is_starter,
          p.mp,
          p.pts,
          p.fg,
          p.fga,
          p.fg_pct,
          p.tp,
          p.tpa,
          p.tp_pct,
          p.ft,
          p.fta,
          p.ft_pct,
          p.orb,
          p.drb,
          p.trb,
          p.ast,
          p.stl,
          p.blk,
          p.tov,
          p.pf,
          p.plus_minus,
          p.ts_pct,
          p.efg_pct,
          p.usg_pct,
          p.avg_speed,
          p.distance_miles,
          p.touches,
          p.passes,
          p.contested_shots,
          p.deflections,
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    stmt.finalize();
    console.log(`  ✓ Saved ${allPlayers.length} player records`);
  }

  /**
   * Save team stats
   */
  private async saveTeamStats(games: MasterGame[]): Promise<void> {
    const teams: Array<Record<string, unknown>> = [];

    for (const game of games) {
      teams.push({
        game_id: game.game_id,
        team: game.home_team,
        is_home: true,
        ...game.home_boxscore,
      });
      teams.push({
        game_id: game.game_id,
        team: game.away_team,
        is_home: false,
        ...game.away_boxscore,
      });
    }

    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO team_stats
      (game_id, team, is_home, pts, fg, fga, fg_pct, tp, tpa, tp_pct, ft, fta, ft_pct,
       orb, drb, trb, ast, stl, blk, tov, pf, efg_pct, tov_pct, orb_pct, ft_rate,
       off_rating, def_rating, pace, paint_pts, fast_break_pts, second_chance_pts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of teams) {
      const ff = (t.four_factors || {}) as Record<string, number>;
      await new Promise<void>((resolve, reject) => {
        stmt.run(
          t.game_id,
          t.team,
          t.is_home,
          t.pts,
          t.fg,
          t.fga,
          t.fg_pct,
          t.tp,
          t.tpa,
          t.tp_pct,
          t.ft,
          t.fta,
          t.ft_pct,
          t.orb,
          t.drb,
          t.trb,
          t.ast,
          t.stl,
          t.blk,
          t.tov,
          t.pf,
          ff.efg_pct,
          ff.tov_pct,
          ff.orb_pct,
          ff.ft_rate,
          t.offensive_rating,
          t.defensive_rating,
          t.pace,
          t.paint_pts,
          t.fast_break_pts,
          t.second_chance_pts,
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    stmt.finalize();
    console.log(`  ✓ Saved ${teams.length} team records`);
  }

  /**
   * Save shot data
   */
  private async saveShots(games: MasterGame[]): Promise<void> {
    const shots: Array<Record<string, unknown>> = [];

    for (const game of games) {
      if (game.shot_charts) {
        for (const shot of game.shot_charts) {
          shots.push({
            game_id: game.game_id,
            ...shot,
          });
        }
      }
    }

    if (shots.length === 0) return;

    const stmt = this.db!.prepare(`
      INSERT INTO shots
      (game_id, player_id, player_name, team, period, minutes_remaining, seconds_remaining,
       loc_x, loc_y, shot_zone, shot_distance, shot_made, shot_type, action_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of shots) {
      await new Promise<void>((resolve, reject) => {
        stmt.run(
          s.game_id,
          s.player_id,
          s.player_name,
          s.team,
          s.period,
          s.minutes_remaining,
          s.seconds_remaining,
          s.loc_x,
          s.loc_y,
          s.shot_zone,
          s.shot_distance,
          s.shot_made,
          s.shot_type,
          s.action_type,
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    stmt.finalize();
    console.log(`  ✓ Saved ${shots.length} shot records`);
  }

  /**
   * Query helper
   */
  async query(sql: string): Promise<Array<Record<string, unknown>>> {
    return new Promise((resolve, reject) => {
      this.db!.all(sql, (err: Error | null, rows: Array<Record<string, unknown>>) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Run SQL helper
   */
  public async run(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run(sql, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
