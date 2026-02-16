/**
 * B2B API - GET /decisions/:id/explain
 * 
 * Returns explanatory elements for each decision:
 * - Gate outcomes (confidence, edge, drift, hardStop)
 * - Confidence score
 * - Edge value
 * - Data signals from ML model
 * 
 * Story 6.2: Implementer les endpoints d'explicabilite pour B2B
 * AC1: Gate outcomes, confidence, edge, data signals (FR35)
 * AC2: Structured and machine-readable response
 * AC3: TraceId included for audit linkage
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withB2BAuth, requireScope } from '../../../_base';
import { validateDecisionLookup } from '../../../schemas';

/**
 * Transform database decision to explanation response format
 */
function transformDecisionExplanation(decision: {
  id: string;
  traceId: string;
  matchId: string;
  status: string;
  rationale: string;
  confidence: number;
  edge: number | null;
  confidenceGate: boolean;
  edgeGate: boolean;
  driftGate: boolean;
  hardStopGate: boolean;
  hardStopReason: string | null;
  recommendedPick: string | null;
  modelVersion: string;
  predictionInputs: Record<string, unknown> | null;
  matchDate: Date;
  homeTeam: string;
  awayTeam: string;
  createdAt: Date;
}) {
  // Map database gates to API format
  const gateOutcomes = [
    {
      gateName: 'confidence',
      passed: decision.confidenceGate,
      reason: decision.confidenceGate 
        ? 'Confidence above threshold' 
        : `Confidence below threshold (${decision.confidence})`,
    },
    {
      gateName: 'edge',
      passed: decision.edgeGate,
      reason: decision.edgeGate 
        ? 'Edge above threshold' 
        : `Edge below threshold (${decision.edge ?? 0})`,
    },
    {
      gateName: 'drift',
      passed: decision.driftGate,
      reason: decision.driftGate 
        ? 'Drift within acceptable range' 
        : 'Drift exceeded threshold',
    },
    {
      gateName: 'hardStop',
      passed: decision.hardStopGate,
      reason: decision.hardStopReason || (decision.hardStopGate 
        ? 'No hard stop triggered' 
        : 'Hard stop condition met'),
    },
  ];

  // Extract data signals from prediction inputs
  const dataSignals = extractDataSignals(decision.predictionInputs, decision.modelVersion);

  return {
    id: decision.id,
    traceId: decision.traceId,
    matchId: decision.matchId,
    matchInfo: {
      homeTeam: decision.homeTeam,
      awayTeam: decision.awayTeam,
      startTime: decision.matchDate.toISOString(),
    },
    status: mapStatus(decision.status),
    gateOutcomes,
    confidence: decision.confidence,
    edge: decision.edge ?? 0,
    dataSignals,
    explanation: decision.rationale,
    createdAt: decision.createdAt.toISOString(),
  };
}

/**
 * Map database status to API status
 */
function mapStatus(status: string): 'Pick' | 'No-Bet' | 'Hard-Stop' {
  switch (status) {
    case 'PICK':
      return 'Pick';
    case 'NO_BET':
      return 'No-Bet';
    case 'HARD_STOP':
      return 'Hard-Stop';
    default:
      return 'No-Bet';
  }
}

/**
 * Extract data signals from prediction inputs
 */
function extractDataSignals(
  predictionInputs: Record<string, unknown> | null,
  modelVersion: string
): Record<string, unknown> {
  if (!predictionInputs) {
    return {
      modelVersion,
      note: 'No prediction inputs available',
    };
  }

  // Extract relevant signals from prediction inputs
  const signals: Record<string, unknown> = {
    modelVersion,
  };

  // Copy relevant fields if they exist
  const signalFields = [
    'homeTeamRecentForm',
    'awayTeamRecentForm',
    'homeAdvantage',
    'restDaysDiff',
    'driftScore',
    'edge',
    'confidence',
  ];

  for (const field of signalFields) {
    if (field in predictionInputs) {
      signals[field] = (predictionInputs as Record<string, unknown>)[field];
    }
  }

  return signals;
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

    // Validate ID format for ID lookup (not required for traceId which can be any string)
    if (!isTraceIdLookup && !id) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Decision ID is required',
        },
        meta: { traceId, timestamp },
      }, { status: 400 });
    }

    // Fetch decision with all fields needed for explanation
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

    // Transform and return explanation
    const explanation = transformDecisionExplanation({
      id: decision.id,
      traceId: decision.traceId,
      matchId: decision.matchId,
      status: decision.status,
      rationale: decision.rationale,
      confidence: decision.confidence,
      edge: decision.edge,
      confidenceGate: decision.confidenceGate,
      edgeGate: decision.edgeGate,
      driftGate: decision.driftGate,
      hardStopGate: decision.hardStopGate,
      hardStopReason: decision.hardStopReason,
      recommendedPick: decision.recommendedPick,
      modelVersion: decision.modelVersion,
      predictionInputs: decision.predictionInputs as Record<string, unknown> | null,
      matchDate: decision.matchDate,
      homeTeam: decision.homeTeam,
      awayTeam: decision.awayTeam,
      createdAt: decision.createdAt,
    });

    return NextResponse.json({
      data: explanation,
      meta: { traceId, timestamp },
    });
  });
}
