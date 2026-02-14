/**
 * Decisions API - Today's Decisions
 * 
 * GET /api/v1/decisions
 * Query parameters:
 *   - date: ISO date string (optional, defaults to today)
 *   - status: PICK | NO_BET | HARD_STOP (optional)
 * 
 * Story 3.2: Implement Picks view with today's decisions list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { prisma } from '@/server/db/client';
import { getRedisClient } from '@/server/cache/redis-client';
import { checkRateLimitWithBoth, getRateLimitHeaders } from '@/server/cache/rate-limiter';
import { getClientIP } from '@/server/cache/rate-limiter-middleware';

// Cache TTL constant (5 minutes)
const CACHE_TTL_SECONDS = 300;

// Generate traceId for response metadata
function generateTraceId(): string {
  return `dec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Validate status parameter
function isValidStatus(status: string): boolean {
  return ['PICK', 'NO_BET', 'HARD_STOP'].includes(status);
}

// Cache key generator
function getCacheKey(date: string, status?: string): string {
  return status 
    ? `decisions:${date}:${status}`
    : `decisions:${date}`;
}

// Type for Prisma where clause
interface DecisionWhereClause {
  createdAt: {
    gte: Date;
    lte: Date;
  };
  status?: string;
}

// Type for decision from database (based on Prisma include)
interface DecisionFromDB {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  status: string;
  rationale: string;
  edge: number | null;
  confidence: number;
  recommendedPick: string | null;
  runId: string;
  createdAt: Date;
  prediction?: {
    id: string;
    matchId: string;
    league: string | null;
    startTime: Date | null;
  } | null;
  run?: {
    id: string;
    runDate: Date;
    status: string;
  } | null;
}

// Fetch decisions from database
async function fetchDecisionsFromDB(dateStart: Date, dateEnd: Date, status?: string): Promise<DecisionFromDB[]> {
  const where: DecisionWhereClause = {
    createdAt: {
      gte: dateStart,
      lte: dateEnd,
    },
  };

  if (status) {
    where.status = status;
  }

  const decisions = await prisma.policyDecision.findMany({
    where,
    include: {
      prediction: {
        select: {
          id: true,
          matchId: true,
          league: true,
          startTime: true,
        },
      },
      run: {
        select: {
          id: true,
          runDate: true,
          status: true,
        },
      },
    },
    orderBy: {
      matchDate: 'asc',
    },
  });

  return decisions as unknown as DecisionFromDB[];
}

// Get today's date boundaries
function getTodayBoundaries(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  const timestamp = new Date().toISOString();

  try {
    // Rate limiting check (NFR10 Security)
    const userId = request.headers.get('x-user-id') || undefined;
    const ip = getClientIP(request);
    const rateLimitResult = await checkRateLimitWithBoth('/api/v1/decisions', userId, ip);
    
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
    const dateParam = searchParams.get('date');
    const statusParam = searchParams.get('status');

    // Validate status if provided
    if (statusParam && !isValidStatus(statusParam)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STATUS',
            message: `Statut invalide: ${statusParam}. Doit être PICK, NO_BET ou HARD_STOP`,
            details: {},
          },
          meta: { traceId, timestamp },
        },
        { status: 400 }
      );
    }

    // Determine date range (default to today)
    let dateStart: Date;
    let dateEnd: Date;
    let cacheDateKey: string;

    if (dateParam) {
      const parsedDate = new Date(dateParam);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_DATE',
              message: `Format de date invalide: ${dateParam}`,
              details: {},
            },
            meta: { traceId, timestamp },
          },
          { status: 400 }
        );
      }
      dateStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0);
      dateEnd = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 23, 59, 59, 999);
      cacheDateKey = dateParam.split('T')[0];
    } else {
      const today = getTodayBoundaries();
      dateStart = today.start;
      dateEnd = today.end;
      cacheDateKey = new Date().toISOString().split('T')[0];
    }

    // Try cache first (cache-aside pattern)
    const cacheKey = getCacheKey(cacheDateKey, statusParam || undefined);
    let decisions;
    let fromCache = false;

    try {
      const redis = await getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        decisions = JSON.parse(cached as string);
        fromCache = true;
      }
    } catch (cacheError) {
      // Log cache error but continue to database
      console.warn('[DecisionsAPI] Cache error:', cacheError);
    }

    // Fetch from database if not in cache
    if (!decisions) {
      decisions = await fetchDecisionsFromDB(dateStart, dateEnd, statusParam || undefined);

      // Store in cache for 5 minutes
      try {
        const redis = await getRedisClient();
        await redis.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(decisions));
      } catch (cacheError) {
        console.warn('[DecisionsAPI] Failed to cache:', cacheError);
      }
    }

    // Transform data for response
    const transformedDecisions = decisions.map((decision: DecisionFromDB) => ({
      id: decision.id,
      match: {
        id: decision.matchId,
        homeTeam: decision.homeTeam,
        awayTeam: decision.awayTeam,
        startTime: decision.prediction?.startTime 
          ? new Date(decision.prediction.startTime).toISOString()
          : decision.matchDate.toISOString(),
        league: decision.prediction?.league || null,
      },
      status: decision.status,
      rationale: decision.rationale,
      edge: decision.edge,
      confidence: decision.confidence,
      recommendedPick: decision.recommendedPick,
      dailyRunId: decision.runId,
      createdAt: decision.createdAt.toISOString(),
    }));

    // Get rate limit headers for successful response
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    // Return success response with rate limit headers
    return NextResponse.json({
      data: transformedDecisions,
      meta: {
        traceId,
        timestamp,
        count: transformedDecisions.length,
        date: cacheDateKey,
        fromCache,
      },
    }, {
      headers: rateLimitHeaders,
    });

  } catch (error) {
    // Structured logging for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[DecisionsAPI] Error:', JSON.stringify({
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
          message: 'Échec de la récupération des décisions',
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
