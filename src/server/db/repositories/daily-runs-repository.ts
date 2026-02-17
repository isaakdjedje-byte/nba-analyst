/**
 * Daily Runs Repository
 * 
 * Handles database operations for the DailyRun model.
 * Story 2.4: Enhanced schema for run metadata and statistics.
 * 
 * @see https://github.com/isaacnino/nba-analyst/tree/main/docs/architecture.md#data-access-layer
 */

import { prisma } from '@/server/db/client';
import type { Prisma } from '@prisma/client';

// Re-export the RunStatus enum type
export type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

// Types for repository operations
export interface DailyRunCreateInput {
  runDate: Date;
  status: RunStatus;
  triggeredBy: string;
  traceId: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
  totalMatches?: number;
  predictionsCount?: number;
  picksCount?: number;
  noBetCount?: number;
  hardStopCount?: number;
  dataQualityScore?: number | null;
  errors?: string | null;
}

export interface DailyRunUpdateInput {
  status?: RunStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  totalMatches?: number;
  predictionsCount?: number;
  picksCount?: number;
  noBetCount?: number;
  hardStopCount?: number;
  dataQualityScore?: number | null;
  errors?: string | null;
}

export interface DailyRunWithRelations {
  id: string;
  runDate: Date;
  status: RunStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  totalMatches: number;
  predictionsCount: number;
  picksCount: number;
  noBetCount: number;
  hardStopCount: number;
  dataQualityScore: number | null;
  errors: string | null;
  triggeredBy: string;
  traceId: string;
  createdAt: Date;
  updatedAt: Date;
  predictions?: {
    id: string;
    matchId: string;
    confidence: number;
  }[];
  policyDecisions?: {
    id: string;
    status: string;
  }[];
}

// Select fields for consistent queries
const dailyRunSelect = {
  id: true,
  runDate: true,
  status: true,
  startedAt: true,
  completedAt: true,
  totalMatches: true,
  predictionsCount: true,
  picksCount: true,
  noBetCount: true,
  hardStopCount: true,
  dataQualityScore: true,
  errors: true,
  triggeredBy: true,
  traceId: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Create a new daily run
 */
export async function createDailyRun(
  input: DailyRunCreateInput
): Promise<DailyRunWithRelations> {
  const data: Prisma.DailyRunCreateInput = {
    runDate: input.runDate,
    status: input.status,
    triggeredBy: input.triggeredBy,
    traceId: input.traceId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    totalMatches: input.totalMatches ?? 0,
    predictionsCount: input.predictionsCount ?? 0,
    picksCount: input.picksCount ?? 0,
    noBetCount: input.noBetCount ?? 0,
    hardStopCount: input.hardStopCount ?? 0,
    dataQualityScore: input.dataQualityScore,
    errors: input.errors,
  };

  const run = await prisma.dailyRun.create({
    data,
    select: dailyRunSelect,
  });

  return run as DailyRunWithRelations;
}

/**
 * Get daily run by ID
 */
export async function getDailyRunById(
  id: string
): Promise<DailyRunWithRelations | null> {
  const run = await prisma.dailyRun.findUnique({
    where: { id },
    select: dailyRunSelect,
  });

  return run as DailyRunWithRelations | null;
}

/**
 * Get daily run by date
 */
export async function getDailyRunByDate(
  runDate: Date
): Promise<DailyRunWithRelations | null> {
  const run = await prisma.dailyRun.findUnique({
    where: { runDate },
    select: dailyRunSelect,
  });

  return run as DailyRunWithRelations | null;
}

/**
 * Get daily runs by status
 */
export async function getDailyRunsByStatus(
  status: RunStatus
): Promise<DailyRunWithRelations[]> {
  const runs = await prisma.dailyRun.findMany({
    where: { status },
    select: dailyRunSelect,
    orderBy: { runDate: 'desc' },
  });

  return runs as DailyRunWithRelations[];
}

/**
 * Get recent daily runs
 */
export async function getRecentDailyRuns(
  limit: number = 10
): Promise<DailyRunWithRelations[]> {
  const runs = await prisma.dailyRun.findMany({
    select: dailyRunSelect,
    orderBy: { runDate: 'desc' },
    take: limit,
  });

  return runs as DailyRunWithRelations[];
}

/**
 * Update a daily run
 */
export async function updateDailyRun(
  id: string,
  input: DailyRunUpdateInput
): Promise<DailyRunWithRelations | null> {
  const data: Prisma.DailyRunUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.startedAt !== undefined) {
    data.startedAt = input.startedAt;
  }
  if (input.completedAt !== undefined) {
    data.completedAt = input.completedAt;
  }
  if (input.totalMatches !== undefined) {
    data.totalMatches = input.totalMatches;
  }
  if (input.predictionsCount !== undefined) {
    data.predictionsCount = input.predictionsCount;
  }
  if (input.picksCount !== undefined) {
    data.picksCount = input.picksCount;
  }
  if (input.noBetCount !== undefined) {
    data.noBetCount = input.noBetCount;
  }
  if (input.hardStopCount !== undefined) {
    data.hardStopCount = input.hardStopCount;
  }
  if (input.dataQualityScore !== undefined) {
    data.dataQualityScore = input.dataQualityScore;
  }
  if (input.errors !== undefined) {
    data.errors = input.errors;
  }

  const run = await prisma.dailyRun.update({
    where: { id },
    data,
    select: dailyRunSelect,
  });

  return run as DailyRunWithRelations;
}

/**
 * Delete a daily run
 */
export async function deleteDailyRun(id: string): Promise<void> {
  await prisma.dailyRun.delete({
    where: { id },
  });
}

/**
 * Increment predictions count for a run
 */
export async function incrementPredictionsCount(
  id: string
): Promise<void> {
  await prisma.dailyRun.update({
    where: { id },
    data: {
      predictionsCount: {
        increment: 1,
      },
    },
  });
}

/**
 * Update run statistics based on decision status
 */
export async function updateRunStats(
  id: string,
  decisionStatus: 'PICK' | 'NO_BET' | 'HARD_STOP'
): Promise<void> {
  const data: Prisma.DailyRunUpdateInput = {};

  switch (decisionStatus) {
    case 'PICK':
      data.picksCount = { increment: 1 };
      break;
    case 'NO_BET':
      data.noBetCount = { increment: 1 };
      break;
    case 'HARD_STOP':
      data.hardStopCount = { increment: 1 };
      break;
  }

  await prisma.dailyRun.update({
    where: { id },
    data,
  });
}

/**
 * Get daily run with predictions and decisions
 */
export async function getDailyRunWithDetails(
  id: string
): Promise<DailyRunWithRelations | null> {
  const run = await prisma.dailyRun.findUnique({
    where: { id },
    select: {
      ...dailyRunSelect,
      predictions: {
        select: {
          id: true,
          matchId: true,
          confidence: true,
        },
      },
      policyDecisions: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  return run as DailyRunWithRelations | null;
}

/**
 * Get run statistics summary
 */
export async function getRunStatistics(id: string): Promise<{
  totalMatches: number;
  predictionsCount: number;
  picksCount: number;
  noBetCount: number;
  hardStopCount: number;
  dataQualityScore: number | null;
  duration: number | null; // in minutes
} | null> {
  const run = await prisma.dailyRun.findUnique({
    where: { id },
    select: {
      totalMatches: true,
      predictionsCount: true,
      picksCount: true,
      noBetCount: true,
      hardStopCount: true,
      dataQualityScore: true,
      startedAt: true,
      completedAt: true,
    },
  });

  if (!run) return null;

  const duration = run.startedAt && run.completedAt
    ? Math.round((run.completedAt.getTime() - run.startedAt.getTime()) / (1000 * 60))
    : null;

  return {
    totalMatches: run.totalMatches,
    predictionsCount: run.predictionsCount,
    picksCount: run.picksCount,
    noBetCount: run.noBetCount,
    hardStopCount: run.hardStopCount,
    dataQualityScore: run.dataQualityScore,
    duration,
  };
}
