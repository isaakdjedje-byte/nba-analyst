/**
 * Investigation Detail API
 * Story 4.4: Implementer l'investigation de decision contestee
 * 
 * GET /api/v1/investigations/[id]
 * 
 * Response:
 * {
 *   data: InvestigationResult,
 *   meta: { traceId, timestamp }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { getPolicyDecisionById } from '@/server/db/repositories/policy-decisions-repository';
import { checkRateLimitWithBoth, getRateLimitHeaders } from '@/server/cache/rate-limiter';
import { getClientIP } from '@/server/cache/rate-limiter-middleware';
import type { InvestigationResult } from '@/features/investigation/types';
import { v4 as uuidv4 } from 'uuid';
import { formatRecommendedPick } from '@/server/policy/recommended-pick';

// Generate traceId for response metadata
function generateTraceId(): string {
  return `investigation-detail-${uuidv4()}`;
}

/**
 * Transform a database decision to an InvestigationResult
 */
function transformToInvestigationResult(decision: Awaited<ReturnType<typeof getPolicyDecisionById>>): InvestigationResult | null {
  if (!decision) return null;

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
    recommendedPick: formatRecommendedPick(
      decision.recommendedPick,
      decision.homeTeam,
      decision.awayTeam
    ),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const traceId = generateTraceId();
  const timestamp = new Date().toISOString();

  try {
    // Get decision ID from URL
    const { id: decisionId } = await params;

    // Rate limiting check (NFR10 Security)
    const requestUserId = request.headers.get('x-user-id') || undefined;
    const ip = getClientIP(request);
    const rateLimitResult = await checkRateLimitWithBoth(`/api/v1/investigations/${decisionId}`, requestUserId, ip);
    
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

    // Get the decision
    const decision = await getPolicyDecisionById(decisionId);

    if (!decision) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: `Décision avec ID ${decisionId} non trouvée`,
            details: {},
          },
          meta: { traceId, timestamp },
        },
        { status: 404 }
      );
    }

    // Transform to investigation result
    const investigationResult = transformToInvestigationResult(decision);

    if (!investigationResult) {
      return NextResponse.json(
        {
          error: {
            code: 'TRANSFORM_ERROR',
            message: 'Erreur lors de la transformation des données',
            details: {},
          },
          meta: { traceId, timestamp },
        },
        { status: 500 }
      );
    }

    // Log audit event (NFR10 - per story AC5)
    console.log('[AUDIT] Investigation viewed:', {
      decisionId,
      traceId,
      investigatorId: session.user?.email || 'unknown',
      timestamp,
    });

    // Get rate limit headers for successful response
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    // Return success response
    return NextResponse.json({
      data: investigationResult,
      meta: { traceId, timestamp },
    }, {
      headers: rateLimitHeaders,
    });

  } catch (error) {
    // Structured logging for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[InvestigationDetailAPI] Error:', JSON.stringify({
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
          message: 'Échec de la récupération des détails de l\'investigation',
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
