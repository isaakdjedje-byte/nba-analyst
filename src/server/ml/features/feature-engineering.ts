/**
 * Feature Engineering Service
 * 
 * Computes ML features from raw NBA data.
 * Transforms box scores, schedules, and odds into model-ready features.
 */

import {
  TeamFeatures,
  MatchupFeatures,
  ContextFeatures,
  ModelFeatures,
  FeatureRecord,
  FeatureEngineeringConfig,
  DEFAULT_FEATURE_CONFIG,
  FeatureValidationResult,
  TeamHistoricalStats,
} from './types';
import { Game, BoxScore } from '@/server/ingestion/schema/nba-schemas';

// =============================================================================
// FEATURE ENGINEERING SERVICE
// =============================================================================

export class FeatureEngineeringService {
  private config: FeatureEngineeringConfig;
  private cache: Map<string, TeamHistoricalStats> = new Map();

  constructor(config: Partial<FeatureEngineeringConfig> = {}) {
    this.config = { ...DEFAULT_FEATURE_CONFIG, ...config };
  }

  /**
   * Compute features for a specific matchup
   */
  async computeMatchFeatures(
    game: Game,
    homeBoxScores: BoxScore[],
    awayBoxScores: BoxScore[],
    h2hGames: Game[],
    marketData?: {
      spread?: number;
      overUnder?: number;
      homeOdds?: number;
      awayOdds?: number;
    }
  ): Promise<FeatureRecord> {
    const homeTeamId = game.homeTeam.id;
    const awayTeamId = game.awayTeam.id;
    const matchDate = new Date(game.date);

    // Compute team features
    const homeFeatures = await this.computeTeamFeatures(homeTeamId, homeBoxScores, {
      name: game.homeTeam.name,
      abbreviation: game.homeTeam.abbreviation,
      conference: game.homeTeam.conference,
    });
    const awayFeatures = await this.computeTeamFeatures(awayTeamId, awayBoxScores, {
      name: game.awayTeam.name,
      abbreviation: game.awayTeam.abbreviation,
      conference: game.awayTeam.conference,
    });

    // Compute matchup features
    const matchupFeatures = this.computeMatchupFeatures(h2hGames, homeTeamId, awayTeamId);

    // Compute context features
    const contextFeatures = this.computeContextFeatures(game, homeFeatures, awayFeatures, marketData);

    // Combine into model features (normalized)
    const modelFeatures = this.combineFeatures(homeFeatures, awayFeatures, matchupFeatures, contextFeatures);

    // Generate data version hash
    const dataVersion = this.generateDataVersion(game, homeBoxScores.length, awayBoxScores.length);

    // Calculate freshness
    const freshnessScore = this.calculateFreshness(homeBoxScores, awayBoxScores);

    return {
      id: `feat-${game.id}-${Date.now()}`,
      matchId: game.id.toString(),
      homeTeamId,
      awayTeamId,
      matchDate,
      homeFeatures,
      awayFeatures,
      matchupFeatures,
      contextFeatures,
      modelFeatures,
      computedAt: new Date(),
      dataVersion,
      freshnessScore,
    };
  }

  /**
   * Compute features for a single team
   */
  private async computeTeamFeatures(
    teamId: number,
    boxScores: BoxScore[],
    teamMeta: {
      name: string;
      abbreviation: string;
      conference: 'East' | 'West';
    }
  ): Promise<TeamFeatures> {
    const teamName = teamMeta.name;
    const abbreviation = teamMeta.abbreviation;
    const conference = teamMeta.conference;

    // Season stats (all games in window)
    const seasonStats = this.computeSeasonStats(boxScores, teamId);
    
    // Last N games stats
    const lastNStats = this.computeLastNStats(boxScores, teamId, this.config.lastNGamesWindow);
    
    // Home/Away splits
    const splits = this.computeHomeAwaySplits(boxScores, teamId);
    
    // Rest calculation
    const restInfo = this.computeRestInfo(boxScores);

    return {
      teamId,
      teamName,
      abbreviation,
      conference,
      
      // Season record
      games: seasonStats.games,
      wins: seasonStats.wins,
      losses: seasonStats.losses,
      winRate: seasonStats.games > 0 ? seasonStats.wins / seasonStats.games : 0,
      
      // Offensive stats (season average)
      pointsScoredAvg: seasonStats.avgPointsScored,
      fieldGoalPercentage: seasonStats.avgFgPct,
      threePointPercentage: seasonStats.avg3pPct,
      freeThrowPercentage: seasonStats.avgFtPct,
      assistsAvg: seasonStats.avgAssists,
      offensiveRating: this.calculateOffensiveRating(seasonStats),
      
      // Defensive stats
      pointsAllowedAvg: seasonStats.avgPointsAllowed,
      reboundsAvg: seasonStats.avgRebounds,
      stealsAvg: seasonStats.avgSteals,
      blocksAvg: seasonStats.avgBlocks,
      turnoversAvg: seasonStats.avgTurnovers,
      defensiveRating: this.calculateDefensiveRating(seasonStats),
      
      // Form (last 5)
      last5WinRate: lastNStats.winRate,
      last5PointsAvg: lastNStats.avgPointsScored,
      last5PointsAllowedAvg: lastNStats.avgPointsAllowed,
      
      // Splits
      homeWinRate: splits.homeWinRate,
      awayWinRate: splits.awayWinRate,
      
      // Rest
      daysSinceLastGame: restInfo.daysSinceLastGame,
      backToBack: restInfo.backToBack,
      restAdvantage: 0, // Will be computed when we have both teams
    };
  }

  /**
   * Compute season statistics from box scores
   */
  private computeSeasonStats(boxScores: BoxScore[], teamId: number) {
    let wins = 0;
    let losses = 0;
    let totalPointsScored = 0;
    let totalPointsAllowed = 0;
    let totalFgPct = 0;
    let total3pPct = 0;
    let totalFtPct = 0;
    let totalAssists = 0;
    let totalRebounds = 0;
    let totalSteals = 0;
    let totalBlocks = 0;
    let totalTurnovers = 0;
    
    for (const boxScore of boxScores) {
      const isHome = boxScore.homeTeam.teamId === teamId;
      const teamStats = isHome ? boxScore.homeTeam : boxScore.awayTeam;
      const opponentStats = isHome ? boxScore.awayTeam : boxScore.homeTeam;
      
      totalPointsScored += teamStats.points;
      totalPointsAllowed += opponentStats.points;
      totalFgPct += teamStats.fieldGoalPercentage;
      total3pPct += teamStats.threePointPercentage;
      totalFtPct += teamStats.freeThrowPercentage;
      totalAssists += teamStats.assists;
      totalRebounds += teamStats.rebounds;
      totalSteals += teamStats.steals;
      totalBlocks += teamStats.blocks;
      totalTurnovers += teamStats.turnovers;
      
      if (teamStats.points > opponentStats.points) {
        wins++;
      } else {
        losses++;
      }
    }
    
    const games = boxScores.length;
    
    return {
      games,
      wins,
      losses,
      avgPointsScored: games > 0 ? totalPointsScored / games : 0,
      avgPointsAllowed: games > 0 ? totalPointsAllowed / games : 0,
      avgFgPct: games > 0 ? totalFgPct / games : 0,
      avg3pPct: games > 0 ? total3pPct / games : 0,
      avgFtPct: games > 0 ? totalFtPct / games : 0,
      avgAssists: games > 0 ? totalAssists / games : 0,
      avgRebounds: games > 0 ? totalRebounds / games : 0,
      avgSteals: games > 0 ? totalSteals / games : 0,
      avgBlocks: games > 0 ? totalBlocks / games : 0,
      avgTurnovers: games > 0 ? totalTurnovers / games : 0,
    };
  }

  /**
   * Compute last N games statistics
   */
  private computeLastNStats(boxScores: BoxScore[], teamId: number, n: number) {
    // Sort by date (most recent first) and take last N
    const sorted = [...boxScores].sort((a, b) => b.gameId - a.gameId).slice(0, n);
    
    let wins = 0;
    let totalPointsScored = 0;
    let totalPointsAllowed = 0;
    
    for (const boxScore of sorted) {
      const isHome = boxScore.homeTeam.teamId === teamId;
      const teamStats = isHome ? boxScore.homeTeam : boxScore.awayTeam;
      const opponentStats = isHome ? boxScore.awayTeam : boxScore.homeTeam;
      
      totalPointsScored += teamStats.points;
      totalPointsAllowed += opponentStats.points;
      
      if (teamStats.points > opponentStats.points) {
        wins++;
      }
    }
    
    const games = sorted.length;
    
    return {
      winRate: games > 0 ? wins / games : 0.5,
      avgPointsScored: games > 0 ? totalPointsScored / games : 0,
      avgPointsAllowed: games > 0 ? totalPointsAllowed / games : 0,
    };
  }

  /**
   * Compute home/away splits
   */
  private computeHomeAwaySplits(boxScores: BoxScore[], teamId: number) {
    let homeWins = 0;
    let homeGames = 0;
    let awayWins = 0;
    let awayGames = 0;
    
    for (const boxScore of boxScores) {
      if (boxScore.homeTeam.teamId === teamId) {
        homeGames++;
        if (boxScore.homeTeam.points > boxScore.awayTeam.points) {
          homeWins++;
        }
      } else if (boxScore.awayTeam.teamId === teamId) {
        awayGames++;
        if (boxScore.awayTeam.points > boxScore.homeTeam.points) {
          awayWins++;
        }
      }
    }
    
    return {
      homeWinRate: homeGames > 0 ? homeWins / homeGames : 0.5,
      awayWinRate: awayGames > 0 ? awayWins / awayGames : 0.5,
    };
  }

  /**
   * Compute rest information
   */
  private computeRestInfo(boxScores: BoxScore[]) {
    // Get most recent game
    const sorted = [...boxScores].sort((a, b) => b.gameId - a.gameId);
    const lastGame = sorted[0];
    
    if (!lastGame) {
      return { daysSinceLastGame: 0, backToBack: false };
    }
    
    // BoxScore does not expose a reliable game date here.
    // Return unknown as 0 instead of synthetic rest estimate.
    const daysSinceLastGame = 0;
    const backToBack = daysSinceLastGame < 1;
    
    return {
      daysSinceLastGame,
      backToBack,
    };
  }

  /**
   * Calculate offensive rating (points per 100 possessions)
   * Simplified calculation
   */
  private calculateOffensiveRating(stats: { avgPointsScored: number }): number {
    // NBA average possessions per game ≈ 100
    // ORtg = (Points / Possessions) * 100
    const estimatedPossessions = 100;
    return (stats.avgPointsScored / estimatedPossessions) * 100;
  }

  /**
   * Calculate defensive rating (points allowed per 100 possessions)
   */
  private calculateDefensiveRating(stats: { avgPointsAllowed: number }): number {
    const estimatedPossessions = 100;
    return (stats.avgPointsAllowed / estimatedPossessions) * 100;
  }

  /**
   * Compute matchup features
   */
  private computeMatchupFeatures(
    h2hGames: Game[],
    homeTeamId: number,
    awayTeamId: number
  ): MatchupFeatures {
    void awayTeamId;
    let homeWins = 0;
    let awayWins = 0;
    let totalPointDiff = 0;
    
    for (const game of h2hGames.slice(0, this.config.h2hWindow)) {
      if (typeof game.homeScore !== 'number' || typeof game.awayScore !== 'number') {
        continue;
      }

      const homeSideWon = game.homeScore > game.awayScore;
      if (game.homeTeam.id === homeTeamId) {
        if (homeSideWon) {
          homeWins++;
        } else {
          awayWins++;
        }
        totalPointDiff += game.homeScore - game.awayScore;
      } else {
        if (homeSideWon) {
          awayWins++;
        } else {
          homeWins++;
        }
        totalPointDiff += game.awayScore - game.homeScore;
      }
    }
    
    const totalGames = h2hGames.length;
    
    return {
      h2hHomeWins: homeWins,
      h2hAwayWins: awayWins,
      h2hAvgPointDiff: totalGames > 0 ? totalPointDiff / totalGames : 0,
    };
  }

  /**
   * Compute context features
   */
  private computeContextFeatures(
    game: Game,
    homeFeatures: TeamFeatures,
    awayFeatures: TeamFeatures,
    marketData?: {
      spread?: number;
      overUnder?: number;
      homeOdds?: number;
      awayOdds?: number;
    }
  ): ContextFeatures {
    const matchDate = new Date(game.date);
    const dayOfWeek = matchDate.getDay();
    const month = matchDate.getMonth();
    
    return {
      isPlayoff: game.seasonType === 'Playoffs',
      isBackToBackForEither: homeFeatures.backToBack || awayFeatures.backToBack,
      daysRestDiff: homeFeatures.daysSinceLastGame - awayFeatures.daysSinceLastGame,
      
      homeTeamSpread: marketData?.spread,
      overUnder: marketData?.overUnder,
      homeMoneylineOdds: marketData?.homeOdds,
      awayMoneylineOdds: marketData?.awayOdds,
      
      dayOfWeek,
      month,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    };
  }

  /**
   * Combine all features into normalized model features
   */
  private combineFeatures(
    homeFeatures: TeamFeatures,
    awayFeatures: TeamFeatures,
    matchupFeatures: MatchupFeatures,
    contextFeatures: ContextFeatures
  ): ModelFeatures {
    // Normalize features to -1 to 1 range
    const normalize = (value: number, min: number, max: number): number => {
      return 2 * ((value - min) / (max - min)) - 1;
    };
    
    // Calculate matchup strength (higher = home team stronger)
    const homeStrength = homeFeatures.winRate * homeFeatures.offensiveRating / homeFeatures.defensiveRating;
    const awayStrength = awayFeatures.winRate * awayFeatures.offensiveRating / awayFeatures.defensiveRating;
    const matchupStrength = normalize(homeStrength / (homeStrength + awayStrength + 0.001), 0, 1);
    
    // Calculate home advantage
    const homeAdvantage = normalize(homeFeatures.homeWinRate - awayFeatures.awayWinRate, -0.5, 0.5);
    
    // Calculate rest advantage
    const restAdvantage = normalize(contextFeatures.daysRestDiff, -3, 3);
    
    return {
      // Home team
      homeWinRate: normalize(homeFeatures.winRate, 0.2, 0.8),
      homeOffensiveRating: normalize(homeFeatures.offensiveRating, 100, 120),
      homeDefensiveRating: normalize(homeFeatures.defensiveRating, 100, 120),
      homeForm: normalize(homeFeatures.last5WinRate, 0, 1),
      homeRestAdvantage: restAdvantage,
      
      // Away team
      awayWinRate: normalize(awayFeatures.winRate, 0.2, 0.8),
      awayOffensiveRating: normalize(awayFeatures.offensiveRating, 100, 120),
      awayDefensiveRating: normalize(awayFeatures.defensiveRating, 100, 120),
      awayForm: normalize(awayFeatures.last5WinRate, 0, 1),
      
      // Matchup
      homeAdvantage,
      h2hAdvantage: matchupFeatures.h2hAvgPointDiff / 20, // Normalize
      matchupStrength,
      
      // Context
      isBackToBack: contextFeatures.isBackToBackForEither ? 1 : 0,
      daysRestDiff: restAdvantage,
      isPlayoff: contextFeatures.isPlayoff ? 1 : 0,
      
      // Market
      spreadDiff: contextFeatures.homeTeamSpread ? normalize(contextFeatures.homeTeamSpread, -10, 10) : undefined,
      publicBettingPercent: undefined, // Would come from odds API
    };
  }

  /**
   * Generate data version hash
   */
  private generateDataVersion(game: Game, homeGameCount: number, awayGameCount: number): string {
    return `v1-${game.id}-${homeGameCount}-${awayGameCount}-${Date.now()}`;
  }

  /**
   * Calculate freshness score based on last game dates
   */
  private calculateFreshness(homeBoxScores: BoxScore[], awayBoxScores: BoxScore[]): number {
    const totalGames = homeBoxScores.length + awayBoxScores.length;
    if (totalGames === 0) return 0;
    
    // More recent games = higher freshness
    // Simplified: assume all data is fresh if we have games
    return Math.min(1, totalGames / 20);
  }

  /**
   * Validate features for quality
   */
  validateFeatures(features: FeatureRecord): FeatureValidationResult {
    const missingFeatures: string[] = [];
    const staleFeatures: string[] = [];
    
    // Check home features
    if (features.homeFeatures.games === 0) {
      missingFeatures.push('home_team_games');
    }
    if (features.homeFeatures.daysSinceLastGame > 7) {
      staleFeatures.push('home_team_data');
    }
    
    // Check away features
    if (features.awayFeatures.games === 0) {
      missingFeatures.push('away_team_games');
    }
    if (features.awayFeatures.daysSinceLastGame > 7) {
      staleFeatures.push('away_team_data');
    }
    
    // Calculate quality score
    let qualityScore = 1.0;
    if (missingFeatures.length > 0) qualityScore -= 0.3 * missingFeatures.length;
    if (staleFeatures.length > 0) qualityScore -= 0.2 * staleFeatures.length;
    
    return {
      valid: missingFeatures.length === 0,
      missingFeatures,
      staleFeatures,
      qualityScore: Math.max(0, qualityScore),
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createFeatureEngineeringService(
  config?: Partial<FeatureEngineeringConfig>
): FeatureEngineeringService {
  return new FeatureEngineeringService(config);
}
