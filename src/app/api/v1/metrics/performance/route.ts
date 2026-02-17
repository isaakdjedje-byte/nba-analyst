/**
 * Performance Metrics API
 * Story 4.1: Creer la vue Performance avec historique des recommandations
 * 
 * GET /api/v1/metrics/performance
 * Query parameters:
 *   - fromDate: ISO date string (optional, defaults to 30 days ago)
 *   - toDate: ISO date string (optional, defaults to today)
 * 
 * Response:
 * {
 *   data: { accuracyRate, picksCount, noBetCount, hardStopCount, totalDecisions },
 *   meta: { fromDate, toDate, calculatedAt, traceId }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { calculatePerformanceMetrics, isValidDateRange, getDefaultDateRange } from '@/features/performance/services/metrics-service';
import { checkRateLimitWithBoth, getRateLimitHeaders } from '@/server/cache/rate-limiter';
import { getClientIP } from '@/server/cache/rate-limiter-middleware';

// Generate traceId for response metadata
function generateTraceId(): string {
  return `perf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  const timestamp = new Date().toISOString();

  try {
    // Rate limiting check (NFR10 Security)
    const userId = request.headers.get('x-user-id') || undefined;
    const ip = getClientIP(request);
    const rateLimitResult = await checkRateLimitWithBoth('/api/v1/metrics/performance', userId, ip);
    
    if (!rateLimitResult.success) {
      const headers = getRateLimitHeaders(rateLimitResult);
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Limite de requêtes dépassée. Réessayez dans ${rateLimitResult.retryAfter} secondes.`,
            details: { retryAfter: rateLimitResult.retryAfter },
          },
          meta: { traceId, timestamp },
        },
        { 
          status: 429,
          headers: {
            ...headers,
            'Retry-After': String(rateLimitResult.retryAfter || 60),
          }
        }
      );
    }

    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentification requise',
            details: {},
          },
          meta: { traceId, timestamp },
        },
        { status: 401 }
      );
    }

    // RBAC check - only user, support, ops, admin can read
    const allowedRoles = ['user', 'support', 'ops', 'admin'];
    const userRole = session.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Permissions insuffisantes',
            details: {},
          },
          meta: { traceId, timestamp },
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const fromDateParam = searchParams.get('fromDate');
    const toDateParam = searchParams.get('toDate');

    // Validate date range
    if (!isValidDateRange(fromDateParam, toDateParam)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'Plage de dates invalide. fromDate doit être antérieur à toDate.',
            details: {},
          },
          meta: { traceId, timestamp },
        },
        { status: 400 }
      );
    }

    // Get date range (defaults to last 30 days)
    let dateRange;
    if (fromDateParam && toDateParam) {
      dateRange = {
        fromDate: fromDateParam,
        toDate: toDateParam,
      };
    } else {
      dateRange = getDefaultDateRange();
    }

    // Calculate metrics
    const metrics = await calculatePerformanceMetrics(dateRange);

    // Get rate limit headers for successful response
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    // Return success response
    return NextResponse.json({
      data: metrics,
      meta: {
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
        calculatedAt: timestamp,
        traceId,
      },
    }, {
      headers: rateLimitHeaders,
    });

  } catch (error) {
    // Structured logging for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[PerformanceMetricsAPI] Error:', JSON.stringify({
      traceId,
      timestamp,
      error: errorMessage,
      stack: errorStack,
    }));

    // Return error response
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Échec du calcul des métriques de performance',
          details: { error: errorMessage },
        },
        meta: {
          traceId,
          timestamp,
        },
      },
      { status: 500 }
    );
  }
}
