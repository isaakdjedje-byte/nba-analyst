/**
 * RGPD Data Retention Cleanup Job
 * Handles automatic data cleanup per retention policies
 * Per Story 1.5 - AC #4: Automatic data cleanup of expired data
 */

import { prisma } from '@/server/db/client';
import { logAuditEvent } from '@/lib/utils/audit';
import { permanentlyDeleteUser, getAccountsReadyForDeletion } from '@/server/rgpd/account-deletion';
import { readdir, stat, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, extname, join, resolve } from 'path';

export interface CleanupResult {
  deletedAccounts: number;
  cleanedExports: number;
  cleanedSessions: number;
  cleanedAuditLogs: number;  // Story 4.5: Audit log cleanup
  errors: string[];
}

/**
 * Run data cleanup for all retention policies
 * Per AC #4 - Automatic data cleanup jobs remove expired data
 * Story 4.5: Added audit log cleanup for NFR10 compliance
 */
export async function runDataCleanup(): Promise<CleanupResult> {
  const errors: string[] = [];
  let deletedAccounts = 0;
  let cleanedExports = 0;
  let cleanedSessions = 0;
  let cleanedAuditLogs = 0;

  try {
    // 1. Clean up expired soft-deleted accounts (hard delete)
    const accountsToDelete = await getAccountsReadyForDeletion();
    
    for (const account of accountsToDelete) {
      try {
        const success = await permanentlyDeleteUser(account.id);
        if (success) {
          deletedAccounts++;
        } else {
          errors.push(`Failed to delete account ${account.id}`);
        }
      } catch (error) {
        errors.push(`Error deleting account ${account.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    // 2. Clean up expired data exports (delete files + update records)
    const expiredExports = await prisma.dataExport.findMany({
      where: {
        expiresAt: { lte: new Date() },
        status: { in: ['completed', 'pending'] },
      },
    });

    for (const exportRecord of expiredExports) {
      try {
        // Delete file if exists
        if (exportRecord.filePath && existsSync(exportRecord.filePath)) {
          await unlink(exportRecord.filePath);
        }

        // Update record to expired
        await prisma.dataExport.update({
          where: { id: exportRecord.id },
          data: { status: 'expired' },
        });

        cleanedExports++;
      } catch (error) {
        errors.push(`Error cleaning export ${exportRecord.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    // 3. Clean up expired sessions (older than retention period)
    const sessionRetentionDays = parseInt(process.env.SESSION_RETENTION_DAYS || '30', 10);
    const sessionCutoffDate = new Date();
    sessionCutoffDate.setDate(sessionCutoffDate.getDate() - sessionRetentionDays);

    const deletedSessions = await prisma.session.deleteMany({
      where: {
        expires: { lt: sessionCutoffDate },
      },
    });
    cleanedSessions = deletedSessions.count;

    // 4. Clean up old audit logs per retention policy (Story 4.5 - NFR10)
    // AC #4: Audit logs are immutable and queryable for 90+ days
    cleanedAuditLogs = await cleanupOldAuditLogs();

    // 5. Clean up orphaned exports (files without records or vice versa)
    await cleanupOrphanedExports();

    // Log cleanup completion
    await logAuditEvent({
      actorId: 'SYSTEM',
      action: 'DATA_CLEANUP_COMPLETED',
      targetType: 'SYSTEM',
      metadata: {
        deletedAccounts,
        cleanedExports,
        cleanedSessions,
        cleanedAuditLogs,
        errorCount: errors.length,
      },
    });

    return {
      deletedAccounts,
      cleanedExports,
      cleanedSessions,
      cleanedAuditLogs,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logAuditEvent({
      actorId: 'SYSTEM',
      action: 'DATA_CLEANUP_COMPLETED',
      targetType: 'SYSTEM',
      metadata: {
        status: 'FAILED',
        error: errorMessage,
      },
    });

    return {
      deletedAccounts,
      cleanedExports,
      cleanedSessions,
      cleanedAuditLogs,
      errors: [...errors, errorMessage],
    };
  }
}

/**
 * Clean up old audit logs per retention policy
 * Per Story 4.5 AC #4: Audit logs are immutable and queryable for 90+ days
 * This ensures we keep audit logs for at least 90 days for compliance
 */
async function cleanupOldAuditLogs(): Promise<number> {
  try {
    // Get audit log retention from policy or use default 90 days
    const auditRetentionPolicy = await prisma.dataRetentionPolicy.findFirst({
      where: { dataType: 'audit_log' },
    });
    
    const retentionDays = auditRetentionPolicy?.retentionDays || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Delete audit logs older than retention period
    // Note: In production, you might want to archive them first
    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
      },
    });
    
    console.log(`[CleanupJob] Deleted ${result.count} audit logs older than ${retentionDays} days`);
    return result.count;
  } catch (error) {
    console.error('[CleanupJob] Error cleaning audit logs:', error);
    return 0;
  }
}

/**
 * Clean up orphaned export files (files in exports dir not in DB)
 */
async function cleanupOrphanedExports(): Promise<number> {
  let cleanedCount = 0;

  try {
    // Get all valid export file paths from DB
    const validExports = await prisma.dataExport.findMany({
      where: { filePath: { not: null } },
      select: { filePath: true },
    });

    const validPaths = new Set(
      validExports
        .map((entry) => entry.filePath)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .map((value) => resolve(value))
    );

    const candidateDirs = new Set<string>();
    for (const path of validPaths) {
      candidateDirs.add(dirname(path));
    }

    // Fallback exports directory for legacy files.
    candidateDirs.add(resolve(process.cwd(), 'exports'));

    const allowedExtensions = new Set(['.csv', '.json', '.zip']);

    for (const dir of candidateDirs) {
      if (!existsSync(dir)) continue;

      const entries = await readdir(dir);
      for (const entry of entries) {
        const fullPath = resolve(join(dir, entry));
        const fileInfo = await stat(fullPath);
        if (!fileInfo.isFile()) continue;

        if (!allowedExtensions.has(extname(entry).toLowerCase())) {
          continue;
        }

        if (!validPaths.has(fullPath)) {
          await unlink(fullPath);
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  } catch (error) {
    console.error('[CleanupJob] Error cleaning orphaned exports:', error);
    return 0;
  }
}

/**
 * Initialize retention policies in database
 * Run once on app startup
 */
export async function initializeRetentionPolicies(): Promise<void> {
  const defaultPolicies = [
    {
      dataType: 'user_data',
      retentionDays: parseInt(process.env.DATA_RETENTION_DAYS_USER || '365', 10),
      description: 'User account data retention after deletion request',
    },
    {
      dataType: 'audit_log',
      retentionDays: parseInt(process.env.DATA_RETENTION_DAYS_AUDIT || '2555', 10), // 7 years
      description: 'Audit logs for legal compliance (RGPD Article 30)',
    },
    {
      dataType: 'data_export',
      retentionDays: 7,
      description: 'Temporary data export files',
    },
    {
      dataType: 'session',
      retentionDays: parseInt(process.env.SESSION_RETENTION_DAYS || '30', 10),
      description: 'User session data',
    },
  ];

  for (const policy of defaultPolicies) {
    // Check if policy exists first
    const existing = await prisma.dataRetentionPolicy.findFirst({
      where: { dataType: policy.dataType },
    });
    
    if (existing) {
      await prisma.dataRetentionPolicy.update({
        where: { id: existing.id },
        data: { retentionDays: policy.retentionDays },
      });
    } else {
      await prisma.dataRetentionPolicy.create({
        data: policy,
      });
    }
  }
}

/**
 * Schedule cleanup job (for cron/scheduler integration)
 * Returns the scheduled cleanup result
 */
export async function scheduleCleanup(): Promise<CleanupResult> {
  console.log('[CleanupJob] Starting scheduled cleanup...');
  const result = await runDataCleanup();
  console.log('[CleanupJob] Cleanup completed:', {
    deletedAccounts: result.deletedAccounts,
    cleanedExports: result.cleanedExports,
    cleanedSessions: result.cleanedSessions,
    cleanedAuditLogs: result.cleanedAuditLogs,
    errors: result.errors.length,
  });
  return result;
}
