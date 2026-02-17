// Audit logging utility - NFR10 Compliance
// Logs all sensitive operations for compliance and security

import { prisma } from "@/server/db/client";
import { generateTraceId } from "@/server/auth/rbac";

export type AuditAction =
  | "ROLE_CHANGE"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "USER_REGISTER"
  | "PASSWORD_CHANGE"
  | "POLICY_UPDATE"
  | "DECISION_PUBLISH"
  // Story 2.9: Decision audit actions
  | "DECISION_CREATED"
  | "DECISION_MODIFIED"
  | "DECISION_DELETED"
  | "DECISION_ARCHIVED"
  | "API_ACCESS_DENIED"
  | "CONFIG_CHANGE"
  | "MFA_ENABLED"
  | "MFA_DISABLED"
  | "MFA_VERIFIED"
  | "MFA_VERIFICATION_FAILED"
  | "MFA_BACKUP_CODE_USED"
  // RGPD actions
  | "DATA_EXPORT_REQUESTED"
  | "DATA_EXPORT_DOWNLOADED"
  | "ACCOUNT_DELETION_REQUESTED"
  | "ACCOUNT_DELETION_COMPLETED"
  | "ACCOUNT_DELETION_CANCELLED"
  | "DATA_CLEANUP_COMPLETED"
  // Story 4.4: Investigation audit actions
  | "INVESTIGATION_VIEWED"
  | "INVESTIGATION_EXPORT"
  | "INVESTIGATION_COPY_TRACE"
  // Story 4.5: Audit metadata export actions
  | "AUDIT_METADATA_EXPORTED"
  | "AUDIT_DATA_EXPORTED"
  | "CONFIG_CHANGE_AUDIT"
  // Story 5.3: Policy versioning actions
  | "POLICY_VERSION_RESTORED"
  | "HARD_STOP_BYPASS_ATTEMPT";

export interface AuditLogEntry {
  actorId: string;
  action: AuditAction;
  targetId?: string;
  targetType?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event
 * Per architecture.md §NFR10 - All sensitive operations must be audited
 */
export async function logAuditEvent(
  entry: AuditLogEntry,
  traceId?: string
): Promise<void> {
  const finalTraceId = traceId ?? generateTraceId();

  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetId: entry.targetId,
        targetType: entry.targetType,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        metadata: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        traceId: finalTraceId,
        timestamp: new Date(),
      },
    });

    // Also log to console for immediate visibility
    console.info(`[Audit] ${entry.action}`, {
      traceId: finalTraceId,
      actorId: entry.actorId,
      targetId: entry.targetId,
      action: entry.action,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Audit logging failure should not break the operation
    // But it should be logged as a critical error
    console.error("[Audit] Failed to log audit event", {
      traceId: finalTraceId,
      error: error instanceof Error ? error.message : "Unknown error",
      entry: {
        actorId: entry.actorId,
        action: entry.action,
        targetId: entry.targetId,
      },
    });
  }
}

/**
 * Log role change specifically
 * Helper for AC #2 - Role changes must be audited
 */
export async function logRoleChange(params: {
  actorId: string;
  targetId: string;
  oldRole: string;
  newRole: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await logAuditEvent({
    actorId: params.actorId,
    action: "ROLE_CHANGE",
    targetId: params.targetId,
    targetType: "USER",
    oldValue: params.oldRole,
    newValue: params.newRole,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      changeType: "ROLE_ASSIGNMENT",
      severity: "HIGH",
    },
  });
}

/**
 * Log authentication events
 */
export async function logAuthEvent(params: {
  userId: string;
  action: "USER_LOGIN" | "USER_LOGOUT" | "USER_REGISTER";
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await logAuditEvent({
    actorId: params.userId,
    action: params.action,
    targetId: params.userId,
    targetType: "USER",
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.metadata,
  });
}

/**
 * Log access denied events
 * Per AC #4 - Failed access attempts must be logged
 */
export async function logAccessDenied(params: {
  userId?: string;
  resource: string;
  requiredRole?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await logAuditEvent({
    actorId: params.userId ?? "ANONYMOUS",
    action: "API_ACCESS_DENIED",
    targetType: "RESOURCE",
    oldValue: params.userRole,
    newValue: params.requiredRole,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      resource: params.resource,
      reason: "INSUFFICIENT_PERMISSIONS",
    },
  });
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(params: {
  actorId?: string;
  targetId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{
  logs: Array<{
    id: string;
    action: string;
    actorId: string;
    targetId: string | null;
    oldValue: string | null;
    newValue: string | null;
    timestamp: Date;
    traceId: string;
  }>;
  total: number;
}> {
  const where = {
    ...(params.actorId && { actorId: params.actorId }),
    ...(params.targetId && { targetId: params.targetId }),
    ...(params.action && { action: params.action }),
    ...(params.startDate || params.endDate
      ? {
          timestamp: {
            ...(params.startDate && { gte: params.startDate }),
            ...(params.endDate && { lte: params.endDate }),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
      select: {
        id: true,
        action: true,
        actorId: true,
        targetId: true,
        oldValue: true,
        newValue: true,
        timestamp: true,
        traceId: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

/**
 * Log MFA events
 * Per NFR10 - MFA operations must be audited
 */
export async function logMFAEvent(params: {
  userId: string;
  action: "MFA_ENABLED" | "MFA_DISABLED" | "MFA_VERIFIED" | "MFA_VERIFICATION_FAILED" | "MFA_BACKUP_CODE_USED";
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
}): Promise<void> {
  await logAuditEvent({
    actorId: params.userId,
    action: params.action,
    targetId: params.userId,
    targetType: "USER",
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: params.metadata,
  }, params.traceId);
}

/**
 * Story 2.9: Log decision audit events
 * Records decision create/modify/delete operations for NFR10 compliance
 */
export async function logDecisionEvent(params: {
  action: "DECISION_CREATED" | "DECISION_MODIFIED" | "DECISION_DELETED" | "DECISION_ARCHIVED";
  decisionId: string;
  traceId: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await logAuditEvent({
    actorId: params.actorId || "system",
    action: params.action,
    targetId: params.decisionId,
    targetType: "POLICY_DECISION",
    metadata: {
      ...params.metadata,
      decisionTraceId: params.traceId,
    },
  }, params.traceId);
}

/**
 * Story 2.9: Get audit trail for a decision
 * Returns all audit entries linked to a decision via traceId
 */
export async function getDecisionAuditTrail(
  traceId: string
): Promise<Array<{
  id: string;
  action: string;
  actorId: string;
  targetId: string | null;
  oldValue: string | null;
  newValue: string | null;
  timestamp: Date;
  traceId: string;
}>> {
  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { traceId },
        { targetId: traceId },
      ],
    },
    orderBy: { timestamp: 'asc' },
    select: {
      id: true,
      action: true,
      actorId: true,
      targetId: true,
      oldValue: true,
      newValue: true,
      timestamp: true,
      traceId: true,
    },
  });

  return logs;
}
