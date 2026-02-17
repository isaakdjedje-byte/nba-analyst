/**
 * Policy Configuration API Endpoint
 * 
 * GET /api/v1/policy/config - Get current policy configuration
 * PUT /api/v1/policy/config - Update policy configuration (admin/ops only)
 * Story 2.5: Single source of truth for Pick/No-Bet/Hard-Stop decisions
 * 
 * RBAC: Requires admin or ops role for PUT operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PolicyEngine, DEFAULT_POLICY_CONFIG } from '@/server/policy/engine';
import { PolicyError, type PolicyConfig } from '@/server/policy/types';
import { requireAdmin, requireOps } from '@/server/auth/server-rbac';
import { generateTraceId } from '@/server/auth/rbac';
import { logAuditEvent } from '@/lib/utils/audit';
import { updatePolicyConfig } from '@/server/policy/config';
import { createVersionSnapshot } from '@/server/policy/versioning';

// Zod validation schemas for config
const PolicyConfigSchema = z.object({
  confidence: z.object({
    minThreshold: z.number().min(0).max(1).optional(),
  }).optional(),
  edge: z.object({
    minThreshold: z.number().min(0).max(1).optional(),
  }).optional(),
  drift: z.object({
    maxDriftScore: z.number().min(0).max(1).optional(),
  }).optional(),
  hardStops: z.object({
    dailyLossLimit: z.number().min(0).optional(),
    consecutiveLosses: z.number().min(0).optional(),
    bankrollPercent: z.number().min(0).max(1).optional(),
  }).optional(),
});

// Singleton policy engine instance
let policyEngine: PolicyEngine | null = null;

function getPolicyEngine(): PolicyEngine {
  if (!policyEngine) {
    policyEngine = PolicyEngine.createDefault();
  }
  return policyEngine;
}

/**
 * GET /api/v1/policy/config
 * 
 * Returns current policy configuration
 * Requires ops role or higher
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const traceId = generateTraceId();

  try {
    // Check ops or admin authorization (allows viewing)
    const authResult = await requireOps(request);
    if (authResult.error) {
      // Log security event for failed access attempt
      await logAuditEvent({
        actorId: 'unknown',
        action: 'API_ACCESS_DENIED',
        targetId: 'policy-config',
        targetType: 'CONFIGURATION',
        metadata: {
          reason: 'Insufficient permissions to view policy config',
        },
      }, traceId);
      return authResult.error;
    }

    const engine = getPolicyEngine();
    const config = engine.getConfig();

    return NextResponse.json(
      {
        data: {
          config,
          defaults: DEFAULT_POLICY_CONFIG,
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PolicyConfig GET] Error:', error);
    
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

/**
 * PUT /api/v1/policy/config
 * 
 * Updates policy configuration
 * Requires admin only
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const traceId = generateTraceId();

  try {
    // Check admin authorization (only admins can modify)
    const authResult = await requireAdmin(request);
    if (authResult.error) {
      // Log security event for failed modification attempt
      await logAuditEvent({
        actorId: 'unknown',
        action: 'API_ACCESS_DENIED',
        targetId: 'policy-config',
        targetType: 'CONFIGURATION',
        metadata: {
          reason: 'Non-admin attempted to modify policy config',
        },
      }, traceId);
      return authResult.error;
    }

    // Get current config before update (for audit logging)
    const engine = getPolicyEngine();
    const oldConfig = engine.getConfig();

    // Parse and validate request body
    const body = await request.json();
    const validationResult = PolicyConfigSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid configuration',
            details: { errors },
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    // Extract reason from request (optional field)
    const { _meta } = body;
    const reason = _meta?.reason || 'No reason provided';

    // Validate against safe bounds before persisting
    const newConfig = validationResult.data;
    
    // Persist the configuration (config loader merges with defaults)
    const persistedConfig = updatePolicyConfig(newConfig as Partial<PolicyConfig>);

    // Log configuration change for audit (NFR10) - AC4
    await logAuditEvent({
      actorId: authResult.user.id,
      action: 'CONFIG_CHANGE_AUDIT',
      targetId: 'policy-config',
      targetType: 'CONFIGURATION',
      oldValue: JSON.stringify(oldConfig),
      newValue: JSON.stringify(persistedConfig),
      metadata: {
        changes: Object.keys(newConfig),
        reason: reason,
      },
    }, traceId);

    // Create version snapshot for history (Story 5.3)
    await createVersionSnapshot({
      config: persistedConfig,
      createdBy: authResult.user.id,
      changeReason: reason,
    });

    return NextResponse.json(
      {
        data: {
          message: 'Policy configuration updated successfully',
          config: persistedConfig,
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PolicyConfig PUT] Error:', error);

    if (error instanceof PolicyError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
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
