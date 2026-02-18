/**
 * B2B API - GET /decisions (List)
 * 
 * Returns a paginated list of decisions with filters.
 * 
 * Story 6.1: B2B REST API v1
 * Subtask 2.1-2.4: Implement endpoint with pagination, filters, and Zod validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withB2BAuth, requireScope, createErrorResponse } from '../_base';
import { validateDecisionsQuery } from '../schemas';

/**
 * Transform database decision to API response format
 */
function transformDecision(decision: {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  status: string;
  rationale: string;
  confidence: number;
  edge: number | null;
  recommendedPick: string | null;
  traceId: string;
  createdAt: Date;
  prediction?: {
    id: string;
    matchId: string;
    league: string | null;
  } | null;
}) {
  // Map database status to API status
  let apiStatus: 'Pick' | 'No-Bet' | 'Hard-Stop';
  switch (decision.status) {
    case 'PICK':
      apiStatus = 'Pick';
      break;
    case 'NO_BET':
      apiStatus = 'No-Bet';
      break;
    case 'HARD_STOP':
      apiStatus = 'Hard-Stop';
      break;
    default:
      apiStatus = 'No-Bet';
  }

  return {
    id: decision.id,
    traceId: decision.traceId,
    matchId: decision.matchId,
    matchInfo: {
      homeTeam: decision.homeTeam,
      awayTeam: decision.awayTeam,
      startTime: decision.matchDate.toISOString(),
    },
    status: apiStatus,
    rationale: decision.rationale,
    metadata: {
      confidence: decision.confidence,
      edge: decision.edge,
      recommendedPick: decision.recommendedPick,
      processedAt: decision.createdAt.toISOString(),
    },
    createdAt: decision.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withB2BAuth(request, async (client, traceId, timestamp) => {
    // Check scope
    const scopeError = requireScope(client, 'decisions:read', traceId, timestamp);
    if (scopeError) return scopeError;

    // Parse and validate query params
    const searchParams = request.nextUrl.searchParams;
    const queryParams: Record<string, string | string[] | null> = {};
    
    for (const [key, value] of searchParams.entries()) {
      queryParams[key] = value;
    }

    let query;
    try {
      query = validateDecisionsQuery(queryParams);
    } catch (error: unknown) {
      return NextResponse.json(
        createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid query parameters',
          traceId,
          timestamp,
          error instanceof Error ? error.message : undefined
        ),
        { status: 400 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = {};
    const includeSynthetic = searchParams.get('includeSynthetic') === 'true';
    
    // Date filter
    if (query.fromDate || query.toDate) {
      where.matchDate = {};
      if (query.fromDate) {
        (where.matchDate as Record<string, Date>).gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        const toDate = new Date(query.toDate);
        toDate.setHours(23, 59, 59, 999);
        (where.matchDate as Record<string, Date>).lte = toDate;
      }
    }
    
    // Status filter
    if (query.status) {
      // Convert API status to DB status
      const statusMap: Record<string, string> = {
        'Pick': 'PICK',
        'No-Bet': 'NO_BET',
        'Hard-Stop': 'HARD_STOP',
      };
      where.status = statusMap[query.status];
    }
    
    // Match ID filter
    if (query.matchId) {
      where.matchId = query.matchId;
    }

    if (!includeSynthetic) {
      where.NOT = {
        modelVersion: {
          startsWith: 'season-end-',
        },
      };
    }

    // Calculate pagination
    const skip = (query.page - 1) * query.limit;

    // Get total count
    const total = await prisma.policyDecision.count({ where });

    // Fetch decisions
    const decisions = await prisma.policyDecision.findMany({
      where,
      include: {
        prediction: {
          select: {
            id: true,
            matchId: true,
            league: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: query.limit,
    });

    // Transform to API format
    const transformedDecisions = decisions.map(transformDecision);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / query.limit);

    // Return success response
    return NextResponse.json({
      data: transformedDecisions,
      meta: {
        traceId,
        timestamp,
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        count: transformedDecisions.length,
      },
    });
  });
}
