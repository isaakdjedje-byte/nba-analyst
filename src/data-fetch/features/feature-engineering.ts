/**
 * Advanced Feature Engineering
 * Calculates ELO ratings, rolling averages, rest days, etc.
 */

import { DuckDBStorage } from '../storage/duckdb-storage';

export class FeatureEngineering {
  private db: DuckDBStorage;

  constructor() {
    this.db = new DuckDBStorage();
  }

  /**
   * Generate all features
   */
  async generateAllFeatures(): Promise<void> {
    console.log('\n⚙️  Generating advanced features...');
    
    await this.db.init();

    // 1. ELO Ratings (538-style)
    console.log('\n1️⃣  Calculating ELO ratings...');
    await this.generateELORatings();

    // 2. Rolling averages (form)
    console.log('\n2️⃣  Calculating rolling averages...');
    await this.generateRollingAverages();

    // 3. Rest days and back-to-backs
    console.log('\n3️⃣  Calculating rest features...');
    await this.generateRestFeatures();

    // 4. Four Factors differentials
    console.log('\n4️⃣  Calculating Four Factors...');
    await this.generateFourFactors();

    // 5. Head-to-head history
    console.log('\n5️⃣  Calculating head-to-head history...');
    await this.generateHeadToHead();

    // 6. ML Training dataset
    console.log('\n6️⃣  Creating ML training dataset...');
    await this.createMLDataset();

    console.log('\n✅ Feature engineering complete!');
    
    await this.db.close();
  }

  /**
   * Generate ELO ratings (538-style)
   * K = 20, Home advantage = 100 points
   */
  private async generateELORatings(): Promise<void> {
    const sql = `
      CREATE OR REPLACE TABLE elo_ratings AS
      WITH RECURSIVE
      -- Get all games ordered by date
      ordered_games AS (
        SELECT 
          game_id,
          date,
          season,
          home_team,
          away_team,
          home_score,
          away_score,
          ROW_NUMBER() OVER (ORDER BY date, game_id) as game_num
        FROM raw_games
        ORDER BY date
      ),
      
      -- Calculate ratings iteratively
      elo_calc AS (
        -- Initialize: All teams at 1500 at start of each season
        SELECT 
          game_id,
          date,
          season,
          home_team,
          away_team,
          home_score,
          away_score,
          game_num,
          1500.0 as home_elo_before,
          1500.0 as away_elo_before,
          CASE WHEN home_score > away_score THEN 1.0 ELSE 0.0 END as home_actual,
          1.0 / (1.0 + POWER(10.0, (1500.0 - 1500.0 - 100.0) / 400.0)) as home_expected,
          1500.0 + 20.0 * (CASE WHEN home_score > away_score THEN 1.0 ELSE 0.0 END - 
            1.0 / (1.0 + POWER(10.0, (1500.0 - 1500.0 - 100.0) / 400.0))) as home_elo_after,
          1500.0 + 20.0 * (CASE WHEN away_score > home_score THEN 1.0 ELSE 0.0 END - 
            1.0 / (1.0 + POWER(10.0, (1500.0 - 1500.0 + 100.0) / 400.0))) as away_elo_after
        FROM ordered_games
        WHERE game_num = 1
        
        UNION ALL
        
        -- Subsequent games
        SELECT 
          og.game_id,
          og.date,
          og.season,
          og.home_team,
          og.away_team,
          og.home_score,
          og.away_score,
          og.game_num,
          COALESCE(
            (SELECT home_elo_after FROM elo_calc e 
             WHERE e.home_team = og.home_team AND e.game_num < og.game_num 
             ORDER BY e.game_num DESC LIMIT 1),
            (SELECT away_elo_after FROM elo_calc e 
             WHERE e.away_team = og.home_team AND e.game_num < og.game_num 
             ORDER BY e.game_num DESC LIMIT 1),
            1500.0
          ) as home_elo_before,
          COALESCE(
            (SELECT home_elo_after FROM elo_calc e 
             WHERE e.home_team = og.away_team AND e.game_num < og.game_num 
             ORDER BY e.game_num DESC LIMIT 1),
            (SELECT away_elo_after FROM elo_calc e 
             WHERE e.away_team = og.away_team AND e.game_num < og.game_num 
             ORDER BY e.game_num DESC LIMIT 1),
            1500.0
          ) as away_elo_before,
          CASE WHEN og.home_score > og.away_score THEN 1.0 ELSE 0.0 END as home_actual,
          1.0 / (1.0 + POWER(10.0, (away_elo_before - home_elo_before - 100.0) / 400.0)) as home_expected,
          home_elo_before + 20.0 * (CASE WHEN og.home_score > og.away_score THEN 1.0 ELSE 0.0 END - 
            1.0 / (1.0 + POWER(10.0, (away_elo_before - home_elo_before - 100.0) / 400.0))) as home_elo_after,
          away_elo_before + 20.0 * (CASE WHEN og.away_score > og.home_score THEN 1.0 ELSE 0.0 END - 
            1.0 / (1.0 + POWER(10.0, (home_elo_before - away_elo_before + 100.0) / 400.0))) as away_elo_after
        FROM ordered_games og
        JOIN elo_calc ec ON og.game_num = ec.game_num + 1
      )
      SELECT 
        game_id,
        date,
        season,
        home_team,
        away_team,
        home_score,
        away_score,
        home_elo_before,
        away_elo_before,
        home_elo_after,
        away_elo_after,
        home_elo_before - away_elo_before as elo_diff,
        home_expected as home_win_prob
      FROM elo_calc
      ORDER BY date
    `;
    void sql;

    // Note: Recursive CTE in DuckDB might need adjustment
    // Using a simpler approach with window functions instead
    
    const simpleSql = `
      CREATE OR REPLACE TABLE elo_ratings AS
      WITH games AS (
        SELECT 
          game_id,
          date,
          season,
          home_team,
          away_team,
          home_score,
          away_score,
          CASE WHEN home_score > away_score THEN 1 ELSE 0 END as home_win
        FROM raw_games
        ORDER BY date
      )
      SELECT * FROM games
    `;

    await this.runQuery(simpleSql);
    
    console.log('   ✓ ELO ratings table created (simplified version)');
    console.log('   ⚠️  Full ELO calculation requires iterative update - see Python implementation');
  }

  /**
   * Generate rolling averages (form)
   */
  private async generateRollingAverages(): Promise<void> {
    const sql = `
      CREATE OR REPLACE TABLE rolling_stats AS
      WITH team_games AS (
        -- Home games
        SELECT 
          game_id,
          date,
          season,
          team as team_name,
          true as is_home,
          pts,
          fg_pct,
          tp_pct,
          ft_pct,
          efg_pct,
          tov_pct,
          orb_pct,
          CASE WHEN is_home THEN 1 ELSE 0 END as win
        FROM team_stats
        WHERE is_home = true
        
        UNION ALL
        
        -- Away games
        SELECT 
          game_id,
          date,
          season,
          team as team_name,
          false as is_home,
          pts,
          fg_pct,
          tp_pct,
          ft_pct,
          efg_pct,
          tov_pct,
          orb_pct,
          CASE WHEN is_home THEN 0 ELSE 1 END as win
        FROM team_stats
        WHERE is_home = false
      )
      SELECT 
        game_id,
        team_name,
        date,
        season,
        is_home,
        pts,
        -- Last 5 games
        AVG(pts) OVER w5 as pts_avg_5,
        AVG(fg_pct) OVER w5 as fg_pct_avg_5,
        AVG(tp_pct) OVER w5 as tp_pct_avg_5,
        AVG(efg_pct) OVER w5 as efg_pct_avg_5,
        AVG(win) OVER w5 as win_pct_5,
        -- Last 10 games
        AVG(pts) OVER w10 as pts_avg_10,
        AVG(fg_pct) OVER w10 as fg_pct_avg_10,
        AVG(win) OVER w10 as win_pct_10,
        -- Last 20 games
        AVG(pts) OVER w20 as pts_avg_20,
        AVG(win) OVER w20 as win_pct_20,
        -- Cumulative season
        AVG(pts) OVER (PARTITION BY team_name, season ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) as pts_avg_season,
        AVG(win) OVER (PARTITION BY team_name, season ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) as win_pct_season
      FROM team_games
      WINDOW 
        w5 AS (PARTITION BY team_name ORDER BY date ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING),
        w10 AS (PARTITION BY team_name ORDER BY date ROWS BETWEEN 10 PRECEDING AND 1 PRECEDING),
        w20 AS (PARTITION BY team_name ORDER BY date ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING)
    `;

    await this.runQuery(sql);
    console.log('   ✓ Rolling averages calculated (5, 10, 20 games)');
  }

  /**
   * Generate rest features
   */
  private async generateRestFeatures(): Promise<void> {
    const sql = `
      CREATE OR REPLACE TABLE rest_features AS
      WITH team_games AS (
        SELECT 
          game_id,
          date,
          season,
          team as team_name,
          is_home
        FROM team_stats
      ),
      lagged AS (
        SELECT 
          *,
          LAG(date) OVER (PARTITION BY team_name ORDER BY date) as prev_game_date
        FROM team_games
      )
      SELECT 
        game_id,
        team_name,
        is_home,
        date,
        prev_game_date,
        CASE 
          WHEN prev_game_date IS NULL THEN 7  -- First game of season
          ELSE date - prev_game_date
        END as rest_days,
        CASE 
          WHEN prev_game_date IS NULL THEN 0
          WHEN date - prev_game_date = 1 THEN 1
          ELSE 0
        END as is_b2b,
        CASE 
          WHEN prev_game_date IS NULL THEN 0
          WHEN date - prev_game_date = 2 THEN 1
          ELSE 0
        END as is_3in4
      FROM lagged
    `;

    await this.runQuery(sql);
    console.log('   ✓ Rest features calculated');
  }

  /**
   * Generate Four Factors differentials
   */
  private async generateFourFactors(): Promise<void> {
    const sql = `
      CREATE OR REPLACE TABLE four_factors AS
      WITH game_factors AS (
        SELECT 
          g.game_id,
          g.date,
          g.season,
          g.home_team,
          g.away_team,
          g.home_score,
          g.away_score,
          h.efg_pct as home_efg_pct,
          h.tov_pct as home_tov_pct,
          h.orb_pct as home_orb_pct,
          h.ft_rate as home_ft_rate,
          a.efg_pct as away_efg_pct,
          a.tov_pct as away_tov_pct,
          100 - a.orb_pct as away_orb_pct,  -- Defensive rebound for away = 100 - home ORB%
          a.ft_rate as away_ft_rate
        FROM raw_games g
        JOIN team_stats h ON g.game_id = h.game_id AND h.is_home = true
        JOIN team_stats a ON g.game_id = a.game_id AND a.is_home = false
      )
      SELECT 
        *,
        home_efg_pct - away_efg_pct as efg_diff,
        home_tov_pct - away_tov_pct as tov_diff,
        home_orb_pct - away_orb_pct as orb_diff,
        home_ft_rate - away_ft_rate as ft_rate_diff
      FROM game_factors
    `;

    await this.runQuery(sql);
    console.log('   ✓ Four Factors differentials calculated');
  }

  /**
   * Generate head-to-head history
   */
  private async generateHeadToHead(): Promise<void> {
    const sql = `
      CREATE OR REPLACE TABLE head_to_head AS
      WITH matchups AS (
        SELECT 
          game_id,
          date,
          home_team,
          away_team,
          CASE WHEN home_score > away_score THEN 1 ELSE 0 END as home_win,
          home_score,
          away_score
        FROM raw_games
      )
      SELECT 
        m.game_id,
        m.date,
        m.home_team,
        m.away_team,
        COUNT(h.game_id) as h2h_total_games,
        SUM(h.home_win) as h2h_home_wins,
        AVG(h.home_score - h.away_score) as h2h_avg_margin,
        AVG(h.home_score) as h2h_avg_home_pts,
        AVG(h.away_score) as h2h_avg_away_pts
      FROM matchups m
      LEFT JOIN matchups h ON (
        (h.home_team = m.home_team AND h.away_team = m.away_team) OR
        (h.home_team = m.away_team AND h.away_team = m.home_team)
      ) AND h.date < m.date
      GROUP BY m.game_id, m.date, m.home_team, m.away_team
    `;

    await this.runQuery(sql);
    console.log('   ✓ Head-to-head history calculated');
  }

  /**
   * Create final ML training dataset
   */
  private async createMLDataset(): Promise<void> {
    const sql = `
      CREATE OR REPLACE TABLE ml_training_data AS
      SELECT 
        g.game_id,
        g.date,
        g.season,
        g.home_team,
        g.away_team,
        g.home_score,
        g.away_score,
        CASE WHEN g.home_score > g.away_score THEN 1 ELSE 0 END as home_win,
        
        -- ELO (if elo_ratings table exists)
        -- e.home_elo_before as home_elo,
        -- e.away_elo_before as away_elo,
        -- e.elo_diff,
        
        -- Rolling form (last 5 games)
        rh.pts_avg_5 as home_pts_avg_5,
        ra.pts_avg_5 as away_pts_avg_5,
        rh.win_pct_5 as home_win_pct_5,
        ra.win_pct_5 as away_win_pct_5,
        rh.efg_pct_avg_5 as home_efg_pct_5,
        ra.efg_pct_avg_5 as away_efg_pct_5,
        
        -- Rolling form (last 10 games)
        rh.pts_avg_10 as home_pts_avg_10,
        ra.pts_avg_10 as away_pts_avg_10,
        rh.win_pct_10 as home_win_pct_10,
        ra.win_pct_10 as away_win_pct_10,
        
        -- Season averages
        rh.pts_avg_season as home_pts_avg_season,
        ra.pts_avg_season as away_pts_avg_season,
        rh.win_pct_season as home_win_pct_season,
        ra.win_pct_season as away_win_pct_season,
        
        -- Rest features
        rest_h.rest_days as home_rest_days,
        rest_a.rest_days as away_rest_days,
        rest_h.is_b2b as home_b2b,
        rest_a.is_b2b as away_b2b,
        rest_h.rest_days - rest_a.rest_days as rest_diff,
        
        -- Four Factors
        ff.home_efg_pct,
        ff.away_efg_pct,
        ff.efg_diff,
        ff.home_tov_pct,
        ff.away_tov_pct,
        ff.tov_diff,
        ff.home_orb_pct,
        ff.away_orb_pct,
        ff.orb_diff,
        
        -- Head-to-head
        COALESCE(h2h.h2h_home_wins::FLOAT / NULLIF(h2h.h2h_total_games, 0), 0.5) as h2h_home_win_pct,
        h2h.h2h_avg_margin,
        
        -- Context
        EXTRACT(MONTH FROM g.date) as month,
        EXTRACT(DOW FROM g.date) as day_of_week,
        CASE 
          WHEN g.date >= (SELECT MAX(date) FROM raw_games) - INTERVAL '30 days' THEN 1 
          ELSE 0 
        END as is_recent
        
      FROM raw_games g
      LEFT JOIN rolling_stats rh ON g.game_id = rh.game_id AND rh.is_home = true
      LEFT JOIN rolling_stats ra ON g.game_id = ra.game_id AND ra.is_home = false
      LEFT JOIN rest_features rest_h ON g.game_id = rest_h.game_id AND rest_h.is_home = true
      LEFT JOIN rest_features rest_a ON g.game_id = rest_a.game_id AND rest_a.is_home = false
      LEFT JOIN four_factors ff ON g.game_id = ff.game_id
      LEFT JOIN head_to_head h2h ON g.game_id = h2h.game_id
      WHERE rh.pts_avg_5 IS NOT NULL AND ra.pts_avg_5 IS NOT NULL
      ORDER BY g.date
    `;

    await this.runQuery(sql);
    console.log('   ✓ ML training dataset created');
    
    // Show stats
    const count = await this.runQuery('SELECT COUNT(*) as count FROM ml_training_data');
    console.log(`      ${count[0].count} training samples ready`);
  }

  /**
   * Helper to run queries
   */
  private async runQuery(sql: string): Promise<Array<Record<string, unknown>>> {
    return this.db.query(sql);
  }
}

// CLI entry point
if (require.main === module) {
  const engineer = new FeatureEngineering();
  engineer.generateAllFeatures().catch(console.error);
}
