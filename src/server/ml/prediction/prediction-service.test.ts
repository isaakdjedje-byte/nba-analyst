import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({
  prisma: {
    game: {
      findMany: findManyMock,
    },
    featureStore: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/server/ml/features/feature-engineering', () => ({
  createFeatureEngineeringService: vi.fn(() => ({})),
  FeatureEngineeringService: class {},
}));

vi.mock('@/server/ml/training/training-service', () => ({
  createTrainingService: vi.fn(() => ({})),
  TrainingService: class {},
}));

import { PredictionService } from './prediction-service';

describe('PredictionService data mapping', () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it('maps persisted games to ingestion box score shape', async () => {
    const service = new PredictionService();
    const beforeDate = new Date('2026-01-01T00:00:00.000Z');

    findManyMock.mockResolvedValue([
      {
        externalId: 1001,
        homeTeamId: 1,
        awayTeamId: 2,
        boxScore: {
          homePoints: 110,
          homeRebounds: 44,
          homeAssists: 25,
          homeSteals: 8,
          homeBlocks: 5,
          homeTurnovers: 11,
          homeFgPct: 0.49,
          home3pPct: 0.38,
          homeFtPct: 0.82,
          awayPoints: 102,
          awayRebounds: 41,
          awayAssists: 22,
          awaySteals: 6,
          awayBlocks: 4,
          awayTurnovers: 13,
          awayFgPct: 0.45,
          away3pPct: 0.35,
          awayFtPct: 0.77,
        },
      },
      {
        externalId: 1002,
        homeTeamId: 1,
        awayTeamId: 3,
        boxScore: null,
      },
    ]);

    const result = await (service as unknown as {
      fetchTeamBoxScores: (teamId: number, date: Date, limit: number) => Promise<Array<{ gameId: number }>>;
    }).fetchTeamBoxScores(1, beforeDate, 20);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        OR: [{ homeTeamId: 1 }, { awayTeamId: 1 }],
        gameDate: { lt: beforeDate },
        status: 'completed',
        boxScore: { isNot: null },
      },
      include: { boxScore: true },
      orderBy: { gameDate: 'desc' },
      take: 20,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.gameId).toBe(1001);
  });

  it('maps h2h games to ingestion game schema enums', async () => {
    const service = new PredictionService();

    findManyMock.mockResolvedValue([
      {
        externalId: 2001,
        season: 2025,
        seasonType: 'playoffs',
        gameDate: new Date('2025-05-01T00:00:00.000Z'),
        homeTeamId: 10,
        homeTeamName: 'Home Team',
        homeTeamAbbreviation: 'HOM',
        homeTeamConference: 'WEST',
        awayTeamId: 20,
        awayTeamName: 'Away Team',
        awayTeamAbbreviation: 'AWY',
        awayTeamConference: 'east',
        homeScore: null,
        awayScore: 99,
        arena: null,
        attendance: 18000,
      },
    ]);

    const result = await (service as unknown as {
      fetchH2HGames: (a: number, b: number, limit: number) => Promise<Array<{ seasonType: string; homeTeam: { conference: string }; awayTeam: { conference: string }; homeScore?: number; awayScore?: number }>>;
    }).fetchH2HGames(10, 20, 5);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        OR: [
          { homeTeamId: 10, awayTeamId: 20 },
          { homeTeamId: 20, awayTeamId: 10 },
        ],
        status: 'completed',
      },
      orderBy: { gameDate: 'desc' },
      take: 5,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.seasonType).toBe('Playoffs');
    expect(result[0]?.homeTeam.conference).toBe('West');
    expect(result[0]?.awayTeam.conference).toBe('East');
    expect(result[0]?.homeScore).toBeUndefined();
    expect(result[0]?.awayScore).toBe(99);
  });
});
