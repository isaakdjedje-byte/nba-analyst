/**
 * RGPD Account Deletion Module
 * Handles user account deletion requests (Right to be Forgotten)
 * Per story requirements AC #2, #3
 */

import { prisma } from '@/server/db/client';
import { logAuditEvent } from '@/lib/utils/audit';

export interface DeletionRequest {
  userId: string;
  reason?: string;
  immediate?: boolean; // For admin use only
}

export interface DeletionResult {
  success: boolean;
  scheduledDeletionDate: Date;
  gracePeriodDays: number;
  message: string;
}

/**
 * Request account deletion with 30-day grace period
 * Per AC #3 - Account deletion within 30 days maximum
 */
export async function requestAccountDeletion(
  userId: string,
  reason?: string
): Promise<DeletionResult> {
  const gracePeriodDays = parseInt(process.env.GRACE_PERIOD_DAYS_DELETION || '30', 10);
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + gracePeriodDays);

  // Update user record for soft deletion
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletionRequestedAt: new Date(),
      deletedAt: deletionDate,
      deletionReason: reason || null,
      // Anonymize email immediately for privacy
      email: `deleted-${userId.slice(0, 8)}@anonymized.local`,
    },
  });

  // Log the deletion request (NFR10) - no PII in logs
  await logAuditEvent({
    actorId: userId,
    action: 'ACCOUNT_DELETION_REQUESTED',
    targetId: userId,
    targetType: 'USER',
    metadata: {
      scheduledDeletion: deletionDate.toISOString(),
      gracePeriodDays,
      hasReason: !!reason,
    },
  });

  return {
    success: true,
    scheduledDeletionDate: deletionDate,
    gracePeriodDays,
    message: `Account deletion scheduled. You have ${gracePeriodDays} days to cancel.`,
  };
}

/**
 * Cancel a pending deletion request
 */
export async function cancelDeletionRequest(
  userId: string,
  originalEmail: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.deletionRequestedAt) {
    return false;
  }

  // Restore user account
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletionRequestedAt: null,
      deletedAt: null,
      deletionReason: null,
      email: originalEmail,
    },
  });

  // Log cancellation (NFR10)
  await logAuditEvent({
    actorId: userId,
    action: 'ACCOUNT_DELETION_CANCELLED',
    targetId: userId,
    targetType: 'USER',
    metadata: {
      wasScheduledFor: user.deletedAt?.toISOString(),
    },
  });

  return true;
}

/**
 * Permanently delete a user after grace period
 * Per AC #3 - Hard delete after grace period expires
 */
export async function permanentlyDeleteUser(userId: string): Promise<boolean> {
  try {
    // Get user before deletion for audit
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    // Verify grace period has passed
    if (user.deletedAt && user.deletedAt > new Date()) {
      throw new Error('Grace period has not expired yet');
    }

    // Hard delete - cascade will handle related records
    await prisma.user.delete({
      where: { id: userId },
    });

    // Log permanent deletion (NFR10)
    await logAuditEvent({
      actorId: 'SYSTEM',
      action: 'ACCOUNT_DELETION_COMPLETED',
      targetId: userId,
      targetType: 'USER',
      metadata: {
        deletionType: 'hard',
        originalRequestDate: user.deletionRequestedAt?.toISOString(),
        gracePeriodExpired: user.deletedAt?.toISOString(),
      },
    });

    return true;
  } catch (error) {
    console.error('[AccountDeletion] Failed to delete user:', error);
    return false;
  }
}

/**
 * Check if a user has a pending deletion request
 */
export async function hasPendingDeletion(userId: string): Promise<{
  pending: boolean;
  scheduledFor?: Date;
  daysRemaining?: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      deletionRequestedAt: true,
      deletedAt: true,
    },
  });

  if (!user?.deletionRequestedAt) {
    return { pending: false };
  }

  const daysRemaining = user.deletedAt
    ? Math.ceil((user.deletedAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    pending: true,
    scheduledFor: user.deletedAt,
    daysRemaining: Math.max(0, daysRemaining),
  };
}

/**
 * Get list of accounts ready for permanent deletion
 * For cleanup job use
 */
export async function getAccountsReadyForDeletion(): Promise<
  Array<{
    id: string;
    deletionRequestedAt: Date;
    scheduledFor: Date;
  }>
> {
  const accounts = await prisma.user.findMany({
    where: {
      deletedAt: { lte: new Date() },
      deletionRequestedAt: { not: null },
    },
    select: {
      id: true,
      deletionRequestedAt: true,
      deletedAt: true,
    },
  });

  return accounts.map(acc => ({
    id: acc.id,
    deletionRequestedAt: acc.deletionRequestedAt!,
    scheduledFor: acc.deletedAt!,
  }));
}
