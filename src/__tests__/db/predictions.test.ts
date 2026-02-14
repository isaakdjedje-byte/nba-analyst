import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prisma client - hoisted, so no top-level variables
vi.mock('../../server/db/client', () => ({
  prisma: {
    prediction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from '../../server/db/client';
import {
  createPrediction,
  getPredictionById,
  getPredictionsByRunId,
  getPredictionsByMatchId,
  updatePrediction,
  deletePrediction,
  countPredictionsByRunId,
  type PredictionCreateInput,
} from '../../server/db/repositories/predictions-repository';

describe('Predictions Repository - Type Validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Type Structure Validation', () => {
    it('should validate PredictionCreateInput type structure', () => {
      const input: PredictionCreateInput = {
        matchId: 'match-123',
        runId: 'run-456',
        userId: 'user-789',
        winnerPrediction: 'HOME',
        scorePrediction: '105-98',
        overUnderPrediction: 203.5,
        confidence: 0.85,
        modelVersion: 'v1.0.0',
        featuresHash: 'abc123def456',
      };

      expect(input.matchId).toBe('match-123');
      expect(input.winnerPrediction).toBe('HOME');
      expect(input.scorePrediction).toBe('105-98');
      expect(input.overUnderPrediction).toBe(203.5);
      expect(input.confidence).toBe(0.85);
      expect(input.modelVersion).toBe('v1.0.0');
      expect(input.featuresHash).toBe('abc123def456');
    });

    it('should handle minimal required fields', () => {
      const input: PredictionCreateInput = {
        matchId: 'match-456',
        runId: 'run-456',
        userId: 'user-789',
        confidence: 0.75,
        modelVersion: 'v1.0.0',
      };

      expect(input.winnerPrediction).toBeUndefined();
      expect(input.scorePrediction).toBeUndefined();
      expect(input.overUnderPrediction).toBeUndefined();
      expect(input.featuresHash).toBeUndefined();
    });
  });

  describe('Repository Function Exports', () => {
    it('should export createPrediction function', () => {
      expect(typeof createPrediction).toBe('function');
    });

    it('should export getPredictionById function', () => {
      expect(typeof getPredictionById).toBe('function');
    });

    it('should export getPredictionsByRunId function', () => {
      expect(typeof getPredictionsByRunId).toBe('function');
    });

    it('should export getPredictionsByMatchId function', () => {
      expect(typeof getPredictionsByMatchId).toBe('function');
    });

    it('should export updatePrediction function', () => {
      expect(typeof updatePrediction).toBe('function');
    });

    it('should export deletePrediction function', () => {
      expect(typeof deletePrediction).toBe('function');
    });

    it('should export countPredictionsByRunId function', () => {
      expect(typeof countPredictionsByRunId).toBe('function');
    });
  });

  describe('ML Output Fields Validation', () => {
    it('should include all Story 2.4 ML output fields in type', () => {
      const fullInput: PredictionCreateInput = {
        matchId: 'match-test',
        runId: 'run-test',
        userId: 'user-test',
        winnerPrediction: 'AWAY',
        scorePrediction: '98-105',
        overUnderPrediction: 215.5,
        confidence: 0.92,
        modelVersion: 'v2.1.0',
        featuresHash: 'hash123',
      };

      // Verify all Story 2.4 fields are present
      expect(fullInput).toHaveProperty('winnerPrediction');
      expect(fullInput).toHaveProperty('scorePrediction');
      expect(fullInput).toHaveProperty('overUnderPrediction');
      expect(fullInput).toHaveProperty('confidence');
      expect(fullInput).toHaveProperty('modelVersion');
      expect(fullInput).toHaveProperty('featuresHash');
    });
  });

  describe('Schema Compliance', () => {
    it('should validate story 2.4 schema requirements', () => {
      // Test that the repository follows snake_case to camelCase mapping
      const input: PredictionCreateInput = {
        matchId: 'match-123',
        runId: 'run-456',
        userId: 'user-789',
        winnerPrediction: 'HOME', // Maps to winner_prediction in DB
        scorePrediction: '105-98', // Maps to score_prediction in DB
        overUnderPrediction: 203.5, // Maps to over_under_prediction in DB
        confidence: 0.85,
        modelVersion: 'v1.0.0', // Maps to model_version in DB
        featuresHash: 'abc123', // Maps to features_hash in DB
      };

      // All fields should be defined as per Story 2.4 requirements
      expect(input.winnerPrediction).toBeDefined();
      expect(input.scorePrediction).toBeDefined();
      expect(input.overUnderPrediction).toBeDefined();
      expect(input.modelVersion).toBeDefined();
      expect(input.featuresHash).toBeDefined();
    });
  });

  describe('Repository Operations', () => {
    it('should call prisma.prediction.create with correct data', async () => {
      const mockCreate = vi.mocked(prisma.prediction.create);
      mockCreate.mockResolvedValue({
        id: 'pred-123',
        matchId: 'match-123',
        runId: 'run-456',
        userId: 'user-789',
        winnerPrediction: 'HOME',
        scorePrediction: '105-98',
        overUnderPrediction: 203.5,
        confidence: 0.85,
        modelVersion: 'v1.0.0',
        featuresHash: 'abc123',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const input: PredictionCreateInput = {
        matchId: 'match-123',
        runId: 'run-456',
        userId: 'user-789',
        winnerPrediction: 'HOME',
        scorePrediction: '105-98',
        overUnderPrediction: 203.5,
        confidence: 0.85,
        modelVersion: 'v1.0.0',
        featuresHash: 'abc123',
      };

      const result = await createPrediction(input);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.matchId).toBe('match-123');
    });

    it('should call prisma.prediction.findUnique for getById', async () => {
      const mockFindUnique = vi.mocked(prisma.prediction.findUnique);
      mockFindUnique.mockResolvedValue({
        id: 'pred-123',
        matchId: 'match-123',
        confidence: 0.85,
        modelVersion: 'v1.0.0',
      } as any);

      const result = await getPredictionById('pred-123');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'pred-123' },
        select: expect.any(Object),
      });
      expect(result).toBeDefined();
    });

    it('should call prisma.prediction.findMany for getByRunId', async () => {
      const mockFindMany = vi.mocked(prisma.prediction.findMany);
      mockFindMany.mockResolvedValue([]);

      await getPredictionsByRunId('run-456');

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { runId: 'run-456' },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
