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
  const fromDateStr = fromDate.toISOString().split('T')[0];
  const toDateStr = toDate.toISOString().split('T')[0];
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
 * Fetch metrics directly from database using aggregation for better performance
 * @param fromDate - Start date
 * @param toDate - End date
 * @returns PerformanceMetrics
 */
async function fetchMetricsFromDB(fromDate: Date, toDate: Date): Promise<PerformanceMetrics> {
  // Use Prisma aggregation for better performance - avoids fetching all records
  const [totalResult, picksResult, noBetResult, hardStopResult] = await Promise.all([
    prisma.policyDecision.count({
      where: {
        matchDate: { gte: fromDate, lte: toDate },
        publishedAt: { not: null },
      },
    }),
    prisma.policyDecision.count({
      where: {
        matchDate: { gte: fromDate, lte: toDate },
        publishedAt: { not: null },
        status: 'PICK',
      },
    }),
    prisma.policyDecision.count({
      where: {
        matchDate: { gte: fromDate, lte: toDate },
        publishedAt: { not: null },
        status: 'NO_BET',
      },
    }),
    prisma.policyDecision.count({
      where: {
        matchDate: { gte: fromDate, lte: toDate },
        publishedAt: { not: null },
        status: 'HARD_STOP',
      },
    }),
  ]);

  const totalDecisions = totalResult;
  const picksCount = picksResult;
  const noBetCount = noBetResult;
  const hardStopCount = hardStopResult;

  // Calculate accuracy rate
  const accuracyRate = totalDecisions > 0 
    ? Math.round((picksCount / totalDecisions) * 100 * 10) / 10 
    : 0;

  return {
    accuracyRate,
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
    fromDate: fromDate.toISOString().split('T')[0],
    toDate: toDate.toISOString().split('T')[0],
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
