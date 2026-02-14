/**
 * Hard-Stop Reset API Endpoint
 * 
 * POST /api/v1/policy/hardstop/reset
 * 
 * Resets hard-stop state (ops/admin only).
 * Story 2.6: Allows operations to reset hard-stop after review.
 * 
 * CRITICAL: Requires ops or admin role. Logs to audit trail.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { resetHardStop } from '@/jobs/daily-run-job';
import { prisma } from '@/server/db/client';

/**
 * POST /api/v1/policy/hardstop/reset
 * 
 * Request body:
 * {
 *   "reason": "string - reason for reset"
 * }
 * 
 * Response:
 * {
 *   "data": {
 *     "reset": true,
 *     "previousState": { ... },
 *     "resetAt": "ISO timestamp",
 *     "resetBy": "user email"
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }
    
    // Get user role from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true, id: true },
    });
    
    if (!user || (user.role !== 'ops' && user.role !== 'admin')) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Only ops and admin users can reset hard-stop',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { reason } = body;
    
    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Reason is required and must be a string',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }
    
    // Reset hard-stop
    const result = await resetHardStop(reason, user.id);
    
    if (!result.success) {
      return NextResponse.json({
        data: {
          reset: false,
          message: result.message,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    return NextResponse.json({
      data: {
        reset: true,
        previousState: result.previousState,
        resetAt: new Date().toISOString(),
        resetBy: session.user.email,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      {
        error: {
          code: 'HARD_STOP_RESET_ERROR',
          message: 'Failed to reset hard-stop',
          details: { error: message },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
