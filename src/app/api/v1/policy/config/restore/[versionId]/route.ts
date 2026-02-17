/**
 * Policy Configuration Restore API Endpoint
 * 
 * POST /api/v1/policy/config/restore/:versionId
 * Story 5.3: Implementer le versioning et historique des changements policy
 * 
 * RBAC: Requires admin role only
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/server-rbac';
import { generateTraceId } from '@/server/auth/rbac';
import { logAuditEvent } from '@/lib/utils/audit';
import { restoreVersion, getVersionById } from '@/server/policy/versioning';
import { getPolicyConfig } from '@/server/policy/config';

/**
 * POST /api/v1/policy/config/restore/:versionId
 * 
 * Restores a previous policy configuration version
 * Validates against hard-stop bounds (NFR13)
 * Requires admin role
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
): Promise<NextResponse> {
  const traceId = generateTraceId();

  try {
    const { versionId } = await params;

    // Check admin authorization (only admins can restore)
    const authResult = await requireAdmin(request);
    if (authResult.error) {
      // Log security event for failed access attempt
      await logAuditEvent({
        actorId: 'unknown',
        action: 'API_ACCESS_DENIED',
        targetId: 'policy-config-restore',
        targetType: 'CONFIGURATION',
        metadata: {
          reason: 'Non-admin attempted to restore policy config',
          versionId,
        },
      }, traceId);
      return authResult.error;
    }

    // Verify the version exists
    const versionToRestore = await getVersionById(versionId);
    if (!versionToRestore) {
      return NextResponse.json(
        {
          error: {
            code: 'VERSION_NOT_FOUND',
            message: `Version ${versionId} not found`,
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    // Get current config for validation
    const engine = getPolicyConfig();
    const currentConfig = engine.getConfig();

    // Attempt to restore the version
    const restoredSnapshot = await restoreVersion({
      versionId,
      restoredBy: authResult.user.id,
      currentConfig,
    });

    return NextResponse.json(
      {
        data: {
          message: `Successfully restored to version ${versionToRestore.version}`,
          restoredVersion: {
            id: restoredSnapshot.id,
            version: restoredSnapshot.version,
            createdAt: restoredSnapshot.createdAt.toISOString(),
            createdBy: restoredSnapshot.createdBy,
            changeReason: restoredSnapshot.changeReason,
            isRestore: restoredSnapshot.isRestore,
            previousVersionId: restoredSnapshot.previousVersionId,
            config: restoredSnapshot.configJson,
          },
          sourceVersion: {
            id: versionToRestore.id,
            version: versionToRestore.version,
          },
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PolicyConfigRestore POST] Error:', error);

    // Check if it's a validation error (hard-stop bounds)
    if (error instanceof Error && error.message.includes('hard-stop')) {
      return NextResponse.json(
        {
          error: {
            code: 'HARD_STOP_VIOLATION',
            message: error.message,
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403 }
      );
    }

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
