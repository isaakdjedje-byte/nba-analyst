/**
 * Decision Details API
 * 
 * GET /api/v1/decisions/[id]
 * Returns detailed information for a specific decision
 * 
 * Story 2.9: Implement decision details endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPolicyDecisionById, getPolicyDecisionByTraceId } from '@/server/db/repositories';
import { requireAuth } from '@/server/auth/server-rbac';
import { formatRecommendedPick } from '@/server/policy/recommended-pick';

// Generate traceId for response metadata
function generateTraceId(): string {
  return `detail-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const traceId = generateTraceId();
  const timestamp = new Date().toISOString();

  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return authResult.error;
    }

    const { id } = await params;
    
    // Check if id is a traceId (starts with 'hist-' or similar pattern)
    // or a direct decision ID
    let decision;
    
    if (id.startsWith('trace-') || id.startsWith('hist-') || id.startsWith('run-')) {
      // Query by traceId
      decision = await getPolicyDecisionByTraceId(id);
    } else {
      // Query by decision ID
      decision = await getPolicyDecisionById(id);
    }

    if (!decision) {
      return NextResponse.json(
        {
          error: {
            code: 'DECISION_NOT_FOUND',
            message: `Decision not found: ${id}`,
            details: {},
          },
          meta: {
            traceId,
            timestamp,
          },
        },
        { status: 404 }
      );
    }

    // Return success response with full decision details
    return NextResponse.json({
      data: {
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
        predictionInputs: decision.predictionInputs,
        gatesOutcome: {
          confidenceGate: decision.confidenceGate ? 'passed' : 'failed',
          edgeGate: decision.edgeGate ? 'passed' : 'failed',
          driftGate: decision.driftGate ? 'passed' : 'failed',
          hardStopGate: decision.hardStopGate ? 'passed' : 'failed',
          hardStopReason: decision.hardStopReason,
        },
        publishedAt: decision.publishedAt?.toISOString() || null,
        executedAt: decision.executedAt.toISOString(),
        createdAt: decision.createdAt.toISOString(),
        updatedAt: decision.updatedAt.toISOString(),
      },
      meta: {
        traceId,
        timestamp,
      },
    });
  } catch (error) {
    console.error('[DecisionDetails] Error:', error);

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve decision details',
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
