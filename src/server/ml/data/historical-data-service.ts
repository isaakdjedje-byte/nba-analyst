/**
 * Historical Data Service
 * 
 * Manages historical NBA game data for model training.
 * Fetches, stores, and queries box scores and game results.
 */

import { prisma } from '@/server/db/client';
import { NBACDNProvider } from '@/server/ingestion/providers/nba-cdn-provider';
import { ESPNProvider } from '@/server/ingestion/providers/espn-provider';
import { Game, BoxScore } from '@/server/ingestion/schema/nba-schemas';

// =============================================================================
// TYPES
// =============================================================================

export interface HistoricalGame {
  id: number;
  season: number;
  seasonType: string;
  gameDate: Date;
  status: 'completed' | 'in_progress' | 'scheduled';
  
  // Teams
  homeTeamId: number;
  homeTeamName: string;
  homeTeamAbbreviation: string;
  homeTeamConference: 'East' | 'West';
  
  awayTeamId: number;
  awayTeamName: string;
  awayTeamAbbreviation: string;
  awayTeamConference: 'East' | 'West';
  
  // Scores
  homeScore: number;
  awayScore: number;
  homeWon: boolean;
  pointDiff: number;
  
  // Metadata
  arena?: string;
  attendance?: number;
  
  // Timestamps
  fetchedAt: Date;
  updatedAt: Date;
}

export interface HistoricalBoxScore {
  gameId: number;
  
  // Home team stats
  homePoints: number;
  homeRebounds: number;
  homeAssists: number;
  homeSteals: number;
  homeBlocks: number;
  homeTurnovers: number;
  homeFgPct: number;
  home3pPct: number;
  homeFtPct: number;
  
  // Away team stats
  awayPoints: number;
  awayRebounds: number;
  awayAssists: number;
  awaySteals: number;
  awayBlocks: number;
  awayTurnovers: number;
  awayFgPct: number;
  away3pPct: number;
  awayFtPct: number;
  
  // Metadata
  fetchedAt: Date;
}

export interface DataFetchConfig {
  startDate: Date;
  endDate: Date;
  seasons?: number[];
  seasonTypes?: ('Regular Season' | 'Pre Season' | 'Playoffs')[];
  onlyCompleted?: boolean;
}

export interface FetchProgress {
  totalGames: number;
  fetchedGames: number;
  failedGames: number;
  currentSeason?: number;
  currentDate?: Date;
}

export type FetchProgressCallback = (progress: FetchProgress) => void;

// =============================================================================
// HISTORICAL DATA SERVICE
// =============================================================================

export class HistoricalDataService {
  private nbaProvider: NBACDNProvider;
  private espnProvider: ESPNProvider;
  
  constructor() {
    // Initialize providers with default config
    this.nbaProvider = new NBACDNProvider({
      name: 'nba-cdn',
      baseUrl: process.env.NBA_API_URL || 'https://cdn.nba.com',
      timeout: 10000,
      rateLimit: 60,
    });
    
    this.espnProvider = new ESPNProvider({
      name: 'espn',
      baseUrl: process.env.ESPN_API_URL || 'https://site.api.espn.com/apis/site/v2/sports',
      timeout: 10000,
      rateLimit: 60,
    });
  }

  /**
   * Fetch and store historical games for a date range
   */
  async fetchHistoricalGames(
    config: DataFetchConfig,
    progressCallback?: FetchProgressCallback
  ): Promise<{ gamesFetched: number; gamesFailed: number }> {
    const { startDate, endDate, onlyCompleted = true } = config;
    
    let gamesFetched = 0;
    let gamesFailed = 0;
    
    // Iterate through each day
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      try {
        // Try NBA CDN first
        const result = await this.nbaProvider.getGamesByDate(dateStr);
        
        if (result.data?.games) {
          for (const game of result.data.games) {
            // Skip if only fetching completed and game not done
            if (onlyCompleted && game.status !== 'completed') {
              continue;
            }
            
            try {
              // Fetch box score for detailed stats
              const boxScore = await this.fetchBoxScoreWithFallback(game.id);
              
              // Store game and box score
              await this.storeGame(game, boxScore);
              gamesFetched++;
            } catch (error) {
              console.warn(`Failed to fetch box score for game ${game.id}:`, error);
              gamesFailed++;
            }
          }
        }
        
        // Report progress
        if (progressCallback) {
          progressCallback({
            totalGames: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * 8, // Estimate
            fetchedGames: gamesFetched,
            failedGames: gamesFailed,
            currentDate: new Date(currentDate),
          });
        }
        
      } catch (error) {
        console.warn(`Failed to fetch games for ${dateStr}:`, error);
        gamesFailed += 8; // Estimate
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      
      // Rate limiting
      await this.sleep(100);
    }
    
    return { gamesFetched, gamesFailed };
  }

  /**
   * Fetch box score with fallback to ESPN
   */
  private async fetchBoxScoreWithFallback(gameId: number): Promise<BoxScore | null> {
    try {
      // Try NBA CDN first
      const result = await this.nbaProvider.getBoxScore(gameId);
      return result.data;
    } catch {
      console.warn(`NBA CDN box score failed for ${gameId}, trying ESPN...`);
      
      try {
        // Fallback to ESPN
        await this.espnProvider.getScoreboard();
        // ESPN doesn't have direct box score, return simplified
        return null;
      } catch {
        console.warn(`ESPN fallback also failed for ${gameId}`);
        return null;
      }
    }
  }

  /**
   * Store game in database
   */
  private async storeGame(game: Game, boxScore: BoxScore | null): Promise<void> {
    // Upsert game
    await prisma.$executeRaw`
      INSERT INTO games (
        id, season, season_type, game_date, status,
        home_team_id, home_team_name, home_team_abbreviation, home_team_conference,
        away_team_id, away_team_name, away_team_abbreviation, away_team_conference,
        home_score, away_score, arena, attendance,
        fetched_at, updated_at
      ) VALUES (
        ${game.id}, ${game.season}, ${game.seasonType}, ${new Date(game.date)}, ${game.status},
        ${game.homeTeam.id}, ${game.homeTeam.name}, ${game.homeTeam.abbreviation}, ${game.homeTeam.conference},
        ${game.awayTeam.id}, ${game.awayTeam.name}, ${game.awayTeam.abbreviation}, ${game.awayTeam.conference},
          ${game.homeScore ?? null}, ${game.awayScore ?? null}, ${game.arena || null}, ${game.attendance || null},
        NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        home_score = EXCLUDED.home_score,
        away_score = EXCLUDED.away_score,
        status = EXCLUDED.status,
        updated_at = NOW()
    `;

    // Store box score if available
    if (boxScore) {
      await prisma.$executeRaw`
        INSERT INTO box_scores (
          game_id,
          home_points, home_rebounds, home_assists, home_steals, home_blocks, home_turnovers,
          home_fg_pct, home_3p_pct, home_ft_pct,
          away_points, away_rebounds, away_assists, away_steals, away_blocks, away_turnovers,
          away_fg_pct, away_3p_pct, away_ft_pct,
          fetched_at
        ) VALUES (
          ${boxScore.gameId},
          ${boxScore.homeTeam.points}, ${boxScore.homeTeam.rebounds}, ${boxScore.homeTeam.assists},
          ${boxScore.homeTeam.steals}, ${boxScore.homeTeam.blocks}, ${boxScore.homeTeam.turnovers},
          ${boxScore.homeTeam.fieldGoalPercentage}, ${boxScore.homeTeam.threePointPercentage}, ${boxScore.homeTeam.freeThrowPercentage},
          ${boxScore.awayTeam.points}, ${boxScore.awayTeam.rebounds}, ${boxScore.awayTeam.assists},
          ${boxScore.awayTeam.steals}, ${boxScore.awayTeam.blocks}, ${boxScore.awayTeam.turnovers},
          ${boxScore.awayTeam.fieldGoalPercentage}, ${boxScore.awayTeam.threePointPercentage}, ${boxScore.awayTeam.freeThrowPercentage},
          NOW()
        )
        ON CONFLICT (game_id) DO UPDATE SET
          home_points = EXCLUDED.home_points,
          home_rebounds = EXCLUDED.home_rebounds,
          home_assists = EXCLUDED.home_assists,
          away_points = EXCLUDED.away_points,
          away_rebounds = EXCLUDED.away_rebounds,
          away_assists = EXCLUDED.away_assists,
          fetched_at = NOW()
      `;
    }
  }

  /**
   * Get historical games for training
   */
  async getGamesForTraining(
    startDate: Date,
    endDate: Date,
    minGames: number = 100
  ): Promise<HistoricalGame[]> {
    const games = await prisma.$queryRaw<HistoricalGame[]>`
      SELECT 
        g.id,
        g.season,
        g.season_type as "seasonType",
        g.game_date as "gameDate",
        g.status,
        g.home_team_id as "homeTeamId",
        g.home_team_name as "homeTeamName",
        g.home_team_abbreviation as "homeTeamAbbreviation",
        g.home_team_conference as "homeTeamConference",
        g.away_team_id as "awayTeamId",
        g.away_team_name as "awayTeamName",
        g.away_team_abbreviation as "awayTeamAbbreviation",
        g.away_team_conference as "awayTeamConference",
        g.home_score as "homeScore",
        g.away_score as "awayScore",
        g.home_score > g.away_score as "homeWon",
        ABS(g.home_score - g.away_score) as "pointDiff",
        g.arena,
        g.attendance,
        g.fetched_at as "fetchedAt",
        g.updated_at as "updatedAt"
      FROM games g
      WHERE g.game_date BETWEEN ${startDate} AND ${endDate}
        AND g.status = 'completed'
        AND g.home_score IS NOT NULL
        AND g.away_score IS NOT NULL
      ORDER BY g.game_date DESC
      LIMIT ${minGames * 10}
    `;

    return games || [];
  }

  /**
   * Get box scores for a game
   */
  async getBoxScore(gameId: number): Promise<HistoricalBoxScore | null> {
    const boxScores = await prisma.$queryRaw<HistoricalBoxScore[]>`
      SELECT 
        game_id as "gameId",
        home_points as "homePoints",
        home_rebounds as "homeRebounds",
        home_assists as "homeAssists",
        home_steals as "homeSteals",
        home_blocks as "homeBlocks",
        home_turnovers as "homeTurnovers",
        home_fg_pct as "homeFgPct",
        home_3p_pct as "home3pPct",
        home_ft_pct as "homeFtPct",
        away_points as "awayPoints",
        away_rebounds as "awayRebounds",
        away_assists as "awayAssists",
        away_steals as "awaySteals",
        away_blocks as "awayBlocks",
        away_turnovers as "awayTurnovers",
        away_fg_pct as "awayFgPct",
        away_3p_pct as "away3pPct",
        away_ft_pct as "awayFtPct",
        fetched_at as "fetchedAt"
      FROM box_scores
      WHERE game_id = ${gameId}
      LIMIT 1
    `;

    return boxScores?.[0] || null;
  }

  /**
   * Get team games for feature computation
   */
  async getTeamGames(
    teamId: number,
    beforeDate: Date,
    limit: number = 20
  ): Promise<{ game: HistoricalGame; boxScore: HistoricalBoxScore | null }[]> {
    const games = await prisma.$queryRaw<HistoricalGame[]>`
      SELECT 
        g.id,
        g.season,
        g.season_type as "seasonType",
        g.game_date as "gameDate",
        g.status,
        g.home_team_id as "homeTeamId",
        g.home_team_name as "homeTeamName",
        g.home_team_abbreviation as "homeTeamAbbreviation",
        g.home_team_conference as "homeTeamConference",
        g.away_team_id as "awayTeamId",
        g.away_team_name as "awayTeamName",
        g.away_team_abbreviation as "awayTeamAbbreviation",
        g.away_team_conference as "awayTeamConference",
        g.home_score as "homeScore",
        g.away_score as "awayScore",
        g.home_score > g.away_score as "homeWon",
        ABS(g.home_score - g.away_score) as "pointDiff",
        g.arena,
        g.attendance,
        g.fetched_at as "fetchedAt",
        g.updated_at as "updatedAt"
      FROM games g
      WHERE (g.home_team_id = ${teamId} OR g.away_team_id = ${teamId})
        AND g.game_date < ${beforeDate}
        AND g.status = 'completed'
        AND g.home_score IS NOT NULL
      ORDER BY g.game_date DESC
      LIMIT ${limit}
    `;

    // Fetch box scores for each game
    const results = [];
    for (const game of games) {
      const boxScore = await this.getBoxScore(game.id);
      results.push({ game, boxScore });
    }

    return results;
  }

  /**
   * Get head-to-head games
   */
  async getH2HGames(
    teamId1: number,
    teamId2: number,
    limit: number = 5
  ): Promise<HistoricalGame[]> {
    const games = await prisma.$queryRaw<HistoricalGame[]>`
      SELECT 
        g.id,
        g.season,
        g.season_type as "seasonType",
        g.game_date as "gameDate",
        g.status,
        g.home_team_id as "homeTeamId",
        g.home_team_name as "homeTeamName",
        g.home_team_abbreviation as "homeTeamAbbreviation",
        g.home_team_conference as "homeTeamConference",
        g.away_team_id as "awayTeamId",
        g.away_team_name as "awayTeamName",
        g.away_team_abbreviation as "awayTeamAbbreviation",
        g.away_team_conference as "awayTeamConference",
        g.home_score as "homeScore",
        g.away_score as "awayScore",
        g.home_score > g.away_score as "homeWon",
        ABS(g.home_score - g.away_score) as "pointDiff",
        g.arena,
        g.attendance,
        g.fetched_at as "fetchedAt",
        g.updated_at as "updatedAt"
      FROM games g
      WHERE (
        (g.home_team_id = ${teamId1} AND g.away_team_id = ${teamId2})
        OR (g.home_team_id = ${teamId2} AND g.away_team_id = ${teamId1})
      )
        AND g.status = 'completed'
        AND g.home_score IS NOT NULL
      ORDER BY g.game_date DESC
      LIMIT ${limit}
    `;

    return games || [];
  }

  /**
   * Get training statistics
   */
  async getTrainingStats(): Promise<{
    totalGames: number;
    gamesWithBoxScores: number;
    dateRange: { earliest: Date | null; latest: Date | null };
    teams: number;
  }> {
    type CountRow = { count: number | string };
    type DateRow = { earliest: Date | null; latest: Date | null };

    const [gamesResult, boxScoresResult, dateResult, teamsResult] = await Promise.all([
      prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) as count FROM games WHERE status = 'completed'`,
      prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) as count FROM box_scores`,
      prisma.$queryRaw<DateRow[]>`SELECT MIN(game_date) as earliest, MAX(game_date) as latest FROM games`,
      prisma.$queryRaw<CountRow[]>`SELECT COUNT(DISTINCT home_team_id) as count FROM games`,
    ]);

    return {
      totalGames: Number(gamesResult[0]?.count || 0),
      gamesWithBoxScores: Number(boxScoresResult[0]?.count || 0),
      dateRange: {
        earliest: dateResult[0]?.earliest,
        latest: dateResult[0]?.latest,
      },
      teams: Number(teamsResult[0]?.count || 0),
    };
  }

  /**
   * Check if we have enough data for training
   */
  async hasEnoughDataForTraining(minGames: number = 100): Promise<boolean> {
    const stats = await this.getTrainingStats();
    return stats.totalGames >= minGames && stats.gamesWithBoxScores >= minGames * 0.5;
  }

  /**
   * Utility: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createHistoricalDataService(): HistoricalDataService {
  return new HistoricalDataService();
}
