/**
 * Policy Versioning Service
 * Story 5.3: Implementer le versioning et historique des changements policy
 * 
 * Handles policy configuration versioning, history, and restoration.
 * Enforces hard-stop protection (NFR13) to prevent weakening security bounds.
 */

import { prisma } from '@/server/db/client';
import { logAuditEvent } from '@/lib/utils/audit';
import { PolicyConfig } from './types';
import { generateTraceId } from '@/server/auth/rbac';
import type { Prisma } from '@prisma/client';

/**
 * Policy Version Snapshot interface
 */
export interface PolicyVersionSnapshot {
  id: string;
  version: number;
  createdAt: Date;
  createdBy: string;
  configJson: PolicyConfig;
  changeReason?: string;
  isRestore: boolean;
  previousVersionId?: string;
}

/**
 * Hard-stop bounds validation result
 */
export interface HardStopValidationResult {
  valid: boolean;
  violations: string[];
  message?: string;
}

/**
 * Get paginated version snapshots
 */
export interface GetVersionSnapshotsParams {
  limit: number;
  offset: number;
}

export interface GetVersionSnapshotsResult {
  snapshots: PolicyVersionSnapshot[];
  total: number;
}

/**
 * Validate hard-stop bounds to ensure restore doesn't weaken protections (NFR13)
 * 
 * A restore is valid if it doesn't WEAKEN hard-stop protections:
 * - dailyLossLimit: MUST be <= current (lower = more protective)
 * - consecutiveLosses: MUST be <= current (lower = more protective)
 * - bankrollPercent: MUST be <= current (lower = more protective)
 * 
 * Rationale: Hard-stops protect users from excessive risk.
 * Weakening means allowing MORE risk (higher limits).
 * Strengthening means reducing risk (lower limits) - always allowed.
 */
export function validateHardStopBounds(
  newHardStops: PolicyConfig['hardStops'],
  currentHardStops: PolicyConfig['hardStops']
): HardStopValidationResult {
  const violations: string[] = [];
  
  // Check daily loss limit - cannot increase (would weaken protection)
  if (newHardStops.dailyLossLimit > currentHardStops.dailyLossLimit) {
    violations.push('dailyLossLimit');
  }
  
  // Check consecutive losses - cannot increase (would weaken protection)
  if (newHardStops.consecutiveLosses > currentHardStops.consecutiveLosses) {
    violations.push('consecutiveLosses');
  }
  
  // Check bankroll percent - cannot increase (would weaken protection)
  if (newHardStops.bankrollPercent > currentHardStops.bankrollPercent) {
    violations.push('bankrollPercent');
  }
  
  if (violations.length > 0) {
    return {
      valid: false,
      violations,
      message: `Cannot restore: would weaken hard-stop protections. Violations: ${violations.join(', ')}`,
    };
  }
  
  return {
    valid: true,
    violations: [],
    message: 'Hard-stop bounds validation passed',
  };
}

/**
 * Get the next version number for a new snapshot
 * Uses a transaction to prevent race conditions
 */
async function getNextVersionNumber(): Promise<number> {
  // Use a transaction to prevent race conditions
  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.policyVersionSnapshot.count();
    return count + 1;
  });
  return result;
}

/**
 * Create a new policy version snapshot
 */
export async function createVersionSnapshot(params: {
  config: PolicyConfig;
  createdBy: string;
  changeReason?: string;
  isRestore?: boolean;
  previousVersionId?: string;
}): Promise<PolicyVersionSnapshot> {
  const version = await getNextVersionNumber();
  
  const snapshot = await prisma.policyVersionSnapshot.create({
    data: {
      version,
      createdBy: params.createdBy,
      configJson: params.config as unknown as Prisma.InputJsonValue,
      changeReason: params.changeReason,
      isRestore: params.isRestore ?? false,
      previousVersionId: params.previousVersionId,
    },
  });
  
  return {
    id: snapshot.id,
    version: snapshot.version,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    configJson: snapshot.configJson as unknown as PolicyConfig,
    changeReason: snapshot.changeReason ?? undefined,
    isRestore: snapshot.isRestore,
    previousVersionId: snapshot.previousVersionId ?? undefined,
  };
}

/**
 * Get paginated version snapshots, most recent first
 */
export async function getVersionSnapshots(
  params: GetVersionSnapshotsParams
): Promise<GetVersionSnapshotsResult> {
  const { limit, offset } = params;
  
  const [snapshots, total] = await Promise.all([
    prisma.policyVersionSnapshot.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.policyVersionSnapshot.count(),
  ]);
  
  return {
    snapshots: snapshots.map((s) => ({
      id: s.id,
      version: s.version,
      createdAt: s.createdAt,
      createdBy: s.createdBy,
      configJson: s.configJson as unknown as PolicyConfig,
      changeReason: s.changeReason ?? undefined,
      isRestore: s.isRestore,
      previousVersionId: s.previousVersionId ?? undefined,
    })),
    total,
  };
}

/**
 * Get a specific version by ID
 */
export async function getVersionById(versionId: string): Promise<PolicyVersionSnapshot | null> {
  const snapshot = await prisma.policyVersionSnapshot.findUnique({
    where: { id: versionId },
  });
  
  if (!snapshot) {
    return null;
  }
  
  return {
    id: snapshot.id,
    version: snapshot.version,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    configJson: snapshot.configJson as unknown as PolicyConfig,
    changeReason: snapshot.changeReason ?? undefined,
    isRestore: snapshot.isRestore,
    previousVersionId: snapshot.previousVersionId ?? undefined,
  };
}

/**
 * Get a specific version by version number
 */
export async function getVersionByNumber(version: number): Promise<PolicyVersionSnapshot | null> {
  const snapshot = await prisma.policyVersionSnapshot.findUnique({
    where: { version },
  });
  
  if (!snapshot) {
    return null;
  }
  
  return {
    id: snapshot.id,
    version: snapshot.version,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    configJson: snapshot.configJson as unknown as PolicyConfig,
    changeReason: snapshot.changeReason ?? undefined,
    isRestore: snapshot.isRestore,
    previousVersionId: snapshot.previousVersionId ?? undefined,
  };
}

/**
 * Restore a previous version
 * - Validates against hard-stop bounds
 * - Creates a new snapshot with isRestore=true
 * - Logs the restore action in audit trail
 */
export async function restoreVersion(params: {
  versionId: string;
  restoredBy: string;
  currentConfig: PolicyConfig;
}): Promise<PolicyVersionSnapshot> {
  const traceId = generateTraceId();
  
  // Get the version to restore
  const versionToRestore = await getVersionById(params.versionId);
  if (!versionToRestore) {
    throw new Error(`Version ${params.versionId} not found`);
  }
  
  const restoredConfig = versionToRestore.configJson;
  
  // Validate hard-stop bounds (NFR13)
  const validation = validateHardStopBounds(
    restoredConfig.hardStops,
    params.currentConfig.hardStops
  );
  
  if (!validation.valid) {
    // Log security event for attempted hard-stop bypass
    await logAuditEvent({
      actorId: params.restoredBy,
      action: 'HARD_STOP_BYPASS_ATTEMPT',
      targetId: 'policy-config',
      targetType: 'CONFIGURATION',
      metadata: {
        attemptedVersion: params.versionId,
        attemptedVersionNumber: versionToRestore.version,
        violations: validation.violations,
        message: validation.message,
      },
    }, traceId);
    
    throw new Error(validation.message);
  }
  
  // Log the restore action
  await logAuditEvent({
    actorId: params.restoredBy,
    action: 'POLICY_VERSION_RESTORED',
    targetId: params.versionId,
    targetType: 'POLICY_VERSION',
    oldValue: JSON.stringify(params.currentConfig),
    newValue: JSON.stringify(restoredConfig),
    metadata: {
      restoredFromVersion: versionToRestore.version,
      changeReason: `Restored from version ${versionToRestore.version}`,
    },
  }, traceId);
  
  // Create new snapshot for the restore
  const newSnapshot = await createVersionSnapshot({
    config: restoredConfig,
    createdBy: params.restoredBy,
    changeReason: `Restored from version ${versionToRestore.version}`,
    isRestore: true,
    previousVersionId: params.versionId,
  });
  
  return newSnapshot;
}

/**
 * Export version history to specified format
 */
export async function exportVersionHistory(params: {
  format: 'json' | 'csv';
  startDate?: Date;
  endDate?: Date;
}): Promise<string> {
  const { format } = params;
  
  // Get all snapshots (or filtered by date range)
  const snapshots = await prisma.policyVersionSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    where: params.startDate || params.endDate
      ? {
          createdAt: {
            gte: params.startDate,
            lte: params.endDate,
          },
        }
      : undefined,
  });
  
  if (format === 'json') {
    return JSON.stringify(snapshots, null, 2);
  }
  
  // CSV format
  const headers = [
    'version',
    'createdAt',
    'createdBy',
    'changeReason',
    'isRestore',
    'previousVersionId',
    'confidence_minThreshold',
    'edge_minThreshold',
    'drift_maxDriftScore',
    'hardStops_dailyLossLimit',
    'hardStops_consecutiveLosses',
    'hardStops_bankrollPercent',
  ];
  
  const rows = snapshots.map((s) => {
    const config = s.configJson as unknown as PolicyConfig;
    return [
      s.version,
      s.createdAt.toISOString(),
      s.createdBy,
      s.changeReason ?? '',
      s.isRestore.toString(),
      s.previousVersionId ?? '',
      config.confidence?.minThreshold ?? '',
      config.edge?.minThreshold ?? '',
      config.drift?.maxDriftScore ?? '',
      config.hardStops?.dailyLossLimit ?? '',
      config.hardStops?.consecutiveLosses ?? '',
      config.hardStops?.bankrollPercent ?? '',
    ].join(',');
  });
  
  return [headers.join(','), ...rows].join('\n');
}
