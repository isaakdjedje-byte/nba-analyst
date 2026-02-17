/**
 * Logs API
 * Story 4.2: Implementer la vue Logs avec historique des decisions
 * 
 * GET /api/v1/logs
 * Query parameters:
 *   - fromDate: ISO date string (optional)
 *   - toDate: ISO date string (optional)
 *   - status: PICK | NO_BET | HARD_STOP | all (optional)
 *   - sortBy: matchDate | executedAt (optional, default: matchDate)
 *   - sortOrder: asc | desc (optional, default: desc)
 *   - page: number (optional, default: 1)
 *   - limit: number (optional, default: 20, max: 100)
 * 
 * Response:
 * {
 *   data: LogEntry[],
 *   meta: { total, page, limit, totalPages, fromDate, toDate, status, sortBy, sortOrder, traceId, timestamp }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { getLogs } from '@/server/logs/logs-service';
import { checkRateLimitWithBoth, getRateLimitHeaders } from '@/server/cache/rate-limiter';
import { getClientIP } from '@/server/cache/rate-limiter-middleware';
import type { DecisionStatus } from '@/server/db/repositories/policy-decisions-repository';
import type { LogSortField, LogSortOrder } from '@/features/logs/types';

// Generate traceId for response metadata
function generateTraceId(): string {
  return `logs-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Validate date string
function isValidDate(dateStr: string | null): boolean {
  if (!dateStr) return true;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// Validate status
function isValidStatus(status: string | null): boolean {
  if (!status) return true;
  return ['PICK', 'NO_BET', 'HARD_STOP', 'all'].includes(status);
}

// Validate sort params
function isValidSortBy(sortBy: string | null): boolean {
  if (!sortBy) return true;
  return ['matchDate', 'executedAt'].includes(sortBy);
}

function isValidSortOrder(order: string | null): boolean {
  if (!order) return true;
  return ['asc', 'desc'].includes(order);
}

export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  const timestamp = new Date().toISOString();

  try {
    // Rate limiting check (NFR10 Security)
    const userId = request.headers.get('x-user-id') || undefined;
    const ip = getClientIP(request);
    const rateLimitResult = await checkRateLimitWithBoth('/api/v1/logs', userId, ip);
    
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
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') as LogSortField | null;
    const sortOrder = searchParams.get('sortOrder') as LogSortOrder | null;
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    // Validate date params
    if (!isValidDate(fromDate) || !isValidDate(toDate)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'Format de date invalide. Utilisez le format ISO 8601 (YYYY-MM-DD).',
            details: {},
          },
          meta: { traceId, timestamp },
        },
        { status: 400 }
      );
    }

    // Validate status
    if (!isValidStatus(status)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STATUS',
            message: 'Statut invalide. Les valeurs valides sont: PICK, NO_BET, HARD_STOP, all.',
            details: {},
          },
          meta: { traceId, timestamp },
        },
        { status: 400 }
      );
    }

    // Validate sort params
    if (!isValidSortBy(sortBy) || !isValidSortOrder(sortOrder)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_SORT_PARAMS',
            message: 'Paramètres de tri invalides. sortBy: matchDate|executedAt, sortOrder: asc|desc.',
            details: {},
          },
          meta: { traceId, timestamp },
        },
        { status: 400 }
      );
    }

    // Parse pagination params
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_PAGE',
            message: 'Page invalide. Doit être un nombre positif.',
            details: {},
          },
          meta: { traceId, timestamp },
        },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_LIMIT',
            message: 'Limit invalide. Doit être entre 1 et 100.',
            details: {},
          },
          meta: { traceId, timestamp },
        },
        { status: 400 }
      );
    }

    // Get logs
    const logs = await getLogs({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      status: (status as DecisionStatus | 'all') || 'all',
      sortBy: sortBy || 'matchDate',
      sortOrder: sortOrder || 'desc',
      page,
      limit,
    });

    // Get rate limit headers for successful response
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    // Return success response
    return NextResponse.json(logs, {
      headers: rateLimitHeaders,
    });

  } catch (error) {
    // Structured logging for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[LogsAPI] Error:', JSON.stringify({
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
          message: 'Échec de la récupération des logs',
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
