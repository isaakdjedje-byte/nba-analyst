/**
 * B2B API - GET /decisions/:id (Detail)
 * 
 * Returns a single decision by ID or traceId.
 * Includes predictionInputs for complete audit trail.
 * 
 * Story 6.1: B2B REST API v1
 * Subtask 3.1-3.3: Implement detail endpoint with ID and traceId lookup
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withB2BAuth, requireScope } from '../../_base';

/**
 * Transform database decision to API response format with predictionInputs
 */
function transformDecisionDetail(decision: {
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
  predictionInputs: Record<string, unknown> | null;
  modelVersion: string;
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
      modelVersion: decision.modelVersion,
      processedAt: decision.createdAt.toISOString(),
    },
    predictionInputs: decision.predictionInputs,
    createdAt: decision.createdAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withB2BAuth(request, async (client, traceId, timestamp) => {
    // Check scope
    const scopeError = requireScope(client, 'decisions:read', traceId, timestamp);
    if (scopeError) return scopeError;

    // Get the ID from params
    const { id } = await params;

    // Parse and validate query params (lookup type)
    const searchParams = request.nextUrl.searchParams;
    const lookupType = searchParams.get('lookup') || 'id';

    // Determine what field to search by
    const isTraceIdLookup = lookupType === 'traceId';

    // Fetch decision
    const decision = await prisma.policyDecision.findFirst({
      where: isTraceIdLookup
        ? { traceId: id }
        : { id },
    });

    // Handle not found
    if (!decision) {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: `Decision not found with ${isTraceIdLookup ? 'traceId' : 'id'}: ${id}`,
        },
        meta: { traceId, timestamp },
      }, { status: 404 });
    }

    // Transform and return
    const transformedDecision = transformDecisionDetail({
      id: decision.id,
      matchId: decision.matchId,
      homeTeam: decision.homeTeam,
      awayTeam: decision.awayTeam,
      matchDate: decision.matchDate,
      status: decision.status,
      rationale: decision.rationale,
      confidence: decision.confidence,
      edge: decision.edge,
      recommendedPick: decision.recommendedPick,
      traceId: decision.traceId,
      createdAt: decision.createdAt,
      predictionInputs: decision.predictionInputs as Record<string, unknown> | null,
      modelVersion: decision.modelVersion,
    });

    return NextResponse.json({
      data: transformedDecision,
      meta: { traceId, timestamp },
    });
  });
}
