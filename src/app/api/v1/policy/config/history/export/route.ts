/**
 * Policy Configuration History Export API Endpoint
 * 
 * GET /api/v1/policy/config/history/export?format=json|csv&startDate=...&endDate=...
 * Story 5.3: Implementer le versioning et historique des changements policy
 * 
 * RBAC: Requires admin role (export contains sensitive config data)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/server-rbac';
import { generateTraceId } from '@/server/auth/rbac';
import { logAuditEvent } from '@/lib/utils/audit';
import { exportVersionHistory } from '@/server/policy/versioning';

// Query parameter validation for export
const ExportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * GET /api/v1/policy/config/history/export
 * 
 * Exports policy version history
 * Requires admin role
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = generateTraceId();

  try {
    // Check admin authorization (export contains sensitive data)
    const authResult = await requireAdmin(request);
    if (authResult.error) {
      // Log security event for failed access attempt
      await logAuditEvent({
        actorId: 'unknown',
        action: 'API_ACCESS_DENIED',
        targetId: 'policy-config-export',
        targetType: 'CONFIGURATION',
        metadata: {
          reason: 'Non-admin attempted to export policy config history',
        },
      }, traceId);
      return authResult.error;
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = ExportQuerySchema.safeParse({
      format: searchParams.get('format'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
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

    const { format, startDate, endDate } = queryResult.data;

    // Export the version history
    const exportedData = await exportVersionHistory({
      format,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    // Log the export action
    await logAuditEvent({
      actorId: authResult.user.id,
      action: 'AUDIT_DATA_EXPORTED',
      targetId: 'policy-version-history',
      targetType: 'CONFIGURATION',
      metadata: {
        format,
        startDate,
        endDate,
      },
    }, traceId);

    // Set appropriate content type
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `policy-version-history-${new Date().toISOString().split('T')[0]}.${format}`;

    return new NextResponse(exportedData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Trace-Id': traceId,
      },
    });
  } catch (error) {
    console.error('[PolicyConfigHistoryExport GET] Error:', error);

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
