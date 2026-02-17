import { describe, it, expect } from 'vitest';
import {
  TeamSchema,
  PlayerSchema,
  GameSchema,
  BoxScoreSchema,
  ScheduleSchema,
  GameStatusSchema,
} from '../../server/ingestion/schema/nba-schemas';

describe('NBA Schema Validation', () => {
  describe('TeamSchema', () => {
    it('should validate a valid team', () => {
      const validTeam = {
        id: 1,
        name: 'Lakers',
        city: 'Los Angeles',
        abbreviation: 'LAL',
        conference: 'West',
        division: 'Pacific',
      };

      const result = TeamSchema.safeParse(validTeam);
      expect(result.success).toBe(true);
    });

    it('should reject team with invalid abbreviation', () => {
      const invalidTeam = {
        id: 1,
        name: 'Lakers',
        city: 'Los Angeles',
        abbreviation: 'LALs', // More than 3 chars
        conference: 'West',
        division: 'Pacific',
      };

      const result = TeamSchema.safeParse(invalidTeam);
      expect(result.success).toBe(false);
    });

    it('should reject team with invalid conference', () => {
      const invalidTeam = {
        id: 1,
        name: 'Lakers',
        city: 'Los Angeles',
        abbreviation: 'LAL',
        conference: 'North', // Invalid
        division: 'Pacific',
      };

      const result = TeamSchema.safeParse(invalidTeam);
      expect(result.success).toBe(false);
    });
  });

  describe('PlayerSchema', () => {
    it('should validate a valid player', () => {
      const validPlayer = {
        id: 1,
        firstName: 'LeBron',
        lastName: 'James',
        jerseyNumber: '23',
        position: 'F',
        teamId: 1,
      };

      const result = PlayerSchema.safeParse(validPlayer);
      expect(result.success).toBe(true);
    });

    it('should validate player with optional fields omitted', () => {
      const minimalPlayer = {
        id: 1,
        firstName: 'LeBron',
        lastName: 'James',
        teamId: 1,
      };

      const result = PlayerSchema.safeParse(minimalPlayer);
      expect(result.success).toBe(true);
    });
  });

  describe('GameSchema', () => {
    it('should validate a valid game', () => {
      const validGame = {
        id: 123,
        season: 2024,
        seasonType: 'Regular Season',
        status: 'scheduled',
        date: '2024-01-15T20:00:00Z',
        homeTeam: {
          id: 1,
          name: 'Lakers',
          city: 'Los Angeles',
          abbreviation: 'LAL',
          conference: 'West',
          division: 'Pacific',
        },
        awayTeam: {
          id: 2,
          name: 'Warriors',
          city: 'Golden State',
          abbreviation: 'GSW',
          conference: 'West',
          division: 'Pacific',
        },
      };

      const result = GameSchema.safeParse(validGame);
      expect(result.success).toBe(true);
    });

    it('should validate game with scores', () => {
      const gameWithScores = {
        id: 123,
        season: 2024,
        seasonType: 'Regular Season',
        status: 'completed',
        date: '2024-01-15T20:00:00Z',
        homeTeam: {
          id: 1,
          name: 'Lakers',
          city: 'Los Angeles',
          abbreviation: 'LAL',
          conference: 'West',
          division: 'Pacific',
        },
        awayTeam: {
          id: 2,
          name: 'Warriors',
          city: 'Golden State',
          abbreviation: 'GSW',
          conference: 'West',
          division: 'Pacific',
        },
        homeScore: 112,
        awayScore: 108,
      };

      const result = GameSchema.safeParse(gameWithScores);
      expect(result.success).toBe(true);
    });
  });

  describe('BoxScoreSchema', () => {
    it('should validate a valid box score', () => {
      const validBoxScore = {
        gameId: 123,
        homeTeam: {
          teamId: 1,
          points: 112,
          rebounds: 45,
          assists: 25,
          steals: 8,
          blocks: 5,
          turnovers: 12,
          fieldGoalPercentage: 0.52,
          threePointPercentage: 0.38,
          freeThrowPercentage: 0.85,
        },
        awayTeam: {
          teamId: 2,
          points: 108,
          rebounds: 42,
          assists: 22,
          steals: 6,
          blocks: 4,
          turnovers: 14,
          fieldGoalPercentage: 0.48,
          threePointPercentage: 0.35,
          freeThrowPercentage: 0.80,
        },
        homePlayers: [
          {
            playerId: 1,
            minutes: 36.5,
            points: 30,
            rebounds: 8,
            assists: 6,
            steals: 2,
            blocks: 1,
            turnovers: 3,
            fieldGoalsMade: 12,
            fieldGoalsAttempted: 22,
            threePointersMade: 3,
            threePointersAttempted: 7,
            freeThrowsMade: 3,
            freeThrowsAttempted: 4,
          },
        ],
        awayPlayers: [
          {
            playerId: 101,
            minutes: 38.2,
            points: 28,
            rebounds: 6,
            assists: 5,
            steals: 1,
            blocks: 0,
            turnovers: 2,
            fieldGoalsMade: 10,
            fieldGoalsAttempted: 20,
            threePointersMade: 4,
            threePointersAttempted: 9,
            freeThrowsMade: 4,
            freeThrowsAttempted: 5,
          },
        ],
      };

      const result = BoxScoreSchema.safeParse(validBoxScore);
      expect(result.success).toBe(true);
    });
  });

  describe('ScheduleSchema', () => {
    it('should validate a valid schedule', () => {
      const validSchedule = {
        date: '2024-01-15',
        games: [
          {
            id: 1,
            season: 2024,
            seasonType: 'Regular Season',
            status: 'scheduled',
            date: '2024-01-15T20:00:00Z',
            homeTeam: {
              id: 1,
              name: 'Lakers',
              city: 'Los Angeles',
              abbreviation: 'LAL',
              conference: 'West',
              division: 'Pacific',
            },
            awayTeam: {
              id: 2,
              name: 'Warriors',
              city: 'Golden State',
              abbreviation: 'GSW',
              conference: 'West',
              division: 'Pacific',
            },
          },
        ],
        count: 1,
      };

      const result = ScheduleSchema.safeParse(validSchedule);
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const invalidSchedule = {
        date: '2024/01/15', // Wrong format
        games: [],
        count: 0,
      };

      const result = ScheduleSchema.safeParse(invalidSchedule);
      expect(result.success).toBe(false);
    });
  });

  describe('GameStatusSchema', () => {
    it('should accept all valid statuses', () => {
      const validStatuses = [
        'scheduled',
        'in_progress',
        'halftime',
        'completed',
        'postponed',
        'cancelled',
      ];

      for (const status of validStatuses) {
        const result = GameStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const result = GameStatusSchema.safeParse('invalid_status');
      expect(result.success).toBe(false);
    });
  });
});
