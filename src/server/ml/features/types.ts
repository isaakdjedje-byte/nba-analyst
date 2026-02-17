/**
 * Feature Store Types
 * 
 * Defines feature types for NBA match prediction model.
 * Features are computed from historical data and current context.
 */

// =============================================================================
// RAW FEATURES (Computed from data sources)
// =============================================================================

export interface TeamFeatures {
  // Identification
  teamId: number;
  teamName: string;
  abbreviation: string;
  conference: 'East' | 'West';
  
  // Season performance (computed from box scores)
  games: number; // Total games played
  wins: number;
  losses: number;
  winRate: number; // 0-1
  
  // Offensive stats (last 10 games average)
  pointsScoredAvg: number;
  fieldGoalPercentage: number;
  threePointPercentage: number;
  freeThrowPercentage: number;
  assistsAvg: number;
  offensiveRating: number;
  
  // Defensive stats (last 10 games average)
  pointsAllowedAvg: number;
  reboundsAvg: number;
  stealsAvg: number;
  blocksAvg: number;
  turnoversAvg: number;
  defensiveRating: number;
  
  // Form (last 5 games)
  last5WinRate: number; // 0-1
  last5PointsAvg: number;
  last5PointsAllowedAvg: number;
  
  // Home/Away splits
  homeWinRate: number; // 0-1
  awayWinRate: number; // 0-1
  
  // Rest and schedule
  daysSinceLastGame: number;
  backToBack: boolean; // Played yesterday
  restAdvantage: number; // Days more rest than opponent
}

export interface MatchupFeatures {
  // Head-to-head
  h2hHomeWins: number; // Last 5 meetings
  h2hAwayWins: number;
  h2hAvgPointDiff: number; // Positive = home team advantage
  
  // Previous meeting this season
  previousMeetingDate?: Date;
  previousMeetingHomeWin?: boolean;
  previousMeetingPointDiff?: number;
}

export interface ContextFeatures {
  // Game context
  isPlayoff: boolean;
  isBackToBackForEither: boolean;
  daysRestDiff: number; // Home team rest - away team rest
  
  // Market features
  homeTeamSpread?: number; // From odds API
  overUnder?: number;
  homeMoneylineOdds?: number;
  awayMoneylineOdds?: number;
  
  // Time features
  dayOfWeek: number; // 0-6
  month: number; // 0-11
  isWeekend: boolean;
}

// =============================================================================
// MODEL FEATURES (Normalized and combined)
// =============================================================================

export interface ModelFeatures {
  // Home team normalized features (-1 to 1)
  homeWinRate: number;
  homeOffensiveRating: number;
  homeDefensiveRating: number;
  homeForm: number; // Last 5 win rate
  homeRestAdvantage: number; // Normalized
  
  // Away team normalized features (-1 to 1)
  awayWinRate: number;
  awayOffensiveRating: number;
  awayDefensiveRating: number;
  awayForm: number;
  
  // Matchup features
  homeAdvantage: number; // Historical home win rate vs this opponent
  h2hAdvantage: number; // Recent H2H performance
  matchupStrength: number; // Combined team strength diff
  
  // Context
  isBackToBack: number; // 0 or 1
  daysRestDiff: number; // Normalized
  isPlayoff: number; // 0 or 1
  
  // Market (if available)
  spreadDiff?: number; // From market
  publicBettingPercent?: number; // Percent on home team
}

// =============================================================================
// FEATURE STORE RECORD
// =============================================================================

export interface FeatureRecord {
  id: string;
  matchId: string;
  homeTeamId: number;
  awayTeamId: number;
  matchDate: Date;
  
  // Computed features
  homeFeatures: TeamFeatures;
  awayFeatures: TeamFeatures;
  matchupFeatures: MatchupFeatures;
  contextFeatures: ContextFeatures;
  modelFeatures: ModelFeatures;
  
  // Metadata
  computedAt: Date;
  dataVersion: string; // Hash of source data
  freshnessScore: number; // 0-1 based on data age
}

// =============================================================================
// FEATURE ENGINEERING CONFIG
// =============================================================================

export interface FeatureEngineeringConfig {
  // Historical window sizes
  seasonGamesWindow: number;
  lastNGamesWindow: number;
  h2hWindow: number;
  
  // Normalization params (computed from training data)
  normalizationParams?: {
    pointsMean: number;
    pointsStd: number;
    ratingMean: number;
    ratingStd: number;
  };
  
  // Feature weights (for ensemble)
  featureWeights?: Record<string, number>;
}

export const DEFAULT_FEATURE_CONFIG: FeatureEngineeringConfig = {
  seasonGamesWindow: 82, // Full season
  lastNGamesWindow: 10, // Last 10 for form
  h2hWindow: 5, // Last 5 meetings
};

// =============================================================================
// FEATURE VALIDATION
// =============================================================================

export interface FeatureValidationResult {
  valid: boolean;
  missingFeatures: string[];
  staleFeatures: string[];
  qualityScore: number; // 0-1
}

// =============================================================================
// FEATURE STORE QUERIES
// =============================================================================

export interface FeatureQuery {
  teamId?: number;
  matchDate?: Date;
  dateRange?: { start: Date; end: Date };
  limit?: number;
}

export interface TeamHistoricalStats {
  teamId: number;
  season: number;
  games: number;
  wins: number;
  avgPointsScored: number;
  avgPointsAllowed: number;
  avgOffensiveRating: number;
  avgDefensiveRating: number;
}
