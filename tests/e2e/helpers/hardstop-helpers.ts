/**
 * Hard-Stop Test Helpers
 * Database manipulation helpers for Hard-Stop E2E tests
 *
 * Story: 2.11 - Implementer les tests E2E de l'API Hard-Stop
 */

import { PrismaClient } from '@prisma/client';

/**
 * Reset hard-stop state to inactive
 * Uses Prisma ORM for database portability (SQLite, PostgreSQL, etc.)
 */
export async function resetHardStopState(prisma: PrismaClient): Promise<void> {
  try {
    // Find the most recent hard-stop state
    const existingState = await prisma.hardStopState.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (existingState) {
      // Update existing state to inactive
      await prisma.hardStopState.update({
        where: { id: existingState.id },
        data: {
          isActive: false,
          dailyLoss: 0,
          consecutiveLosses: 0,
          bankrollPercent: 0,
          triggeredAt: null,
          triggerReason: null,
          lastResetAt: new Date(),
        },
      });
    } else {
      // Create initial inactive state
      await prisma.hardStopState.create({
        data: {
          isActive: false,
          dailyLoss: 0,
          consecutiveLosses: 0,
          bankrollPercent: 0,
        },
      });
    }
  } catch (error) {
    console.warn('Could not reset hard-stop state:', error);
  }
}

/**
 * Activate hard-stop with given reason
 */
export async function activateHardStop(
  prisma: PrismaClient,
  reason: string
): Promise<void> {
  try {
    // Find the most recent hard-stop state
    const existingState = await prisma.hardStopState.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (existingState) {
      // Update existing state to active
      await prisma.hardStopState.update({
        where: { id: existingState.id },
        data: {
          isActive: true,
          triggeredAt: new Date(),
          triggerReason: reason,
        },
      });
    } else {
      // Create new active state
      await prisma.hardStopState.create({
        data: {
          isActive: true,
          dailyLoss: 0,
          consecutiveLosses: 0,
          bankrollPercent: 0,
          triggerReason: reason,
          triggeredAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.warn('Could not activate hard-stop:', error);
  }
}

/**
 * Update hard-stop state values
 */
export async function updateHardStopState(
  prisma: PrismaClient,
  updates: { dailyLoss?: number; consecutiveLosses?: number; bankrollPercent?: number }
): Promise<void> {
  try {
    // Find the most recent hard-stop state
    const existingState = await prisma.hardStopState.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (existingState) {
      await prisma.hardStopState.update({
        where: { id: existingState.id },
        data: {
          dailyLoss: updates.dailyLoss ?? existingState.dailyLoss,
          consecutiveLosses: updates.consecutiveLosses ?? existingState.consecutiveLosses,
          bankrollPercent: updates.bankrollPercent ?? existingState.bankrollPercent,
        },
      });
    }
  } catch (error) {
    console.warn('Could not update hard-stop state:', error);
  }
}

/**
 * Get current hard-stop state from database
 */
export async function getHardStopState(prisma: PrismaClient): Promise<{
  isActive: boolean;
  dailyLoss: number;
  consecutiveLosses: number;
  bankrollPercent: number;
  triggerReason?: string;
} | null> {
  try {
    const state = await prisma.hardStopState.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!state) {
      return null;
    }

    return {
      isActive: state.isActive,
      dailyLoss: state.dailyLoss,
      consecutiveLosses: state.consecutiveLosses,
      bankrollPercent: state.bankrollPercent,
      triggerReason: state.triggerReason ?? undefined,
    };
  } catch (error) {
    console.warn('Could not get hard-stop state:', error);
    return null;
  }
}
