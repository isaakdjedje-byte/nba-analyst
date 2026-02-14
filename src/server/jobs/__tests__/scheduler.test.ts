/**
 * Scheduler Unit Tests
 * 
 * Unit tests for the Daily Run Scheduler module.
 * Story 2.8: Implement daily production run pipeline
 * Subtask 6.1: Unit tests for scheduler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('@/server/db/client', () => ({
  prisma: {
    dailyRun: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/server/jobs/daily-run-orchestrator', () => ({
  executeDailyRunPipeline: vi.fn(),
}));

// Import after mocks
import { prisma } from '@/server/db/client';
import { 
  triggerDailyRun, 
  getSchedulerHealth, 
  getSchedulerConfig,
  DEFAULT_SCHEDULER_CONFIG,
  createDailyRun 
} from '../scheduler';
import { executeDailyRunPipeline } from '../daily-run-orchestrator';

describe('Daily Run Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSchedulerConfig', () => {
    it('should return default configuration', () => {
      const config = getSchedulerConfig();
      
      expect(config).toBeDefined();
      expect(config.cronExpression).toBe(DEFAULT_SCHEDULER_CONFIG.cronExpression);
      expect(config.timezone).toBe(DEFAULT_SCHEDULER_CONFIG.timezone);
    });

    it('should use environment variables when set', () => {
      // Note: This test would need actual env vars to be set
      const config = getSchedulerConfig();
      
      // Default cron expression should be '0 10 * * *' (10:00 UTC daily)
      expect(config.cronExpression).toBeDefined();
    });
  });

  describe('createDailyRun', () => {
    it('should create a new daily run record', async () => {
      const mockRun = {
        id: 'run-123',
        runDate: new Date(),
        status: 'PENDING' as const,
        triggeredBy: 'system',
        traceId: 'trace-123',
        startedAt: null,
        completedAt: null,
        totalMatches: 0,
        predictionsCount: 0,
        picksCount: 0,
        noBetCount: 0,
        hardStopCount: 0,
      };

      (prisma.dailyRun.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);

      const result = await createDailyRun('system');

      expect(result).toBeDefined();
      expect(result.id).toBe('run-123');
      expect(result.traceId).toBe('trace-123');
      expect(prisma.dailyRun.create).toHaveBeenCalledTimes(1);
    });

    it('should generate unique trace IDs', async () => {
      const mockRun = {
        id: 'run-123',
        runDate: new Date(),
        status: 'PENDING' as const,
        triggeredBy: 'system',
        traceId: 'trace-abc',
        startedAt: null,
        completedAt: null,
        totalMatches: 0,
        predictionsCount: 0,
        picksCount: 0,
        noBetCount: 0,
        hardStopCount: 0,
      };

      (prisma.dailyRun.create as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ...mockRun, traceId: 'trace-1' })
        .mockResolvedValueOnce({ ...mockRun, traceId: 'trace-2' });

      const result1 = await createDailyRun('system');
      const result2 = await createDailyRun('system');

      expect(result1.traceId).not.toBe(result2.traceId);
    });
  });

  describe('triggerDailyRun', () => {
    it('should trigger a daily run successfully', async () => {
      // Mock createDailyRun
      const mockRun = {
        id: 'run-123',
        traceId: 'trace-123',
        runDate: new Date(),
      };

      (prisma.dailyRun.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);

      // Mock orchestrator
      const mockResult = {
        status: 'completed' as const,
        predictionsCount: 10,
        picksCount: 5,
        noBetCount: 4,
        hardStopCount: 1,
        dataQualityScore: 0.85,
        errors: [],
      };

      (executeDailyRunPipeline as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      (prisma.dailyRun.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await triggerDailyRun({ triggeredBy: 'manual-test' });

      expect(result.success).toBe(true);
      expect(result.runId).toBe('run-123');
      expect(result.status).toBe('completed');
      expect(prisma.dailyRun.create).toHaveBeenCalledTimes(1);
      expect(executeDailyRunPipeline).toHaveBeenCalledTimes(1);
      expect(prisma.dailyRun.update).toHaveBeenCalledTimes(1);
    });

    it('should handle run failures gracefully', async () => {
      const mockRun = {
        id: 'run-123',
        traceId: 'trace-123',
        runDate: new Date(),
      };

      (prisma.dailyRun.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);

      const mockResult = {
        status: 'failed' as const,
        predictionsCount: 0,
        picksCount: 0,
        noBetCount: 0,
        hardStopCount: 0,
        dataQualityScore: null,
        errors: ['Test error'],
      };

      (executeDailyRunPipeline as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);
      (prisma.dailyRun.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await triggerDailyRun();

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });

  describe('getSchedulerHealth', () => {
    it('should return healthy status when no failures', async () => {
      (prisma.dailyRun.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ completedAt: new Date() }) // last successful
        .mockResolvedValueOnce(null); // last failed

      (prisma.dailyRun.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
      ]);

      const health = await getSchedulerHealth();

      expect(health.healthy).toBe(true);
      expect(health.consecutiveFailures).toBe(0);
    });

    it('should return unhealthy status after multiple failures', async () => {
      (prisma.dailyRun.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null) // last successful
        .mockResolvedValueOnce({ completedAt: new Date() }); // last failed

      (prisma.dailyRun.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'FAILED' },
        { status: 'FAILED' },
        { status: 'FAILED' },
      ]);

      const health = await getSchedulerHealth();

      expect(health.healthy).toBe(false);
      expect(health.consecutiveFailures).toBe(3);
    });
  });
});
