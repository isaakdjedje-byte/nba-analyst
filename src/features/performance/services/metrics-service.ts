/**
 * Performance Metrics Service
 * Story 4.1: Creer la vue Performance avec historique des recommandations
 * 
 * Provides aggregated performance metrics from historical decisions
 * Uses Redis cache-aside pattern for performance optimization
 */

import { prisma } from '@/server/db/client';
import { CacheService } from '@/server/cache/cache-service';
import { CACHE_TTL, performanceKeys } from '@/server/cache/cache-keys';
import type { PerformanceMetrics, DateRange } from '../types';

// Create cache service for performance metrics (5 min TTL)
const metricsCache = new CacheService(CACHE_TTL.PERFORMANCE_METRICS);

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate performance metrics for a given date range
 * Uses cache-aside pattern: check cache first, fetch if miss, store in cache
 * 
 * @param dateRange - Optional date range filter (defaults to last 30 days)
 * @param options - Cache options (skipCache for force refresh)
 * @returns PerformanceMetrics object with accuracy rate and decision counts
 */
export async function calculatePerformanceMetrics(
  dateRange?: DateRange,
  options: { skipCache?: boolean } = {}
): Promise<PerformanceMetrics> {
  // Default to last 30 days if no range provided
  let fromDate: Date;
  let toDate: Date;

  if (dateRange?.fromDate && dateRange?.toDate) {
    fromDate = new Date(dateRange.fromDate);
    toDate = new Date(dateRange.toDate);
    fromDate.setHours(0, 0, 0, 0);
    // Set to end of day
    toDate.setHours(23, 59, 59, 999);
  } else {
    // Default: last 30 days
    toDate = new Date();
    fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    fromDate.setHours(0, 0, 0, 0);
  }

  // Generate cache key from date range
  const fromDateStr = formatLocalDate(fromDate);
  const toDateStr = formatLocalDate(toDate);
  const cacheKey = performanceKeys.metrics(fromDateStr, toDateStr);

  // Cache-aside pattern: try cache first
  const cachedMetrics = await metricsCache.get<PerformanceMetrics>(cacheKey);
  
  if (cachedMetrics && !options.skipCache) {
    return cachedMetrics;
  }

  // Cache miss - fetch from database
  const metrics = await fetchMetricsFromDB(fromDate, toDate);

  // Store in cache for future requests
  await metricsCache.set(cacheKey, metrics);

  return metrics;
}

/**
 * Fetch metrics directly from database
 * @param fromDate - Start date
 * @param toDate - End date
 * @returns PerformanceMetrics
 */
async function fetchMetricsFromDB(fromDate: Date, toDate: Date): Promise<PerformanceMetrics> {
  const where = {
    matchDate: {
      gte: fromDate,
      lte: toDate,
    },
    NOT: {
      modelVersion: {
        startsWith: 'season-end-',
      },
    },
  };

  const [totalDecisions, groupedByStatus] = await Promise.all([
    prisma.policyDecision.count({ where }),
    prisma.policyDecision.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
    }),
  ]);

  const picksCount = groupedByStatus.find((g) => g.status === 'PICK')?._count.status ?? 0;
  const noBetCount = groupedByStatus.find((g) => g.status === 'NO_BET')?._count.status ?? 0;
  const hardStopCount = groupedByStatus.find((g) => g.status === 'HARD_STOP')?._count.status ?? 0;

  const pickedPredictionIds = await prisma.policyDecision.findMany({
    where: {
      ...where,
      status: 'PICK',
    },
    select: {
      predictionId: true,
    },
  });

  const predictionIds = pickedPredictionIds.map((row) => row.predictionId);

  const [resolvedPicksCount, wonPicksCount] = predictionIds.length > 0
    ? await Promise.all([
        prisma.predictionLog.count({
          where: {
            predictionId: { in: predictionIds },
            resolvedAt: { not: null },
          },
        }),
        prisma.predictionLog.count({
          where: {
            predictionId: { in: predictionIds },
            correct: true,
          },
        }),
      ])
    : [0, 0];

  const pendingPicksCount = Math.max(picksCount - resolvedPicksCount, 0);
  const pickWinRate = resolvedPicksCount > 0
    ? Math.round((wonPicksCount / resolvedPicksCount) * 1000) / 10
    : null;

  // Keep existing response field for backward compatibility.
  const accuracyRate = pickWinRate ?? 0;

  return {
    accuracyRate,
    pickWinRate,
    resolvedPicksCount,
    wonPicksCount,
    pendingPicksCount,
    picksCount,
    noBetCount,
    hardStopCount,
    totalDecisions,
  };
}

/**
 * Invalidate all performance metrics cache
 * Call this when new decisions are published
 */
export async function invalidateMetricsCache(): Promise<number> {
  return await metricsCache.deleteByPattern('performance:*');
}

/**
 * Validate date range parameters
 */
export function isValidDateRange(fromDate?: string | null, toDate?: string | null): boolean {
  if (!fromDate || !toDate) return true; // Optional
  
  const from = new Date(fromDate);
  const to = new Date(toDate);
  
  return !isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to;
}

/**
 * Get default date range (last 30 days)
 */
export function getDefaultDateRange(): DateRange {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  
  return {
    fromDate: formatLocalDate(fromDate),
    toDate: formatLocalDate(toDate),
  };
}

/**
 * Calculate performance metrics with forced refresh (bypass cache)
 */
export async function calculatePerformanceMetricsNoCache(
  dateRange?: DateRange
): Promise<PerformanceMetrics> {
  return calculatePerformanceMetrics(dateRange, { skipCache: true });
}
