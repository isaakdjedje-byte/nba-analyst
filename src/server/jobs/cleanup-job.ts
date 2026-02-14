/**
 * RGPD Data Retention Cleanup Job
 * Handles automatic data cleanup per retention policies
 * Per Story 1.5 - AC #4: Automatic data cleanup of expired data
 */

import { prisma } from '@/server/db/client';
import { logAuditEvent } from '@/lib/utils/audit';
import { permanentlyDeleteUser, getAccountsReadyForDeletion } from '@/server/rgpd/account-deletion';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface CleanupResult {
  deletedAccounts: number;
  cleanedExports: number;
  cleanedSessions: number;
  errors: string[];
}

/**
 * Run data cleanup for all retention policies
 * Per AC #4 - Automatic data cleanup jobs remove expired data
 */
export async function runDataCleanup(): Promise<CleanupResult> {
  const errors: string[] = [];
  let deletedAccounts = 0;
  let cleanedExports = 0;
  let cleanedSessions = 0;

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

    // 4. Clean up orphaned exports (files without records or vice versa)
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
        errorCount: errors.length,
      },
    });

    return {
      deletedAccounts,
      cleanedExports,
      cleanedSessions,
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
      errors: [...errors, errorMessage],
    };
  }
}

/**
 * Clean up orphaned export files (files in exports dir not in DB)
 */
async function cleanupOrphanedExports(): Promise<number> {
  const exportsDir = process.env.EXPORT_STORAGE_PATH || './exports';
  let cleanedCount = 0;

  try {
    // Get all valid export file paths from DB
    const validExports = await prisma.dataExport.findMany({
      where: { filePath: { not: null } },
      select: { filePath: true },
    });

    const validPaths = new Set(validExports.map(e => e.filePath));

    // Note: In a real implementation, we'd scan the directory
    // For now, this is a placeholder for the cleanup logic
    // Implementation would use fs.readdir() to list files

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
    await prisma.dataRetentionPolicy.upsert({
      where: { dataType: policy.dataType },
      update: { retentionDays: policy.retentionDays },
      create: policy,
    });
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
    errors: result.errors.length,
  });
  return result;
}
