/**
 * Decisions API - Today's Decisions
 * 
 * GET /api/v1/decisions
 * Query parameters:
 *   - date: ISO date string (optional, defaults to today)
 *   - status: PICK | NO_BET | HARD_STOP (optional)
 *   - page: number (optional, default: 1)
 *   - limit: number (optional, default: 20, max: 100)
 * 
 * Story 3.2: Implement Picks view with today's decisions list
 * C12: Added pagination support
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/server/db/client';
import { getRedisClient } from '@/server/cache/redis-client';
import { checkRateLimitWithBoth, getRateLimitHeaders } from '@/server/cache/rate-limiter';
import { getClientIP } from '@/server/cache/rate-limiter-middleware';
import type { Prisma } from '@prisma/client';

type DecisionStatus = 'PICK' | 'NO_BET' | 'HARD_STOP';

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

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Type for Prisma where clause
type DecisionWhereClause = Prisma.PolicyDecisionWhereInput;

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
  } | null;
  run?: {
    id: string;
    runDate: Date;
    status: string;
  } | null;
}

function normalizeDecisionFromCache(input: unknown): DecisionFromDB | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const matchId = typeof record.matchId === 'string' ? record.matchId : null;
  const homeTeam = typeof record.homeTeam === 'string' ? record.homeTeam : null;
  const awayTeam = typeof record.awayTeam === 'string' ? record.awayTeam : null;
  const status = typeof record.status === 'string' ? record.status : null;
  const rationale = typeof record.rationale === 'string' ? record.rationale : null;
  const runId = typeof record.runId === 'string' ? record.runId : null;
  const confidence = typeof record.confidence === 'number' ? record.confidence : null;

  if (!id || !matchId || !homeTeam || !awayTeam || !status || !rationale || !runId || confidence === null) {
    return null;
  }

  const matchDate = new Date(String(record.matchDate));
  const createdAt = new Date(String(record.createdAt));

  if (Number.isNaN(matchDate.getTime()) || Number.isNaN(createdAt.getTime())) {
    return null;
  }

  return {
    id,
    matchId,
    homeTeam,
    awayTeam,
    matchDate,
    status,
    rationale,
    edge: typeof record.edge === 'number' ? record.edge : null,
    confidence,
    recommendedPick: typeof record.recommendedPick === 'string' ? record.recommendedPick : null,
    runId,
    createdAt,
    prediction: record.prediction && typeof record.prediction === 'object'
      ? {
          id: String((record.prediction as Record<string, unknown>).id ?? ''),
          matchId: String((record.prediction as Record<string, unknown>).matchId ?? ''),
          league: typeof (record.prediction as Record<string, unknown>).league === 'string'
            ? String((record.prediction as Record<string, unknown>).league)
            : null,
        }
      : null,
    run: record.run && typeof record.run === 'object'
      ? {
          id: String((record.run as Record<string, unknown>).id ?? ''),
          runDate: new Date(String((record.run as Record<string, unknown>).runDate ?? new Date().toISOString())),
          status: String((record.run as Record<string, unknown>).status ?? ''),
        }
      : null,
  };
}

// Fetch decisions from database
// C12: Added pagination support (skip, limit)
async function fetchDecisionsFromDB(
  dateStart: Date, 
  dateEnd: Date, 
  status?: string,
  skip?: number,
  limit?: number
): Promise<DecisionFromDB[]> {
  const where: DecisionWhereClause = {
    matchDate: {
      gte: dateStart,
      lte: dateEnd,
    },
    NOT: {
      modelVersion: {
        startsWith: 'season-end-',
      },
    },
  };

  if (status) {
    where.status = status as DecisionStatus;
  }

  return prisma.policyDecision.findMany({
    where,
    include: {
      prediction: {
        select: {
          id: true,
          matchId: true,
          league: true,
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
    // C12: Add pagination
    ...(skip !== undefined ? { skip } : {}),
    ...(limit !== undefined ? { take: limit } : {}),
  }) as Promise<DecisionFromDB[]>;
}

// Get today's date boundaries
function getTodayBoundaries(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

async function getDefaultDecisionDate(): Promise<Date | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextDecision = await prisma.policyDecision.findFirst({
    where: {
      matchDate: {
        gte: today,
      },
      NOT: {
        modelVersion: {
          startsWith: 'season-end-',
        },
      },
    },
    orderBy: { matchDate: 'asc' },
    select: { matchDate: true },
  });

  if (nextDecision?.matchDate) {
    return nextDecision.matchDate;
  }

  const latestPastDecision = await prisma.policyDecision.findFirst({
    where: {
      matchDate: {
        lt: today,
      },
      NOT: {
        modelVersion: {
          startsWith: 'season-end-',
        },
      },
    },
    orderBy: { matchDate: 'desc' },
    select: { matchDate: true },
  });

  if (latestPastDecision?.matchDate) {
    return latestPastDecision.matchDate;
  }

  const latestDecision = await prisma.policyDecision.findFirst({
    where: {
      NOT: {
        modelVersion: {
          startsWith: 'season-end-',
        },
      },
    },
    orderBy: { matchDate: 'desc' },
    select: { matchDate: true },
  });

  return latestDecision?.matchDate ?? null;
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return NaN;

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : NaN;
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

    // Authentication check using getToken for App Router
    let token = null;
    let userRole = 'user';
    
    try {
      const tokenConfig = process.env.NEXTAUTH_SECRET
        ? { req: request, secret: process.env.NEXTAUTH_SECRET }
        : { req: request };

      token = await getToken({ 
        ...tokenConfig,
      });
      
      if (token && token.role) {
        userRole = token.role as string;
      }
    } catch (authError) {
      console.warn('[DecisionsAPI] Auth check failed:', authError);
    }
    
    const allowUnauthenticatedDevAccess =
      process.env.NODE_ENV === 'development' &&
      process.env.ALLOW_UNAUTHENTICATED_DECISIONS_DEV === 'true';

    if (!token && !allowUnauthenticatedDevAccess) {
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

    if (allowUnauthenticatedDevAccess && !token) {
      userRole = 'admin';
    }

    // RBAC check - only user, support, ops, admin can read
    const allowedRoles = ['user', 'support', 'ops', 'admin'];
    if (!allowedRoles.includes(userRole)) {
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
    
    // C12: Parse pagination parameters
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const page = parsePositiveInteger(pageParam, 1);
    const parsedLimit = parsePositiveInteger(limitParam, 20);
    const limit = Number.isNaN(parsedLimit) ? NaN : Math.min(parsedLimit, 100); // Max 100
    const skip = (page - 1) * limit;

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
    
    // C12: Validate pagination
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || limit < 1) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_PAGINATION',
            message: 'Les paramètres page et limit doivent être >= 1',
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
      cacheDateKey = dateParam.split('T')[0] || formatLocalDate(parsedDate);
    } else {
      const latestDecisionDate = await getDefaultDecisionDate();

      if (latestDecisionDate) {
        dateStart = new Date(
          latestDecisionDate.getFullYear(),
          latestDecisionDate.getMonth(),
          latestDecisionDate.getDate(),
          0,
          0,
          0
        );
        dateEnd = new Date(
          latestDecisionDate.getFullYear(),
          latestDecisionDate.getMonth(),
          latestDecisionDate.getDate(),
          23,
          59,
          59,
          999
        );
        cacheDateKey = formatLocalDate(latestDecisionDate);
      } else {
        const today = getTodayBoundaries();
        dateStart = today.start;
        dateEnd = today.end;
        cacheDateKey = formatLocalDate(new Date());
      }
    }

    // Try cache first (cache-aside pattern)
    const cacheKey = getCacheKey(cacheDateKey, statusParam || undefined);
    let decisions;
    let fromCache = false;

    try {
      const redis = await getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached as string) as unknown;
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => normalizeDecisionFromCache(item))
            .filter((item): item is DecisionFromDB => item !== null);

          if (normalized.length > 0) {
            decisions = normalized;
            fromCache = true;
          }
        }
      }
    } catch (cacheError) {
      // Log cache error but continue to database
      console.warn('[DecisionsAPI] Cache error:', cacheError);
    }

    // C12: Get total count first
    const totalCount = await prisma.policyDecision.count({
      where: {
        matchDate: {
          gte: dateStart,
          lte: dateEnd,
        },
        NOT: {
          modelVersion: {
            startsWith: 'season-end-',
          },
        },
        ...(statusParam ? { status: statusParam as DecisionStatus } : {}),
      },
    });

    // Fetch from database if not in cache
    // C12: Skip cache for paginated requests
    if (!decisions || page > 1) {
      if (page > 1) {
        fromCache = false;
      }

      decisions = await fetchDecisionsFromDB(dateStart, dateEnd, statusParam || undefined, skip, limit);

      // Store in cache for 5 minutes (only page 1)
      if (page === 1) {
        try {
          const redis = await getRedisClient();
          await redis.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(decisions));
        } catch (cacheError) {
          console.warn('[DecisionsAPI] Failed to cache:', cacheError);
        }
      }
    }

    // Transform data for response
    const transformedDecisions = decisions.map((decision: DecisionFromDB) => ({
      id: decision.id,
      match: {
        id: decision.matchId,
        homeTeam: decision.homeTeam,
        awayTeam: decision.awayTeam,
        startTime: decision.matchDate.toISOString(),
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
        totalCount,
        page,
        limit,
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
