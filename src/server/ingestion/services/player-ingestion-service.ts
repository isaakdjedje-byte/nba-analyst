import { PrismaClient } from '@prisma/client';
import { PlayerDataProvider } from '../providers/player-data-provider';
import { 
  PlayerProfile, 
  PlayerGameStatsExtended, 
} from '../schema/player-schemas';

/**
 * Player Ingestion Service
 * Handles fetching and storing player data, rosters, and stats
 */

export interface IngestionResult {
  added: number;
  updated: number;
  errors: string[];
}

export class PlayerIngestionService {
  private prisma: PrismaClient;
  private playerProvider: PlayerDataProvider;

  constructor(prisma: PrismaClient, playerProvider: PlayerDataProvider) {
    this.prisma = prisma;
    this.playerProvider = playerProvider;
  }

  /**
   * Fetch and store roster for all teams for a season
   */
  async fetchAndStoreRosters(season: number): Promise<{
    playersAdded: number;
    playersUpdated: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let playersAdded = 0;
    let playersUpdated = 0;

    try {
      // Get all teams
      const teams = await this.prisma.$queryRaw<{ team_id: number }[]>`
        SELECT DISTINCT home_team_id as team_id FROM games WHERE season = ${season}
        UNION
        SELECT DISTINCT away_team_id as team_id FROM games WHERE season = ${season}
      `;

      for (const team of teams) {
        try {
          const rosterResult = await this.playerProvider.getTeamRoster(team.team_id, season);
          const roster = rosterResult.data;

          for (const player of roster.players) {
            try {
              const result = await this.upsertPlayer(player);
              if (result.isNew) {
                playersAdded++;
              } else {
                playersUpdated++;
              }

              // Create PlayerTeam relation
              await this.prisma.playerTeam.upsert({
                where: {
                  playerId_teamId_season: {
                    playerId: result.playerId,
                    teamId: team.team_id,
                    season,
                  },
                },
                update: {},
                create: {
                  playerId: result.playerId,
                  teamId: team.team_id,
                  season,
                  startDate: new Date(),
                },
              });
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Unknown error';
              errors.push(`Player ${player.fullName}: ${msg}`);
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Team ${team.team_id}: ${msg}`);
        }
      }

      return { playersAdded, playersUpdated, errors };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Roster fetch failed: ${msg}`);
      return { playersAdded, playersUpdated, errors };
    }
  }

  /**
   * Fetch and store player game stats from box score
   */
  async fetchAndStorePlayerGameStats(
    gameId: string,
    externalGameId: number,
    season: number
  ): Promise<{ statsAdded: number; errors: string[] }> {
    const errors: string[] = [];
    let statsAdded = 0;

    try {
      const boxScoreResult = await this.playerProvider.getExtendedBoxScore(externalGameId);
      const boxScore = boxScoreResult.data;

      // Process home team players
      for (const playerStats of boxScore.homeTeam.players) {
        try {
          await this.storePlayerGameStats(gameId, playerStats, boxScore.homeTeam.teamId, season);
          statsAdded++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Home player ${playerStats.playerId}: ${msg}`);
        }
      }

      // Process away team players
      for (const playerStats of boxScore.awayTeam.players) {
        try {
          await this.storePlayerGameStats(gameId, playerStats, boxScore.awayTeam.teamId, season);
          statsAdded++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Away player ${playerStats.playerId}: ${msg}`);
        }
      }

      return { statsAdded, errors };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Box score fetch failed: ${msg}`);
      return { statsAdded, errors };
    }
  }

  /**
   * Update player season stats (aggregated)
   */
  async updatePlayerSeasonStats(season: number): Promise<void> {
    // Calculate aggregates from PlayerGameStats
    await this.prisma.$executeRaw`
      INSERT INTO player_season_stats (
        player_id, team_id, season, games_played, games_started, minutes_avg,
        points_avg, rebounds_avg, assists_avg, steals_avg, blocks_avg, turnovers_avg,
        fg_pct, three_pct, ft_pct, total_points, total_minutes
      )
      SELECT 
        player_id,
        team_id,
        season,
        COUNT(*) as games_played,
        SUM(CASE WHEN is_starter THEN 1 ELSE 0 END) as games_started,
        AVG(minutes_float) as minutes_avg,
        AVG(points) as points_avg,
        AVG(rebounds) as rebounds_avg,
        AVG(assists) as assists_avg,
        AVG(steals) as steals_avg,
        AVG(blocks) as blocks_avg,
        AVG(turnovers) as turnovers_avg,
        AVG(fg_pct) as fg_pct,
        AVG(three_pct) as three_pct,
        AVG(ft_pct) as ft_pct,
        SUM(points) as total_points,
        SUM(minutes) as total_minutes
      FROM player_game_stats
      WHERE season = ${season}
      GROUP BY player_id, team_id, season
      ON CONFLICT (player_id, team_id, season) DO UPDATE SET
        games_played = EXCLUDED.games_played,
        games_started = EXCLUDED.games_started,
        minutes_avg = EXCLUDED.minutes_avg,
        points_avg = EXCLUDED.points_avg,
        rebounds_avg = EXCLUDED.rebounds_avg,
        assists_avg = EXCLUDED.assists_avg,
        steals_avg = EXCLUDED.steals_avg,
        blocks_avg = EXCLUDED.blocks_avg,
        turnovers_avg = EXCLUDED.turnovers_avg,
        fg_pct = EXCLUDED.fg_pct,
        three_pct = EXCLUDED.three_pct,
        ft_pct = EXCLUDED.ft_pct,
        total_points = EXCLUDED.total_points,
        total_minutes = EXCLUDED.total_minutes
    `;
  }

  /**
   * Fetch and store injury reports
   */
  async fetchAndStoreInjuryReports(date: string, season: number): Promise<{
    injuriesAdded: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let injuriesAdded = 0;

    try {
      const injuryResult = await this.playerProvider.getInjuryReport(date);
      const injuries = injuryResult.data;

      for (const injury of injuries) {
        try {
          // Find player by nbaId
          const player = await this.prisma.player.findUnique({
            where: { nbaId: injury.playerId.toString() },
          });

          if (player) {
            await this.prisma.injuryReport.create({
              data: {
                playerId: player.id,
                teamId: injury.teamId,
                season,
                injuryType: injury.injuryType,
                status: injury.status,
                description: injury.description,
                reportDate: new Date(injury.reportDate),
                expectedReturn: injury.expectedReturn ? new Date(injury.expectedReturn) : null,
              },
            });
            injuriesAdded++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Injury for player ${injury.playerId}: ${msg}`);
        }
      }

      return { injuriesAdded, errors };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Injury report fetch failed: ${msg}`);
      return { injuriesAdded, errors };
    }
  }

  /**
   * Upsert player into database
   */
  private async upsertPlayer(player: PlayerProfile): Promise<{ playerId: number; isNew: boolean }> {
    const existing = await this.prisma.player.findUnique({
      where: { nbaId: player.id.toString() },
    });

    const data = {
      nbaId: player.id.toString(),
      firstName: player.firstName,
      lastName: player.lastName,
      fullName: player.fullName,
      jerseyNumber: player.jerseyNumber,
      position: player.position,
      height: player.height,
      weight: player.weight,
      birthDate: player.birthDate ? new Date(player.birthDate) : null,
      college: player.college,
      country: player.country,
      draftYear: player.draftYear,
      draftRound: player.draftRound,
      draftNumber: player.draftNumber,
    };

    if (existing) {
      await this.prisma.player.update({
        where: { id: existing.id },
        data,
      });
      return { playerId: existing.id, isNew: false };
    } else {
      const created = await this.prisma.player.create({ data });
      return { playerId: created.id, isNew: true };
    }
  }

  /**
   * Store player game stats
   */
  private async storePlayerGameStats(
    gameId: string,
    stats: PlayerGameStatsExtended,
    teamId: number,
    season: number
  ): Promise<void> {
    // Find player by nbaId
    const player = await this.prisma.player.findUnique({
      where: { nbaId: stats.playerId.toString() },
    });

    if (!player) {
      throw new Error(`Player not found: ${stats.playerId}`);
    }

    await this.prisma.playerGameStats.upsert({
      where: {
        playerId_gameId: {
          playerId: player.id,
          gameId,
        },
      },
      update: {
        teamId,
        season,
        minutes: stats.minutes,
        minutesFloat: stats.minutesFloat,
        points: stats.points,
        rebounds: stats.rebounds,
        assists: stats.assists,
        steals: stats.steals,
        blocks: stats.blocks,
        turnovers: stats.turnovers,
        fgMade: stats.fgMade,
        fgAttempted: stats.fgAttempted,
        fgPct: stats.fgPct,
        threeMade: stats.threeMade,
        threeAttempted: stats.threeAttempted,
        threePct: stats.threePct,
        ftMade: stats.ftMade,
        ftAttempted: stats.ftAttempted,
        ftPct: stats.ftPct,
        plusMinus: stats.plusMinus,
        offensiveRebounds: stats.offensiveRebounds,
        defensiveRebounds: stats.defensiveRebounds,
        isStarter: stats.isStarter,
        didNotPlay: stats.didNotPlay,
      },
      create: {
        playerId: player.id,
        gameId,
        teamId,
        season,
        minutes: stats.minutes,
        minutesFloat: stats.minutesFloat,
        points: stats.points,
        rebounds: stats.rebounds,
        assists: stats.assists,
        steals: stats.steals,
        blocks: stats.blocks,
        turnovers: stats.turnovers,
        fgMade: stats.fgMade,
        fgAttempted: stats.fgAttempted,
        fgPct: stats.fgPct,
        threeMade: stats.threeMade,
        threeAttempted: stats.threeAttempted,
        threePct: stats.threePct,
        ftMade: stats.ftMade,
        ftAttempted: stats.ftAttempted,
        ftPct: stats.ftPct,
        plusMinus: stats.plusMinus,
        offensiveRebounds: stats.offensiveRebounds,
        defensiveRebounds: stats.defensiveRebounds,
        isStarter: stats.isStarter,
        didNotPlay: stats.didNotPlay,
      },
    });
  }
}
