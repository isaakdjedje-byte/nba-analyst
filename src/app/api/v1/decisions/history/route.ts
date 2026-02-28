/**
 * Decision History API
 * 
 * GET /api/v1/decisions/history
 * Query parameters:
 *   - fromDate: ISO date string (optional)
 *   - toDate: ISO date string (optional)
 *   - status: PICK | NO_BET | HARD_STOP (optional)
 *   - matchId: string (optional)
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 100)
 * 
 * Story 2.9: Implement historical query API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDecisionHistory, type DecisionStatus } from '@/server/db/repositories';
import { requireAuth } from '@/server/auth/server-rbac';
import { formatRecommendedPick } from '@/server/policy/recommended-pick';

// Generate traceId for response metadata
function generateTraceId(): string {
  return `hist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Validate status parameter
function isValidStatus(status: string): status is DecisionStatus {
  return ['PICK', 'NO_BET', 'HARD_STOP'].includes(status);
}

// Parse date parameter
function parseDate(dateStr: string | null): Date | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  const timestamp = new Date().toISOString();

  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return authResult.error;
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    
    const fromDate = parseDate(searchParams.get('fromDate'));
    const toDate = parseDate(searchParams.get('toDate'));
    const statusParam = searchParams.get('status');
    const matchId = searchParams.get('matchId') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // Validate status
    let status: DecisionStatus | undefined;
    if (statusParam) {
      if (!isValidStatus(statusParam)) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_STATUS',
              message: `Invalid status value: ${statusParam}. Must be PICK, NO_BET, or HARD_STOP`,
              details: {},
            },
            meta: {
              traceId,
              timestamp,
            },
          },
          { status: 400 }
        );
      }
      status = statusParam;
    }

    // Validate date range
    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_DATE_RANGE',
            message: 'fromDate must be before toDate',
            details: {},
          },
          meta: {
            traceId,
            timestamp,
          },
        },
        { status: 400 }
      );
    }

    // Query decision history
    const result = await getDecisionHistory({
      fromDate,
      toDate,
      status,
      matchId,
      page,
      limit,
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(result.total / limit);
    const hasMore = page < totalPages;

    // Return success response
    return NextResponse.json({
      data: result.decisions.map(decision => ({
        id: decision.id,
        traceId: decision.traceId,
        matchId: decision.matchId,
        matchDate: decision.matchDate.toISOString().split('T')[0],
        homeTeam: decision.homeTeam,
        awayTeam: decision.awayTeam,
        status: decision.status,
        recommendedPick: formatRecommendedPick(
          decision.recommendedPick,
          decision.homeTeam,
          decision.awayTeam
        ),
        rationale: decision.rationale,
        confidence: decision.confidence,
        edge: decision.edge,
        modelVersion: decision.modelVersion,
        gatesOutcome: {
          confidenceGate: decision.confidenceGate ? 'passed' : 'failed',
          edgeGate: decision.edgeGate ? 'passed' : 'failed',
          driftGate: decision.driftGate ? 'passed' : 'failed',
          hardStopGate: decision.hardStopGate ? 'passed' : 'failed',
          hardStopReason: decision.hardStopReason,
        },
        publishedAt: decision.publishedAt?.toISOString() || null,
        createdAt: decision.createdAt.toISOString(),
      })),
      meta: {
        traceId,
        timestamp,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          hasMore,
        },
      },
    });
  } catch (error) {
    // Structured logging for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[DecisionHistory] Error:', JSON.stringify({
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
          message: 'Failed to retrieve decision history',
          details: {},
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
