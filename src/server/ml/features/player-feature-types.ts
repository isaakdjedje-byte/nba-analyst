/**
 * Player Feature Types
 * Phase 4 Implementation - Feature Engineering with Player Data
 */

export interface PlayerFeatures {
  // Individual player performance
  playerId: number;
  seasonAvgPoints: number;
  seasonAvgMinutes: number;
  recentForm: number;        // Last 5 games trend
  efficiency: number;        // PER or custom metric

  // Context
  isStarter: boolean;
  daysRest: number;
  matchupsAdvantage: number; // vs opponent position
}

export interface TeamRosterFeatures {
  // Aggregated roster strength
  top3PlayersAvgPoints: number;
  top3PlayersAvgEfficiency: number;
  rosterDepth: number;        // Std dev of player ratings
  startersStrength: number;
  benchStrength: number;

  // Availability
  keyPlayersOut: number;      // Star players injured
  totalPlayersOut: number;
  injuryImpactScore: number;  // Calculated impact
}

export interface KeyPlayerFeatures {
  // Star players (top 3 by minutes/points)
  homeStarPlayers: PlayerFeatures[];
  awayStarPlayers: PlayerFeatures[];

  // Matchup analysis
  starMatchupAdvantage: number;  // -1 to 1
  clutchPerformance: number;     // Performance in close games
}

// Enhanced ModelFeatures
export interface EnhancedModelFeatures {
  // Existing features from base ModelFeatures
  homeWinPct: number;
  awayWinPct: number;
  homePointsAvg: number;
  awayPointsAvg: number;
  homeRecentForm: number;
  awayRecentForm: number;
  h2hHomeWins: number;
  h2hTotalGames: number;

  // NEW: Player-level features
  homeRosterStrength: number;
  awayRosterStrength: number;
  rosterStrengthDiff: number;    // Normalized -1 to 1

  homeTop3AvgPoints: number;
  awayTop3AvgPoints: number;
  top3PointsDiff: number;

  homeKeyPlayersOut: number;
  awayKeyPlayersOut: number;
  keyPlayersOutDiff: number;

  homeStarForm: number;          // Recent form of stars
  awayStarForm: number;
  starFormDiff: number;

  injuryImpactHome: number;       // 0 to 1 (0 = no impact)
  injuryImpactAway: number;

  // Matchup advantages by position
  pgMatchupAdvantage: number;
  sgMatchupAdvantage: number;
  sfMatchupAdvantage: number;
  pfMatchupAdvantage: number;
  cMatchupAdvantage: number;
}
