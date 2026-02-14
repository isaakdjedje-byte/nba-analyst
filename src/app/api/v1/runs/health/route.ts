/**
 * Scheduler Health Check API Route
 * 
 * GET /api/v1/runs/health - Get scheduler health status
 * 
 * Story 2.8: Implement daily production run pipeline
 * Subtask 1.4: Add scheduler health check endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { getSchedulerHealth, getSchedulerConfig } from '@/server/jobs/scheduler';

// GET /api/v1/runs/health - Get scheduler health
export async function GET(request: NextRequest) {
  try {
    // Check authentication - allow public access for monitoring
    // In production, you might want to add auth here too
    // const session = await getServerSession(authOptions);
    
    // Get health status
    const health = await getSchedulerHealth();
    
    // Get scheduler configuration
    const config = getSchedulerConfig();
    
    return NextResponse.json({
      healthy: health.healthy,
      message: health.message,
      config: {
        cronExpression: config.cronExpression,
        timezone: config.timezone,
        enabled: config.enabled,
      },
      metrics: {
        lastSuccessfulRun: health.lastSuccessfulRun?.toISOString(),
        lastFailedRun: health.lastFailedRun?.toISOString(),
        consecutiveFailures: health.consecutiveFailures,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error getting scheduler health:', error);
    return NextResponse.json(
      { 
        healthy: false,
        error: 'Failed to get scheduler health', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
