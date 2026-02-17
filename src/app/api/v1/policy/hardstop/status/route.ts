/**
 * Hard-Stop Status API Endpoint
 * 
 * GET /api/v1/policy/hardstop/status
 * 
 * Returns current hard-stop state for monitoring.
 * Story 2.6: Provides hard-stop status for operations monitoring.
 */

import { NextResponse } from 'next/server';
import { getHardStopStatus } from '@/jobs/daily-run-job';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/v1/policy/hardstop/status
 * 
 * Returns current hard-stop state including:
 * - isActive: Whether hard-stop is currently active
 * - triggeredAt: When hard-stop was triggered (if active)
 * - triggerReason: Why hard-stop was triggered
 * - currentState: Current values for daily loss, consecutive losses, bankroll %
 * - limits: Configured thresholds
 * - recommendedAction: What to do to resolve the hard-stop
 */
export async function GET() {
  try {
    const status = await getHardStopStatus();
    const traceId = uuidv4();

    return NextResponse.json({
      data: status,
      meta: {
        timestamp: new Date().toISOString(),
        traceId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const traceId = uuidv4();

    return NextResponse.json(
      {
        error: {
          code: 'HARD_STOP_STATUS_ERROR',
          message: 'Failed to retrieve hard-stop status',
          details: { error: message },
        },
        meta: {
          timestamp: new Date().toISOString(),
          traceId,
        },
      },
      { status: 500 }
    );
  }
}
