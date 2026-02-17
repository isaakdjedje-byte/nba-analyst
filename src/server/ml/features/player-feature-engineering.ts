import { PrismaClient } from '@prisma/client';
import {
  TeamRosterFeatures,
  KeyPlayerFeatures,
  EnhancedModelFeatures,
} from './player-feature-types';

/**
 * Player Feature Engineering Service
 * Computes roster strength and player-level features for ML model
 */

interface PlayerWithStats {
  id: number;
  fullName: string;
  position: string | null;
  seasonStats: {
    pointsAvg: number | null;
    minutesAvg: number | null;
    gamesPlayed: number;
    per: number | null;
    tsPct: number | null;
  } | null;
  recentGames: {
    points: number;
    minutesFloat: number | null;
    isStarter: boolean;
    gameDate: Date;
  }[];
}

interface InjuryInfo {
  playerId: number;
  status: string;
  injuryType: string;
}

export class PlayerFeatureEngineeringService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Compute enhanced features for a game
   */
  async computeEnhancedFeatures(
    homeTeamId: number,
    awayTeamId: number,
    gameDate: Date,
    season: number
  ): Promise<EnhancedModelFeatures> {
    // Get roster features for both teams
    const [homeRosterFeatures, awayRosterFeatures] = await Promise.all([
      this.computeRosterFeatures(homeTeamId, season, gameDate),
      this.computeRosterFeatures(awayTeamId, season, gameDate),
    ]);

    // Get key player features
    const keyPlayerFeatures = await this.computeKeyPlayerMatchups(
      homeRosterFeatures.top3PlayersAvgPoints,
      awayRosterFeatures.top3PlayersAvgPoints
    );

    // Compute position matchups
    const positionMatchups = await this.computePositionMatchups(
      homeTeamId,
      awayTeamId,
      season
    );

    // Calculate roster strength difference (-1 to 1)
    const rosterStrengthDiff = this.normalizeDiff(
      homeRosterFeatures.top3PlayersAvgPoints,
      awayRosterFeatures.top3PlayersAvgPoints
    );

    // Calculate top 3 points difference
    const top3PointsDiff = homeRosterFeatures.top3PlayersAvgPoints - awayRosterFeatures.top3PlayersAvgPoints;

    // Calculate key players out difference
    const keyPlayersOutDiff = homeRosterFeatures.keyPlayersOut - awayRosterFeatures.keyPlayersOut;

    // Calculate star form difference
    const homeStarForm = keyPlayerFeatures.homeStarPlayers.reduce((sum, p) => sum + p.recentForm, 0) / 
                        (keyPlayerFeatures.homeStarPlayers.length || 1);
    const awayStarForm = keyPlayerFeatures.awayStarPlayers.reduce((sum, p) => sum + p.recentForm, 0) / 
                        (keyPlayerFeatures.awayStarPlayers.length || 1);
    const starFormDiff = homeStarForm - awayStarForm;

    return {
      // Placeholder for existing features (would come from base feature engineering)
      homeWinPct: 0.5,
      awayWinPct: 0.5,
      homePointsAvg: 110,
      awayPointsAvg: 110,
      homeRecentForm: 0,
      awayRecentForm: 0,
      h2hHomeWins: 0,
      h2hTotalGames: 0,

      // NEW: Player-level features
      homeRosterStrength: this.calculateRosterStrength(homeRosterFeatures),
      awayRosterStrength: this.calculateRosterStrength(awayRosterFeatures),
      rosterStrengthDiff,

      homeTop3AvgPoints: homeRosterFeatures.top3PlayersAvgPoints,
      awayTop3AvgPoints: awayRosterFeatures.top3PlayersAvgPoints,
      top3PointsDiff,

      homeKeyPlayersOut: homeRosterFeatures.keyPlayersOut,
      awayKeyPlayersOut: awayRosterFeatures.keyPlayersOut,
      keyPlayersOutDiff,

      homeStarForm,
      awayStarForm,
      starFormDiff,

      injuryImpactHome: homeRosterFeatures.injuryImpactScore,
      injuryImpactAway: awayRosterFeatures.injuryImpactScore,

      // Position matchups
      pgMatchupAdvantage: positionMatchups.pg || 0,
      sgMatchupAdvantage: positionMatchups.sg || 0,
      sfMatchupAdvantage: positionMatchups.sf || 0,
      pfMatchupAdvantage: positionMatchups.pf || 0,
      cMatchupAdvantage: positionMatchups.c || 0,
    };
  }

  /**
   * Compute roster strength features
   */
  async computeRosterFeatures(
    teamId: number,
    season: number,
    gameDate: Date
  ): Promise<TeamRosterFeatures> {
    // Get players with their season stats
    const players = await this.getTeamRosterWithStats(teamId, season, gameDate);

    // Get injuries for this team
    const injuries = await this.getTeamInjuries(teamId, season, gameDate);

    // Calculate top 3 players by season avg points
    const sortedByPoints = [...players].sort(
      (a, b) => (b.seasonStats?.pointsAvg || 0) - (a.seasonStats?.pointsAvg || 0)
    );
    const top3Players = sortedByPoints.slice(0, 3);

    const top3PlayersAvgPoints = top3Players.reduce(
      (sum, p) => sum + (p.seasonStats?.pointsAvg || 0), 0
    ) / (top3Players.length || 1);

    // Calculate efficiency (using PER or TS%)
    const top3PlayersAvgEfficiency = top3Players.reduce(
      (sum, p) => sum + (p.seasonStats?.per || p.seasonStats?.tsPct || 0), 0
    ) / (top3Players.length || 1);

    // Calculate roster depth (std dev of player ratings)
    const playerRatings = players.map(p => p.seasonStats?.pointsAvg || 0);
    const rosterDepth = this.calculateStdDev(playerRatings);

    // Calculate starters vs bench strength
    const starters = players.filter(p => 
      p.recentGames.some(g => g.isStarter)
    );
    const bench = players.filter(p => 
      !p.recentGames.some(g => g.isStarter)
    );

    const startersStrength = starters.reduce(
      (sum, p) => sum + (p.seasonStats?.pointsAvg || 0), 0
    ) / (starters.length || 1);

    const benchStrength = bench.reduce(
      (sum, p) => sum + (p.seasonStats?.pointsAvg || 0), 0
    ) / (bench.length || 1);

    // Count key players out (injured top performers)
    const keyPlayersOut = injuries.filter(inj => {
      const player = players.find(p => p.id === inj.playerId);
      return player && (player.seasonStats?.pointsAvg || 0) > 15; // Key player threshold
    }).length;

    const totalPlayersOut = injuries.length;

    // Calculate injury impact score
    const injuryImpactScore = this.calculateInjuryImpact(injuries, players);

    return {
      top3PlayersAvgPoints,
      top3PlayersAvgEfficiency,
      rosterDepth,
      startersStrength,
      benchStrength,
      keyPlayersOut,
      totalPlayersOut,
      injuryImpactScore,
    };
  }

  /**
   * Compute key player matchup advantages
   */
  private async computeKeyPlayerMatchups(
    homeTop3PlayersAvgPoints: number,
    awayTop3PlayersAvgPoints: number
  ): Promise<KeyPlayerFeatures> {
    void homeTop3PlayersAvgPoints;
    void awayTop3PlayersAvgPoints;
    // This would match star players by position
    // For now, return placeholder data
    return {
      homeStarPlayers: [],
      awayStarPlayers: [],
      starMatchupAdvantage: 0,
      clutchPerformance: 0,
    };
  }

  /**
   * Compute position-by-position matchups
   */
  private async computePositionMatchups(
    homeTeamId: number,
    awayTeamId: number,
    season: number
  ): Promise<Record<string, number>> {
    const positions = ['pg', 'sg', 'sf', 'pf', 'c'];
    const matchups: Record<string, number> = {};

    for (const position of positions) {
      // Get players at this position for both teams
      const [homePlayers, awayPlayers] = await Promise.all([
        this.getPlayersByPosition(homeTeamId, season, position),
        this.getPlayersByPosition(awayTeamId, season, position),
      ]);

      // Compare stats
      const homeAvg = homePlayers.reduce(
        (sum, p) => sum + (p.seasonStats?.pointsAvg || 0), 0
      ) / (homePlayers.length || 1);

      const awayAvg = awayPlayers.reduce(
        (sum, p) => sum + (p.seasonStats?.pointsAvg || 0), 0
      ) / (awayPlayers.length || 1);

      matchups[position] = this.normalizeDiff(homeAvg, awayAvg);
    }

    return matchups;
  }

  /**
   * Calculate injury impact score
   */
  private calculateInjuryImpact(
    injuries: InjuryInfo[],
    roster: PlayerWithStats[]
  ): number {
    if (injuries.length === 0) return 0;

    let totalImpact = 0;
    for (const injury of injuries) {
      const player = roster.find(p => p.id === injury.playerId);
      if (player) {
        // Weight by player importance (points per game)
        const importance = (player.seasonStats?.pointsAvg || 0) / 30; // Normalize to ~1 for stars
        
        // Weight by injury severity
        const severityWeights: Record<string, number> = {
          'out': 1.0,
          'doubtful': 0.8,
          'questionable': 0.5,
          'probable': 0.2,
          'available': 0,
        };
        const severity = severityWeights[injury.status] || 0.5;

        totalImpact += importance * severity;
      }
    }

    // Normalize to 0-1 range (assuming max impact is 3 star players out)
    return Math.min(totalImpact / 3, 1);
  }

  /**
   * Calculate roster strength score (0-1)
   */
  private calculateRosterStrength(features: TeamRosterFeatures): number {
    // Combine multiple factors into a single strength score
    const top3Factor = Math.min(features.top3PlayersAvgPoints / 25, 1); // Normalize to 25 ppg
    const depthFactor = Math.min(1 / (features.rosterDepth + 1), 1); // Lower std dev is better
    const availabilityFactor = 1 - features.injuryImpactScore;

    return (top3Factor * 0.5 + depthFactor * 0.25 + availabilityFactor * 0.25);
  }

  /**
   * Normalize difference to -1 to 1 range
   */
  private normalizeDiff(home: number, away: number): number {
    const sum = home + away;
    if (sum === 0) return 0;
    return (home - away) / sum;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Get team roster with stats
   */
  private async getTeamRosterWithStats(
    teamId: number,
    season: number,
    gameDate: Date
  ): Promise<PlayerWithStats[]> {
    const players = await this.prisma.player.findMany({
      where: {
        teams: {
          some: {
            teamId,
            season,
          },
        },
      },
      include: {
        seasonStats: {
          where: {
            teamId,
            season,
          },
          take: 1,
        },
        gameStats: {
          where: {
            teamId,
            season,
            game: {
              gameDate: {
                lte: gameDate,
                gte: new Date(gameDate.getTime() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
          },
          orderBy: {
            game: {
              gameDate: 'desc',
            },
          },
          take: 5,
          include: {
            game: {
              select: {
                gameDate: true,
              },
            },
          },
        },
      },
    });

    return players.map(p => ({
      id: p.id,
      fullName: p.fullName,
      position: p.position,
      seasonStats: p.seasonStats[0] || null,
      recentGames: p.gameStats.map(g => ({
        points: g.points,
        minutesFloat: g.minutesFloat,
        isStarter: g.isStarter,
        gameDate: g.game.gameDate,
      })),
    }));
  }

  /**
   * Get team injuries
   */
  private async getTeamInjuries(
    teamId: number,
    season: number,
    gameDate: Date
  ): Promise<InjuryInfo[]> {
    const injuries = await this.prisma.injuryReport.findMany({
      where: {
        teamId,
        season,
        reportDate: {
          lte: gameDate,
          gte: new Date(gameDate.getTime() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: {
        playerId: true,
        status: true,
        injuryType: true,
      },
    });

    return injuries;
  }

  /**
   * Get players by position
   */
  private async getPlayersByPosition(
    teamId: number,
    season: number,
    position: string
  ): Promise<PlayerWithStats[]> {
    const players = await this.prisma.player.findMany({
      where: {
        position: {
          contains: position.toUpperCase(),
        },
        teams: {
          some: {
            teamId,
            season,
          },
        },
      },
      include: {
        seasonStats: {
          where: {
            teamId,
            season,
          },
          take: 1,
        },
      },
    });

    return players.map(p => ({
      id: p.id,
      fullName: p.fullName,
      position: p.position,
      seasonStats: p.seasonStats[0] || null,
      recentGames: [],
    }));
  }
}
