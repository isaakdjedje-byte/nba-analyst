/**
 * Adaptive Policy Thresholds API
 *
 * GET /api/v1/policy/config/adaptive - Returns current thresholds,
 * latest adaptive recommendation, and last persisted adaptive snapshot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOps } from '@/server/auth/server-rbac';
import { generateTraceId } from '@/server/auth/rbac';
import { logAuditEvent } from '@/lib/utils/audit';
import { getAdaptiveThresholdReport } from '@/server/policy/adaptive-thresholds';

const QuerySchema = z.object({
  lookbackDays: z.coerce.number().int().min(30).max(365).default(120),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = generateTraceId();

  try {
    const authResult = await requireOps(request);
    if (authResult.error) {
      await logAuditEvent(
        {
          actorId: 'unknown',
          action: 'API_ACCESS_DENIED',
          targetId: 'policy-config-adaptive',
          targetType: 'CONFIGURATION',
          metadata: {
            reason: 'Insufficient permissions to view adaptive policy thresholds',
          },
        },
        traceId
      );
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const queryResult = QuerySchema.safeParse({
      lookbackDays: searchParams.get('lookbackDays'),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: {
              errors: queryResult.error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            },
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    const { lookbackDays } = queryResult.data;
    const report = await getAdaptiveThresholdReport(lookbackDays);

    return NextResponse.json(
      {
        data: {
          ...report,
          lookbackDays,
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PolicyConfigAdaptive GET] Error:', error);

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
