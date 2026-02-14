/**
 * Daily Run Details API Route
 * 
 * GET /api/v1/runs/[id] - Get run details by ID
 * 
 * Story 2.8: Implement daily production run pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { prisma } from '@/server/db/client';

// GET /api/v1/runs/[id] - Get run details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
    // Get run details
    const run = await prisma.dailyRun.findUnique({
      where: { id },
      select: {
        id: true,
        runDate: true,
        status: true,
        triggeredBy: true,
        traceId: true,
        startedAt: true,
        completedAt: true,
        totalMatches: true,
        predictionsCount: true,
        picksCount: true,
        noBetCount: true,
        hardStopCount: true,
        dataQualityScore: true,
        errors: true,
        createdAt: true,
        updatedAt: true,
        // Include related predictions and decisions if needed
        predictions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            matchId: true,
            confidence: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }
    
    // Calculate duration if completed
    let duration: number | null = null;
    if (run.startedAt && run.completedAt) {
      duration = Math.round((run.completedAt.getTime() - run.startedAt.getTime()) / 1000);
    }
    
    return NextResponse.json({
      ...run,
      runDate: run.runDate?.toISOString(),
      startedAt: run.startedAt?.toISOString(),
      completedAt: run.completedAt?.toISOString(),
      createdAt: run.createdAt?.toISOString(),
      updatedAt: run.updatedAt?.toISOString(),
      errors: run.errors ? JSON.parse(run.errors) : null,
      duration,
      predictions: run.predictions?.map(p => ({
        ...p,
        createdAt: p.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[API] Error getting run details:', error);
    return NextResponse.json(
      { error: 'Failed to get run details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
