/**
 * Unit Tests for Performance Metrics Service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  cacheGetMock,
  cacheSetMock,
  cacheDeleteByPatternMock,
  policyDecisionCountMock,
  policyDecisionGroupByMock,
  policyDecisionFindManyMock,
  predictionFindManyMock,
  predictionLogCountMock,
} = vi.hoisted(() => ({
  cacheGetMock: vi.fn(),
  cacheSetMock: vi.fn(),
  cacheDeleteByPatternMock: vi.fn(),
  policyDecisionCountMock: vi.fn(),
  policyDecisionGroupByMock: vi.fn(),
  policyDecisionFindManyMock: vi.fn(),
  predictionFindManyMock: vi.fn(),
  predictionLogCountMock: vi.fn(),
}));

vi.mock('@/server/cache/cache-service', () => ({
  CacheService: class {
    constructor() {}
    get = cacheGetMock;
    set = cacheSetMock;
    deleteByPattern = cacheDeleteByPatternMock;
  },
}));

vi.mock('@/server/db/client', () => ({
  prisma: {
    policyDecision: {
      count: policyDecisionCountMock,
      groupBy: policyDecisionGroupByMock,
      findMany: policyDecisionFindManyMock,
    },
    prediction: {
      findMany: predictionFindManyMock,
    },
    predictionLog: {
      count: predictionLogCountMock,
    },
  },
}));

import {
  calculatePerformanceMetrics,
  getDefaultDateRange,
  invalidateMetricsCache,
  isValidDateRange,
} from './metrics-service';

describe('Performance Metrics Service', () => {
  beforeEach(() => {
    cacheGetMock.mockReset();
    cacheSetMock.mockReset();
    cacheDeleteByPatternMock.mockReset();
    policyDecisionCountMock.mockReset();
    policyDecisionGroupByMock.mockReset();
    policyDecisionFindManyMock.mockReset();
    predictionFindManyMock.mockReset();
    predictionLogCountMock.mockReset();

    cacheGetMock.mockResolvedValue(null);
    cacheSetMock.mockResolvedValue(undefined);
    cacheDeleteByPatternMock.mockResolvedValue(3);

    policyDecisionCountMock.mockResolvedValue(3);
    policyDecisionGroupByMock.mockResolvedValue([
      { status: 'PICK', _count: { status: 2 } },
      { status: 'NO_BET', _count: { status: 1 } },
    ]);
    policyDecisionFindManyMock.mockResolvedValue([
      { predictionId: 'pred-1' },
      { predictionId: 'pred-2' },
    ]);
    predictionFindManyMock.mockResolvedValue([
      { id: 'pred-1' },
      { id: 'pred-2' },
    ]);
    predictionLogCountMock.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
  });

  describe('getDefaultDateRange', () => {
    it('returns a valid local YYYY-MM-DD range', () => {
      const result = getDefaultDateRange();

      expect(result.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(result.fromDate).getTime()).toBeLessThanOrEqual(new Date(result.toDate).getTime());
    });
  });

  describe('isValidDateRange', () => {
    it('returns true for valid ranges and optional params', () => {
      expect(isValidDateRange('2026-01-01', '2026-01-31')).toBe(true);
      expect(isValidDateRange(null, null)).toBe(true);
      expect(isValidDateRange(undefined, undefined)).toBe(true);
    });

    it('returns false for invalid ranges', () => {
      expect(isValidDateRange('not-a-date', '2026-01-31')).toBe(false);
      expect(isValidDateRange('2026-01-31', '2026-01-01')).toBe(false);
    });
  });

  describe('calculatePerformanceMetrics', () => {
    it('filters by matchDate (not executedAt) and computes pick metrics', async () => {
      const result = await calculatePerformanceMetrics(
        { fromDate: '2026-01-01', toDate: '2026-01-31' },
        { skipCache: true }
      );

      expect(policyDecisionCountMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            matchDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );

      const whereArg = policyDecisionCountMock.mock.calls[0][0].where as Record<string, unknown>;
      expect(whereArg).not.toHaveProperty('executedAt');

      expect(result.totalDecisions).toBe(3);
      expect(result.picksCount).toBe(2);
      expect(result.noBetCount).toBe(1);
      expect(result.hardStopCount).toBe(0);
      expect(result.resolvedPicksCount).toBe(2);
      expect(result.wonPicksCount).toBe(1);
      expect(result.pendingPicksCount).toBe(0);
      expect(result.pickWinRate).toBe(50);
      expect(result.accuracyRate).toBe(50);
    });

    it('builds distinct cache keys for different date ranges', async () => {
      await calculatePerformanceMetrics({ fromDate: '2026-01-01', toDate: '2026-01-31' });
      await calculatePerformanceMetrics({ fromDate: '2026-02-01', toDate: '2026-02-28' });

      expect(cacheGetMock).toHaveBeenNthCalledWith(1, 'performance:2026-01-01:2026-01-31:v2-all-seasons');
      expect(cacheGetMock).toHaveBeenNthCalledWith(2, 'performance:2026-02-01:2026-02-28:v2-all-seasons');
      expect(cacheSetMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateMetricsCache', () => {
    it('invalidates performance cache namespace', async () => {
      const deleted = await invalidateMetricsCache();

      expect(cacheDeleteByPatternMock).toHaveBeenCalledWith('performance:*');
      expect(deleted).toBe(3);
    });
  });
});
