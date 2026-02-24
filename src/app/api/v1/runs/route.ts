/**
 * Daily Runs API Routes
 * 
 * Endpoints:
 * - GET /api/v1/runs - List run history
 * - POST /api/v1/runs/trigger - Trigger a manual run
 * 
 * Story 2.8: Implement daily production run pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { prisma } from '@/server/db/client';
import { triggerDailyRun } from '@/server/jobs/scheduler';

// GET /api/v1/runs - List run history
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 10;
    const status = searchParams.get('status');
    
    if (Number.isNaN(limit) || limit < 1) {
      return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 });
    }
    
    // Build where clause
    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status.toUpperCase();
    }
    
    const runs = await prisma.dailyRun.findMany({
      where,
      orderBy: { runDate: 'desc' },
      take: Math.min(limit, 100),
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
      },
    });
    
    return NextResponse.json({
      runs: runs.map(run => ({
        ...run,
        runDate: run.runDate?.toISOString(),
        startedAt: run.startedAt?.toISOString(),
        completedAt: run.completedAt?.toISOString(),
        createdAt: run.createdAt?.toISOString(),
        updatedAt: run.updatedAt?.toISOString(),
        errors: run.errors ? JSON.parse(run.errors) : null,
      })),
      count: runs.length,
    });
  } catch (error) {
    console.error('[API] Error listing runs:', error);
    return NextResponse.json(
      { error: 'Failed to list runs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/v1/runs/trigger - Trigger a manual run
export async function POST(request: NextRequest) {
  try {
    // Check authentication - require admin or ops role
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json();
    const { skipIngestion, skipMLInference } = body;
    
    console.log(`[API] Manual run triggered by user: ${session.user.email}`);
    
    // Trigger the daily run
    const result = await triggerDailyRun({
      triggeredBy: `manual-${session.user.email || 'user'}`,
      skipIngestion,
      skipMLInference,
    });
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        runId: result.runId,
        traceId: result.traceId,
        status: result.status,
        message: result.message,
        duration: result.duration,
      }, { status: 201 });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Run failed',
        status: result.status,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[API] Error triggering run:', error);
    return NextResponse.json(
      { error: 'Failed to trigger run', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
