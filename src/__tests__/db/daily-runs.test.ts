import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prisma client - hoisted, so no top-level variables
vi.mock('../../server/db/client', () => ({
  prisma: {
    dailyRun: {
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
  createDailyRun,
  getDailyRunById,
  getDailyRunByDate,
  getDailyRunsByStatus,
  getRecentDailyRuns,
  updateDailyRun,
  deleteDailyRun,
  incrementPredictionsCount,
  updateRunStats,
  getDailyRunWithDetails,
  getRunStatistics,
  type DailyRunCreateInput,
  type RunStatus,
} from '../../server/db/repositories/daily-runs-repository';

describe('Daily Runs Repository - Type Validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Type Structure Validation', () => {
    it('should validate DailyRunCreateInput type structure', () => {
      const runDate = new Date('2026-02-13');
      const input: DailyRunCreateInput = {
        runDate,
        status: 'PENDING',
        triggeredBy: 'scheduled',
        traceId: 'trace-abc-123',
        startedAt: null,
        completedAt: null,
        totalMatches: 10,
        predictionsCount: 0,
        picksCount: 0,
        noBetCount: 0,
        hardStopCount: 0,
        dataQualityScore: null,
        errors: null,
      };

      expect(input.runDate).toBe(runDate);
      expect(input.status).toBe('PENDING');
      expect(input.triggeredBy).toBe('scheduled');
      expect(input.totalMatches).toBe(10);
      expect(input.predictionsCount).toBe(0);
    });

    it('should handle RUNNING status with timestamps', () => {
      const input: DailyRunCreateInput = {
        runDate: new Date(),
        status: 'RUNNING',
        triggeredBy: 'manual',
        traceId: 'trace-running',
        startedAt: new Date(),
        completedAt: null,
        totalMatches: 15,
        predictionsCount: 5,
        picksCount: 2,
        noBetCount: 2,
        hardStopCount: 1,
        dataQualityScore: 0.95,
        errors: null,
      };

      expect(input.status).toBe('RUNNING');
      expect(input.startedAt).toBeInstanceOf(Date);
      expect(input.completedAt).toBeNull();
      expect(input.dataQualityScore).toBe(0.95);
    });

    it('should validate all RunStatus enum values', () => {
      const statuses: RunStatus[] = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'];
      
      statuses.forEach((status) => {
        const input: DailyRunCreateInput = {
          runDate: new Date(),
          status,
          triggeredBy: 'test',
          traceId: `trace-${status}`,
        };
        
        expect(input.status).toBe(status);
      });
    });
  });

  describe('Repository Function Exports', () => {
    it('should export createDailyRun function', () => {
      expect(typeof createDailyRun).toBe('function');
    });

    it('should export getDailyRunById function', () => {
      expect(typeof getDailyRunById).toBe('function');
    });

    it('should export getDailyRunByDate function', () => {
      expect(typeof getDailyRunByDate).toBe('function');
    });

    it('should export getDailyRunsByStatus function', () => {
      expect(typeof getDailyRunsByStatus).toBe('function');
    });

    it('should export getRecentDailyRuns function', () => {
      expect(typeof getRecentDailyRuns).toBe('function');
    });

    it('should export updateDailyRun function', () => {
      expect(typeof updateDailyRun).toBe('function');
    });

    it('should export deleteDailyRun function', () => {
      expect(typeof deleteDailyRun).toBe('function');
    });

    it('should export incrementPredictionsCount function', () => {
      expect(typeof incrementPredictionsCount).toBe('function');
    });

    it('should export updateRunStats function', () => {
      expect(typeof updateRunStats).toBe('function');
    });

    it('should export getDailyRunWithDetails function', () => {
      expect(typeof getDailyRunWithDetails).toBe('function');
    });

    it('should export getRunStatistics function', () => {
      expect(typeof getRunStatistics).toBe('function');
    });
  });

  describe('Statistics Fields Validation', () => {
    it('should include all Story 2.4 statistics fields', () => {
      const input: DailyRunCreateInput = {
        runDate: new Date(),
        status: 'COMPLETED',
        triggeredBy: 'api',
        traceId: 'trace-stats',
        totalMatches: 20,
        predictionsCount: 18,
        picksCount: 10,
        noBetCount: 5,
        hardStopCount: 3,
        dataQualityScore: 0.92,
        errors: JSON.stringify(['Minor timeout on match-123']),
      };

      expect(input).toHaveProperty('totalMatches');
      expect(input).toHaveProperty('predictionsCount');
      expect(input).toHaveProperty('picksCount');
      expect(input).toHaveProperty('noBetCount');
      expect(input).toHaveProperty('hardStopCount');
      expect(input).toHaveProperty('dataQualityScore');
      expect(input).toHaveProperty('errors');
    });

    it('should handle zero values correctly', () => {
      const input: DailyRunCreateInput = {
        runDate: new Date(),
        status: 'PENDING',
        triggeredBy: 'scheduled',
        traceId: 'trace-zero',
        totalMatches: 0,
        predictionsCount: 0,
        picksCount: 0,
        noBetCount: 0,
        hardStopCount: 0,
      };

      expect(input.totalMatches).toBe(0);
      expect(input.predictionsCount).toBe(0);
      expect(input.picksCount).toBe(0);
    });
  });

  describe('Repository Operations', () => {
    it('should call prisma.dailyRun.create with correct data', async () => {
      const mockCreate = vi.mocked(prisma.dailyRun.create);
      mockCreate.mockResolvedValue({
        id: 'run-123',
        runDate: new Date('2026-02-13'),
        status: 'PENDING',
        triggeredBy: 'scheduled',
        traceId: 'trace-123',
        totalMatches: 10,
        predictionsCount: 0,
        picksCount: 0,
        noBetCount: 0,
        hardStopCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const input: DailyRunCreateInput = {
        runDate: new Date('2026-02-13'),
        status: 'PENDING',
        triggeredBy: 'scheduled',
        traceId: 'trace-123',
        totalMatches: 10,
      };

      const result = await createDailyRun(input);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.totalMatches).toBe(10);
    });

    it('should call prisma.dailyRun.findUnique for getById', async () => {
      const mockFindUnique = vi.mocked(prisma.dailyRun.findUnique);
      mockFindUnique.mockResolvedValue({
        id: 'run-456',
        runDate: new Date(),
        status: 'RUNNING',
        totalMatches: 15,
      } as any);

      const result = await getDailyRunById('run-456');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'run-456' },
        select: expect.any(Object),
      });
      expect(result).toBeDefined();
    });

    it('should get daily run by date', async () => {
      const mockFindUnique = vi.mocked(prisma.dailyRun.findUnique);
      const runDate = new Date('2026-02-13');
      mockFindUnique.mockResolvedValue({
        id: 'run-date',
        runDate,
        status: 'COMPLETED',
        totalMatches: 20,
      } as any);

      const result = await getDailyRunByDate(runDate);

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { runDate },
        select: expect.any(Object),
      });
      expect(result?.status).toBe('COMPLETED');
    });

    it('should increment predictions count', async () => {
      const mockUpdate = vi.mocked(prisma.dailyRun.update);
      mockUpdate.mockResolvedValue({} as any);

      await incrementPredictionsCount('run-789');

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'run-789' },
        data: {
          predictionsCount: {
            increment: 1,
          },
        },
      });
    });

    it('should update run stats for PICK status', async () => {
      const mockUpdate = vi.mocked(prisma.dailyRun.update);
      mockUpdate.mockResolvedValue({} as any);

      await updateRunStats('run-pick', 'PICK');

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'run-pick' },
        data: {
          picksCount: { increment: 1 },
        },
      });
    });

    it('should update run stats for HARD_STOP status', async () => {
      const mockUpdate = vi.mocked(prisma.dailyRun.update);
      mockUpdate.mockResolvedValue({} as any);

      await updateRunStats('run-stop', 'HARD_STOP');

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'run-stop' },
        data: {
          hardStopCount: { increment: 1 },
        },
      });
    });

    it('should get run statistics with duration', async () => {
      const mockFindUnique = vi.mocked(prisma.dailyRun.findUnique);
      const startedAt = new Date('2026-02-13T10:00:00Z');
      const completedAt = new Date('2026-02-13T10:30:00Z');
      
      mockFindUnique.mockResolvedValue({
        totalMatches: 20,
        predictionsCount: 18,
        picksCount: 10,
        noBetCount: 5,
        hardStopCount: 3,
        dataQualityScore: 0.92,
        startedAt,
        completedAt,
      } as any);

      const result = await getRunStatistics('run-stats');

      expect(result).toBeDefined();
      expect(result?.totalMatches).toBe(20);
      expect(result?.predictionsCount).toBe(18);
      expect(result?.picksCount).toBe(10);
      expect(result?.noBetCount).toBe(5);
      expect(result?.hardStopCount).toBe(3);
      expect(result?.dataQualityScore).toBe(0.92);
      expect(result?.duration).toBe(30); // 30 minutes
    });

    it('should return null duration when run not completed', async () => {
      const mockFindUnique = vi.mocked(prisma.dailyRun.findUnique);
      mockFindUnique.mockResolvedValue({
        totalMatches: 10,
        predictionsCount: 5,
        picksCount: 2,
        noBetCount: 2,
        hardStopCount: 1,
        dataQualityScore: null,
        startedAt: new Date(),
        completedAt: null,
      } as any);

      const result = await getRunStatistics('run-incomplete');

      expect(result?.duration).toBeNull();
    });
  });
});
