/**
 * Investigation Search API
 * Story 4.4: Implementer l'investigation de decision contestee
 * 
 * GET /api/v1/investigations/search
 * Query parameters:
 *   - fromDate: ISO date string (optional)
 *   - toDate: ISO date string (optional)
 *   - matchId: string (optional)
 *   - homeTeam: string (optional)
 *   - awayTeam: string (optional)
 *   - decisionUserId: string (optional) - FR23: user who received the decision
 *   - status: PICK | NO_BET | HARD_STOP | all (optional)
 *   - page: number (optional, default: 1)
 *   - limit: number (optional, default: 20, max: 100)
 * 
 * Response:
 * {
 *   data: InvestigationResult[],
 *   meta: { total, page, limit, totalPages, filters, traceId, timestamp }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { getDecisionHistory, type DecisionHistoryResult } from '@/server/db/repositories/policy-decisions-repository';
import { checkRateLimitWithBoth, getRateLimitHeaders } from '@/server/cache/rate-limiter';
import { getClientIP } from '@/server/cache/rate-limiter-middleware';
import type { DecisionStatus, PolicyDecisionWithRelations } from '@/server/db/repositories/policy-decisions-repository';
import type { 
  InvestigationFilters, 
  InvestigationSearchResponse,
  InvestigationResult 
} from '@/features/investigation/types';
import { v4 as uuidv4 } from 'uuid';

// Generate traceId for response metadata
function generateTraceId(): string {
  return `investigation-${uuidv4()}`;
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

/**
 * Transform a database decision to an InvestigationResult
 */
function transformToInvestigationResult(decision: PolicyDecisionWithRelations): InvestigationResult {
  return {
    id: decision.id,
    matchId: decision.matchId,
    matchDate: decision.matchDate instanceof Date 
      ? decision.matchDate.toISOString() 
      : new Date(decision.matchDate).toISOString(),
    homeTeam: decision.homeTeam,
    awayTeam: decision.awayTeam,
    status: decision.status,
    rationaleSummary: decision.rationale.length > 100
      ? `${decision.rationale.substring(0, 100)}...`
      : decision.rationale,
    confidence: decision.confidence,
    edge: decision.edge,
    traceId: decision.traceId,
    executedAt: decision.executedAt instanceof Date
      ? decision.executedAt.toISOString()
      : new Date(decision.executedAt).toISOString(),
    publishedAt: decision.publishedAt instanceof Date
      ? decision.publishedAt.toISOString()
      : decision.publishedAt 
        ? new Date(decision.publishedAt).toISOString() 
        : null,
    gates: {
      confidence: decision.confidenceGate,
      edge: decision.edgeGate,
      drift: decision.driftGate,
      hardStop: decision.hardStopGate,
    },
    hardStopReason: decision.hardStopReason,
    recommendedPick: decision.recommendedPick,
  };
}

export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  const timestamp = new Date().toISOString();

  try {
    // Rate limiting check (NFR10 Security)
    const requestUserId = request.headers.get('x-user-id') || undefined;
    const ip = getClientIP(request);
    const rateLimitResult = await checkRateLimitWithBoth('/api/v1/investigations/search', requestUserId, ip);
    
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

    // RBAC check - only support, ops, admin can investigate (per story requirements)
    // Investigation is for support/ops to explain decisions to users
    const allowedRoles = ['support', 'ops', 'admin'];
    const userRole = session.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Permissions insuffisantes. Rôle support, ops ou admin requis pour investiguer.',
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
    const matchId = searchParams.get('matchId');
    const homeTeam = searchParams.get('homeTeam');
    const awayTeam = searchParams.get('awayTeam');
    const userId = searchParams.get('userId'); // FR23: user who received the decision
    const status = searchParams.get('status');
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

    // Build filters
    const filters: InvestigationFilters = {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      matchId: matchId || undefined,
      homeTeam: homeTeam || undefined,
      awayTeam: awayTeam || undefined,
      userId: userId || undefined,
      status: status as DecisionStatus | 'all',
    };

    // Get decisions from the database (reuse logs service logic)
    // In a real implementation, this would be a dedicated investigation query
    const dbStatus = status === 'all' ? undefined : status as DecisionStatus;
    const dbFromDate = fromDate ? new Date(fromDate) : undefined;
    const dbToDate = toDate ? new Date(toDate) : undefined;
    const decisions: DecisionHistoryResult = await getDecisionHistory({
      fromDate: dbFromDate,
      toDate: dbToDate,
      status: dbStatus,
      page,
      limit,
    });

    // Apply additional filters (matchId, homeTeam, awayTeam, userId)
    let filteredDecisions = decisions.decisions;
    
    if (matchId) {
      filteredDecisions = filteredDecisions.filter(d => d.matchId.includes(matchId));
    }
    if (homeTeam) {
      filteredDecisions = filteredDecisions.filter(d => 
        d.homeTeam.toLowerCase().includes(homeTeam.toLowerCase())
      );
    }
    if (awayTeam) {
      filteredDecisions = filteredDecisions.filter(d => 
        d.awayTeam.toLowerCase().includes(awayTeam.toLowerCase())
      );
    }
    // FR23: Filter by user who received the decision
    if (userId) {
      filteredDecisions = filteredDecisions.filter(d => 
        d.userId.toLowerCase().includes(userId.toLowerCase())
      );
    }

    // Transform to investigation results
    const results: InvestigationResult[] = filteredDecisions.map(decision => transformToInvestigationResult(decision)).filter(Boolean) as InvestigationResult[];

    // Calculate pagination
    const total = results.length;
    const totalPages = Math.ceil(total / limit);

    // Build response
    const response: InvestigationSearchResponse = {
      data: results,
      meta: {
        total,
        page,
        limit,
        totalPages,
        filters,
        traceId,
        timestamp,
      },
    };

    // Get rate limit headers for successful response
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    // Return success response
    return NextResponse.json(response, {
      headers: rateLimitHeaders,
    });

  } catch (error) {
    // Structured logging for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[InvestigationAPI] Error:', JSON.stringify({
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
          message: 'Échec de la recherche d\'investigation',
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
