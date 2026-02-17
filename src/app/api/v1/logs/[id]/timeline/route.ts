/**
 * Timeline API Endpoint
 * Story 4.3: Creer le composant DecisionTimeline pour replay decisionnel
 * 
 * GET /api/v1/logs/[id]/timeline
 * Returns the complete timeline of events for a decision
 * 
 * API Response Format (per Dev Notes):
 * {
 *   data: DecisionTimeline,
 *   meta: {
 *     traceId: string,
 *     timestamp: string
 *   }
 * }
 * 
 * Error Response Format:
 * {
 *   error: {
 *     code: string,
 *     message: string,
 *     details?: unknown
 *   },
 *   meta: {
 *     traceId: string,
 *     timestamp: string
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { getDecisionTimeline } from '@/server/logs/timeline-service';

// Generate traceId for response metadata
function generateTraceId(): string {
  return `tl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// GET /api/v1/logs/[id]/timeline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Generate traceId for this request
  const requestTraceId = generateTraceId();
  const timestamp = new Date().toISOString();

  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
          meta: {
            traceId: requestTraceId,
            timestamp,
          },
        },
        { status: 401 }
      );
    }

    // Await params (Next.js 15+)
    const { id: decisionId } = await params;

    // Validate decision ID
    if (!decisionId) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Decision ID is required',
          },
          meta: {
            traceId: requestTraceId,
            timestamp,
          },
        },
        { status: 400 }
      );
    }

    // Fetch timeline from service
    const timeline = await getDecisionTimeline(decisionId);

    // Return successful response with normalized envelope
    return NextResponse.json(
      {
        data: timeline,
        meta: {
          traceId: timeline.traceId,
          timestamp,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    const errorTraceId = generateTraceId();
    const errorTimestamp = new Date().toISOString();

    // Handle not found error
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
          meta: {
            traceId: errorTraceId,
            timestamp: errorTimestamp,
          },
        },
        { status: 404 }
      );
    }

    // Log error for debugging
    console.error('[Timeline API] Error:', error);

    // Return generic error response
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while fetching timeline',
          details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
        },
        meta: {
          traceId: errorTraceId,
          timestamp: errorTimestamp,
        },
      },
      { status: 500 }
    );
  }
}
