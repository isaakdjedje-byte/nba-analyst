/**
 * Type definitions for NBA game data
 * Multi-source unified types
 */

// Core game identification
export interface GameCore {
  game_id: string;                    // B-Ref format: 202403010LAL
  nba_api_id?: string;               // NBA API format: 0022300961
  date: Date;
  season: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  winner: 'HOME' | 'AWAY';
}

// Four Factors (piliers analytics NBA)
export interface FourFactors {
  efg_pct: number;       // Effective Field Goal %
  tov_pct: number;       // Turnover %
  orb_pct: number;       // Offensive Rebound %
  ft_rate: number;       // Free Throw Rate
}

// Traditional box score stats
export interface BoxScoreStats {
  mp: number;            // Minutes played
  fg: number;
  fga: number;
  fg_pct: number;
  tp: number;            // 3-pointers
  tpa: number;
  tp_pct: number;
  ft: number;
  fta: number;
  ft_pct: number;
  orb: number;
  drb: number;
  trb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  pts: number;
  plus_minus: number;
}

// Player stats with advanced metrics
export interface PlayerStats extends BoxScoreStats {
  player_id: string;
  player_name: string;
  team: string;
  is_starter: boolean;
  
  // Advanced (B-Ref)
  ts_pct?: number;       // True Shooting %
  efg_pct?: number;      // Effective FG%
  orb_pct?: number;      // Offensive Rebound %
  drb_pct?: number;      // Defensive Rebound %
  trb_pct?: number;      // Total Rebound %
  ast_pct?: number;      // Assist %
  stl_pct?: number;      // Steal %
  blk_pct?: number;      // Block %
  tov_pct?: number;      // Turnover %
  usg_pct?: number;      // Usage %
  
  // Tracking (NBA API)
  avg_speed?: number;    // Average speed
  distance_miles?: number; // Distance traveled
  touches?: number;
  passes?: number;
  secondary_assists?: number;
  free_throw_assists?: number;
}

// Team-level box score
export interface TeamBoxScore extends BoxScoreStats {
  team: string;
  four_factors: FourFactors;
  
  // Advanced team stats
  offensive_rating?: number;
  defensive_rating?: number;
  pace?: number;
  
  // Tracking stats (NBA API)
  paint_pts?: number;
  fast_break_pts?: number;
  second_chance_pts?: number;
  points_off_turnovers?: number;
  bench_pts?: number;
}

// Shot chart data (NBA API)
export interface Shot {
  player_id: string;
  player_name: string;
  team: string;
  period: number;
  time_remaining: string;
  x: number;             // Court coordinates
  y: number;
  shot_zone: 'PAINT' | 'MID_RANGE' | 'CORNER_3' | 'ABOVE_BREAK_3';
  shot_distance: number;
  shot_attempted: boolean;
  shot_made: boolean;
  shot_type: '2PT' | '3PT';
  action_type: string;   // Jump shot, layup, etc.
  shot_contested?: boolean;
  shot_clock?: number;
}

// Play-by-play event
export interface PlayEvent {
  event_id: number;
  period: number;
  time_remaining: string;
  description: string;
  team?: string;
  player?: string;
  action: 'SHOT' | 'REBOUND' | 'ASSIST' | 'TURNOVER' | 'FOUL' | 'SUB' | 'TIMEOUT' | 'JUMP_BALL' | string;
  
  // Shot details (if available)
  shot_x?: number;
  shot_y?: number;
  shot_zone?: string;
  shot_distance?: number;
  shot_made?: boolean;
  
  // Score update
  home_score?: number;
  away_score?: number;
}

// Hustle stats (NBA API)
export interface HustleStats {
  player_id: string;
  player_name: string;
  team: string;
  contested_shots: number;
  contested_shots_2pt: number;
  contested_shots_3pt: number;
  deflections: number;
  loose_balls_recovered: number;
  charges_drawn: number;
  screen_assists: number;
  screen_assist_pts: number;
  off_boxouts: number;
  def_boxouts: number;
}

// Complete game data from all sources
export interface MasterGame extends GameCore {
  // Box scores
  home_boxscore: TeamBoxScore;
  away_boxscore: TeamBoxScore;
  
  // Player stats
  home_players: PlayerStats[];
  away_players: PlayerStats[];
  
  // Play-by-play
  play_by_play: PlayEvent[];
  
  // Optional NBA API data
  shot_charts?: Shot[];
  hustle_stats?: HustleStats[];
  
  // Metadata
  _sources: string[];
  _data_quality: number;
  _fetched_at: Date;
}

// Fetch progress tracking
export interface FetchProgress {
  current_season: number;
  current_game: number;
  total_games_season: number;
  completed_games: string[];
  failed_games: Array<{ game_id: string; error: string }>;
  start_time: Date;
  estimated_completion: Date;
  last_checkpoint: Date;
}

// Validation result
export interface ValidationResult {
  is_valid: boolean;
  issues: string[];
  confidence_score: number;
}
