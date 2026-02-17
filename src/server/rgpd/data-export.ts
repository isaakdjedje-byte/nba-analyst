/**
 * RGPD Data Export Module
 * Handles user data portability requests (Right to Access)
 * Per story requirements AC #2
 */

import { prisma } from '@/server/db/client';
import { createHash } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export interface DataExportResult {
  filePath: string;
  dataHash: string;
  expiresAt: Date;
}

/**
 * Generate a data export for a user
 * Per AC #2 - Users can download their personal data (portability)
 */
export async function generateUserDataExport(userId: string): Promise<DataExportResult> {
  // Fetch user with related data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: {
        select: {
          provider: true,
          providerAccountId: true,
          type: true,
          // Note: Account model doesn't have createdAt
        },
      },
      sessions: {
        select: {
          sessionToken: false, // Exclude sensitive token
          expires: true,
          // Note: Session model doesn't have createdAt
        },
        take: 10, // Limit session history
      },
      auditLogs: {
        select: {
          action: true,
          timestamp: true,
          metadata: true,
          // Exclude actorId, targetId to avoid PII in export
        },
        orderBy: { timestamp: 'desc' },
        take: 100, // Limit audit log entries
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Prepare export data
  const exportData = {
    exportDate: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      emailVerified: user.emailVerified?.toISOString() || null,
      // Note: MFA fields not in current schema, would be added with MFA story
    },
    dataCategories: [
      'Account Information',
      'Authentication Methods',
      'Session History (Last 10)',
      'Audit Log (Last 100 Actions)',
    ],
    retentionInfo: {
      accountData: `${process.env.DATA_RETENTION_DAYS_USER || '365'} days after deletion request`,
      auditLogs: `${process.env.DATA_RETENTION_DAYS_AUDIT || '2555'} days (7 years for legal compliance)`,
      dataExports: '7 days from generation',
    },
    // Related data
    accounts: user.accounts.map(acc => ({
      provider: acc.provider,
      type: acc.type,
    })),
    sessions: user.sessions.map(sess => ({
      expires: sess.expires.toISOString(),
    })),
    auditLogs: user.auditLogs.map(log => ({
      action: log.action,
      timestamp: log.timestamp.toISOString(),
      metadata: log.metadata,
    })),
  };

  // Generate JSON
  const jsonData = JSON.stringify(exportData, null, 2);
  const dataHash = createHash('sha256').update(jsonData).digest('hex');

  // Ensure exports directory exists
  const exportsDir = process.env.EXPORT_STORAGE_PATH || './exports';
  await mkdir(exportsDir, { recursive: true });

  // Generate unique filename
  const fileName = `data-export-${userId}-${Date.now()}.json`;
  const filePath = path.join(exportsDir, fileName);

  // Write file
  await writeFile(filePath, jsonData);

  // Calculate expiration (7 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Update user record
  await prisma.user.update({
    where: { id: userId },
    data: {
      dataExportRequestedAt: new Date(),
      dataExportCompletedAt: new Date(),
    },
  });

  // Create DataExport record
  await prisma.dataExport.create({
    data: {
      userId,
      filePath,
      dataHash,
      expiresAt,
      status: 'completed',
      completedAt: new Date(),
    },
  });

  return { filePath, dataHash, expiresAt };
}

/**
 * Get a data export by ID (with user verification)
 */
export async function getDataExport(exportId: string, userId: string) {
  const exportRecord = await prisma.dataExport.findFirst({
    where: {
      id: exportId,
      userId, // Ensure user can only access their own exports
    },
  });

  return exportRecord;
}

/**
 * List all data exports for a user
 */
export async function listUserDataExports(userId: string) {
  const exports = await prisma.dataExport.findMany({
    where: { userId },
    orderBy: { requestedAt: 'desc' },
    select: {
      id: true,
      requestedAt: true,
      completedAt: true,
      expiresAt: true,
      status: true,
    },
  });

  return exports;
}
