/**
 * Manual Trigger API Route
 * 
 * POST /api/v1/runs/trigger - Trigger a manual daily run
 * 
 * Story 2.8: Implement daily production run pipeline
 * Subtask 1.3: Implement manual trigger endpoint for ad-hoc runs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { triggerDailyRun } from '@/server/jobs/scheduler';

function isOpsOrAdmin(role: string | null | undefined): boolean {
  return role === 'ops' || role === 'admin';
}

// POST /api/v1/runs/trigger - Trigger a manual run
export async function POST(request: NextRequest) {
  try {
    // Check authentication - require admin or ops role
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string } | undefined)?.role;
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isOpsOrAdmin(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Parse request body
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is OK
    }
    
    const requestedSkipIngestion = body.skipIngestion === true;
    const requestedSkipMLInference = body.skipMLInference === true;
    const allowSkipFlags =
      process.env.NODE_ENV !== 'production' && process.env.ALLOW_RUN_SKIP_FLAGS_DEV === 'true';
    const skipIngestion = allowSkipFlags ? requestedSkipIngestion : false;
    const skipMLInference = allowSkipFlags ? requestedSkipMLInference : false;
    
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
