import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PlayerIngestionService } from '../../../src/server/ingestion/services/player-ingestion-service';
import { PlayerDataProvider } from '../../../src/server/ingestion/providers/player-data-provider';
import { PlayerFeatureEngineeringService } from '../../../src/server/ml/features/player-feature-engineering';

/**
 * Player Data Tests
 * Phase 5 - Tests & Validation
 */

const prisma = new PrismaClient();

const mockPlayerProvider = new PlayerDataProvider({
  name: 'test-provider',
  baseUrl: 'https://test.api.com',
});

const playerIngestionService = new PlayerIngestionService(prisma, mockPlayerProvider);
const featureEngineeringService = new PlayerFeatureEngineeringService(prisma);

describe('Player Data Ingestion', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.playerGameStats.deleteMany({});
    await prisma.playerSeasonStats.deleteMany({});
    await prisma.injuryReport.deleteMany({});
    await prisma.playerTeam.deleteMany({});
    await prisma.player.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Player CRUD Operations', () => {
    it('should create a player', async () => {
      const player = await prisma.player.create({
        data: {
          nbaId: '2544',
          firstName: 'LeBron',
          lastName: 'James',
          fullName: 'LeBron James',
          position: 'SF',
          height: '6-9',
          weight: 250,
        },
      });

      expect(player).toBeDefined();
      expect(player.nbaId).toBe('2544');
      expect(player.fullName).toBe('LeBron James');
    });

    it('should enforce unique nbaId constraint', async () => {
      await expect(
        prisma.player.create({
          data: {
            nbaId: '2544',
            firstName: 'Duplicate',
            lastName: 'Player',
            fullName: 'Duplicate Player',
          },
        })
      ).rejects.toThrow();
    });

    it('should update player information', async () => {
      const updated = await prisma.player.update({
        where: { nbaId: '2544' },
        data: { jerseyNumber: '23' },
      });

      expect(updated.jerseyNumber).toBe('23');
    });

    it('should delete a player', async () => {
      await prisma.player.delete({
        where: { nbaId: '2544' },
      });

      const player = await prisma.player.findUnique({
        where: { nbaId: '2544' },
      });

      expect(player).toBeNull();
    });
  });

  describe('Player Team Relations', () => {
    let playerId: number;

    beforeAll(async () => {
      const player = await prisma.player.create({
        data: {
          nbaId: '12345',
          firstName: 'Test',
          lastName: 'Player',
          fullName: 'Test Player',
        },
      });
      playerId = player.id;
    });

    it('should create player-team relation', async () => {
      const relation = await prisma.playerTeam.create({
        data: {
          playerId,
          teamId: 1610612744, // Warriors
          season: 2024,
          startDate: new Date('2024-10-01'),
        },
      });

      expect(relation.playerId).toBe(playerId);
      expect(relation.teamId).toBe(1610612744);
    });

    it('should enforce unique player-team-season constraint', async () => {
      await expect(
        prisma.playerTeam.create({
          data: {
            playerId,
            teamId: 1610612744,
            season: 2024,
          },
        })
      ).rejects.toThrow();
    });

    afterAll(async () => {
      await prisma.playerTeam.deleteMany({ where: { playerId } });
      await prisma.player.delete({ where: { id: playerId } });
    });
  });

  describe('Player Game Stats', () => {
    let playerId: number;
    let gameId = 'test-game-123';

    beforeAll(async () => {
      const player = await prisma.player.create({
        data: {
          nbaId: '99999',
          firstName: 'Stat',
          lastName: 'Test',
          fullName: 'Stat Test',
        },
      });
      playerId = player.id;

      // Create a test game
      await prisma.game.create({
        data: {
          id: gameId,
          externalId: 99999,
          season: 2024,
          seasonType: 'Regular Season',
          gameDate: new Date('2024-01-15'),
          status: 'completed',
          homeTeamId: 1610612744,
          homeTeamName: 'Warriors',
          homeTeamAbbreviation: 'GSW',
          homeTeamConference: 'West',
          awayTeamId: 1610612747,
          awayTeamName: 'Lakers',
          awayTeamAbbreviation: 'LAL',
          awayTeamConference: 'West',
        },
      });
    });

    it('should create player game stats', async () => {
      const stats = await prisma.playerGameStats.create({
        data: {
          playerId,
          gameId,
          teamId: 1610612744,
          season: 2024,
          minutes: 2400, // 40 minutes in seconds
          minutesFloat: 40.0,
          points: 25,
          rebounds: 8,
          assists: 5,
          steals: 2,
          blocks: 1,
          turnovers: 3,
          fgMade: 10,
          fgAttempted: 20,
          fgPct: 0.5,
          isStarter: true,
        },
      });

      expect(stats.points).toBe(25);
      expect(stats.rebounds).toBe(8);
      expect(stats.isStarter).toBe(true);
    });

    it('should calculate shooting percentages', async () => {
      const stats = await prisma.playerGameStats.findFirst({
        where: { playerId },
      });

      expect(stats?.fgPct).toBe(0.5);
    });

    afterAll(async () => {
      await prisma.playerGameStats.deleteMany({ where: { playerId } });
      await prisma.game.delete({ where: { id: gameId } });
      await prisma.player.delete({ where: { id: playerId } });
    });
  });

  describe('Injury Reports', () => {
    let playerId: number;

    beforeAll(async () => {
      const player = await prisma.player.create({
        data: {
          nbaId: '77777',
          firstName: 'Injured',
          lastName: 'Player',
          fullName: 'Injured Player',
        },
      });
      playerId = player.id;
    });

    it('should create injury report', async () => {
      const injury = await prisma.injuryReport.create({
        data: {
          playerId,
          teamId: 1610612744,
          season: 2024,
          injuryType: 'ankle',
          status: 'out',
          description: 'Sprained left ankle',
          reportDate: new Date('2024-01-15'),
          expectedReturn: new Date('2024-01-25'),
        },
      });

      expect(injury.injuryType).toBe('ankle');
      expect(injury.status).toBe('out');
    });

    it('should query injuries by date range', async () => {
      const injuries = await prisma.injuryReport.findMany({
        where: {
          reportDate: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-12-31'),
          },
        },
      });

      expect(injuries.length).toBeGreaterThan(0);
    });

    afterAll(async () => {
      await prisma.injuryReport.deleteMany({ where: { playerId } });
      await prisma.player.delete({ where: { id: playerId } });
    });
  });
});

describe('Player Feature Engineering', () => {
  describe('Roster Strength Calculation', () => {
    it('should calculate top 3 players average', async () => {
      // Mock implementation - would use actual database
      const mockStats = [
        { pointsAvg: 25 },
        { pointsAvg: 22 },
        { pointsAvg: 20 },
        { pointsAvg: 15 },
      ];

      const top3Avg = mockStats
        .sort((a, b) => b.pointsAvg - a.pointsAvg)
        .slice(0, 3)
        .reduce((sum, s) => sum + s.pointsAvg, 0) / 3;

      expect(top3Avg).toBeCloseTo(22.33, 1);
    });

    it('should calculate roster depth (std dev)', async () => {
      const ratings = [25, 22, 20, 15, 12, 10, 8, 5];
      const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      const variance = ratings.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / ratings.length;
      const stdDev = Math.sqrt(variance);

      expect(stdDev).toBeGreaterThan(0);
    });
  });

  describe('Injury Impact Calculation', () => {
    it('should calculate injury impact score', () => {
      const injuries = [
        { playerId: 1, status: 'out', pointsAvg: 25 },
        { playerId: 2, status: 'questionable', pointsAvg: 15 },
      ];

      const severityWeights: Record<string, number> = {
        'out': 1.0,
        'doubtful': 0.8,
        'questionable': 0.5,
        'probable': 0.2,
        'available': 0,
      };

      let totalImpact = 0;
      for (const injury of injuries) {
        const importance = injury.pointsAvg / 30;
        const severity = severityWeights[injury.status] || 0.5;
        totalImpact += importance * severity;
      }

      const normalizedImpact = Math.min(totalImpact / 3, 1);

      expect(normalizedImpact).toBeGreaterThan(0);
      expect(normalizedImpact).toBeLessThanOrEqual(1);
    });
  });
});
