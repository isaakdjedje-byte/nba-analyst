/**
 * Policy Configuration History API Endpoint
 * 
 * GET /api/v1/policy/config/history - Get policy version snapshots (Story 5.3)
 * GET /api/v1/policy/config/history?type=audit - Get legacy audit history
 * GET /api/v1/policy/config/history/export - Export version history
 * 
 * RBAC: Requires admin or ops role
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOps } from '@/server/auth/server-rbac';
import { generateTraceId } from '@/server/auth/rbac';
import { logAuditEvent, queryAuditLogs } from '@/lib/utils/audit';
import { getVersionSnapshots } from '@/server/policy/versioning';

// Query parameter validation for versions
const VersionsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  type: z.enum(['versions', 'audit']).optional().default('versions'),
});

// Legacy query schema for audit logs
const AuditQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/v1/policy/config/history
 * 
 * Returns policy version history or audit logs
 * Requires admin or ops role
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = generateTraceId();

  try {
    // Check ops or admin authorization (allows viewing history)
    const authResult = await requireOps(request);
    if (authResult.error) {
      // Log security event for failed access attempt
      await logAuditEvent({
        actorId: 'unknown',
        action: 'API_ACCESS_DENIED',
        targetId: 'policy-config-history',
        targetType: 'CONFIGURATION',
        metadata: {
          reason: 'Insufficient permissions to view policy config history',
        },
      }, traceId);
      return authResult.error;
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = VersionsQuerySchema.safeParse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      type: searchParams.get('type'),
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

    const { limit, offset, type } = queryResult.data;

    // Return version snapshots (new in Story 5.3)
    if (type === 'versions' || !type) {
      const versionResult = await getVersionSnapshots({ limit, offset });

      return NextResponse.json(
        {
          data: {
            versions: versionResult.snapshots.map((v) => ({
              id: v.id,
              version: v.version,
              createdAt: v.createdAt.toISOString(),
              createdBy: v.createdBy,
              changeReason: v.changeReason,
              isRestore: v.isRestore,
              previousVersionId: v.previousVersionId,
              config: v.configJson,
            })),
            total: versionResult.total,
            pagination: {
              limit,
              offset,
              hasMore: offset + limit < versionResult.total,
            },
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    }

    // Return legacy audit logs
    if (type === 'audit') {
      const auditQueryResult = AuditQuerySchema.safeParse({
        limit: searchParams.get('limit'),
        offset: searchParams.get('offset'),
      });

      if (!auditQueryResult.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
            },
            meta: {
              traceId,
              timestamp: new Date().toISOString(),
            },
          },
          { status: 400 }
        );
      }

      const auditLimit = auditQueryResult.data.limit;
      const auditOffset = auditQueryResult.data.offset;

      // Query audit logs for policy configuration changes
      const auditResult = await queryAuditLogs({
        action: 'CONFIG_CHANGE_AUDIT',
        limit: auditLimit,
        offset: auditOffset,
      });

      // Transform logs to a more readable format
      const logs = auditResult.logs.map((log) => {
        let parameterKey = 'unknown';

        try {
          const newVal = log.newValue ? JSON.parse(log.newValue) : null;
          
          // Extract the parameter key from the changes
          if (newVal) {
            const changes = Object.keys(newVal);
            if (changes.length > 0) {
              parameterKey = changes[0];
            }
          }
        } catch {
          // Keep default if parsing fails
        }

        return {
          id: log.id,
          timestamp: log.timestamp.toISOString(),
          adminUserId: log.actorId,
          parameterKey,
          oldValue: log.oldValue || '',
          newValue: log.newValue || '',
          traceId: log.traceId,
        };
      });

      return NextResponse.json(
        {
          data: {
            logs,
            total: auditResult.total,
            pagination: {
              limit: auditLimit,
              offset: auditOffset,
              hasMore: auditOffset + auditLimit < auditResult.total,
            },
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: 'INVALID_TYPE',
          message: `Invalid history type: ${type}`,
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[PolicyConfigHistory GET] Error:', error);

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
