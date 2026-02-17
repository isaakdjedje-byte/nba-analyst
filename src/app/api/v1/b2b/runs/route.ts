/**
 * B2B API - GET /runs (List)
 * 
 * Returns a list of daily runs with status and timestamps.
 * 
 * Story 6.1: B2B REST API v1
 * Subtask 4.1-4.2: Implement runs endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withB2BAuth, requireScope, createErrorResponse } from '../_base';
import { validateRunsQuery } from '../schemas';

/**
 * Transform database run to API response format
 */
function transformRun(run: {
  id: string;
  runDate: Date;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  totalMatches: number;
  predictionsCount: number;
  createdAt: Date;
}) {
  // Map database status to API status
  let apiStatus: 'running' | 'completed' | 'failed';
  switch (run.status) {
    case 'PENDING':
    case 'RUNNING':
      apiStatus = 'running';
      break;
    case 'COMPLETED':
      apiStatus = 'completed';
      break;
    case 'FAILED':
      apiStatus = 'failed';
      break;
    default:
      apiStatus = 'running';
  }

  return {
    id: run.id,
    runDate: run.runDate.toISOString().split('T')[0],
    status: apiStatus,
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    totalPredictions: run.predictionsCount,
    processedCount: run.predictionsCount,
    createdAt: run.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withB2BAuth(request, async (client, traceId, timestamp) => {
    // Check scope
    const scopeError = requireScope(client, 'runs:read', traceId, timestamp);
    if (scopeError) return scopeError;

    // Parse and validate query params
    const searchParams = request.nextUrl.searchParams;
    const queryParams: Record<string, string | string[] | null> = {};
    
    for (const [key, value] of searchParams.entries()) {
      queryParams[key] = value;
    }

    let query;
    try {
      query = validateRunsQuery(queryParams);
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

    // Calculate pagination
    const skip = (query.page - 1) * query.limit;

    // Get total count
    const total = await prisma.dailyRun.count();

    // Fetch runs (most recent first)
    const runs = await prisma.dailyRun.findMany({
      orderBy: {
        runDate: 'desc',
      },
      skip,
      take: query.limit,
    });

    // Transform to API format
    const transformedRuns = runs.map(transformRun);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / query.limit);

    // Return success response
    return NextResponse.json({
      data: transformedRuns,
      meta: {
        traceId,
        timestamp,
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        count: transformedRuns.length,
      },
    });
  });
}
