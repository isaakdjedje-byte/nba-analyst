/**
 * Predictions Repository
 * 
 * Handles database operations for the Prediction model.
 * Story 2.4: Database schema for ML outputs and predictions.
 * 
 * @see https://github.com/isaacnino/nba-analyst/tree/main/docs/architecture.md#data-access-layer
 */

import { prisma } from '@/server/db/client';

// Type for Prisma create input - avoids import issues
type PredictionStatus = 'pending' | 'processed' | 'confirmed' | 'cancelled';

interface PrismaPredictionCreateInput {
  matchId: string;
  run: { connect: { id: string } };
  user: { connect: { id: string } };
  winnerPrediction?: string | null;
  scorePrediction?: string | null;
  overUnderPrediction?: number | null;
  confidence: number;
  modelVersion: string;
  featuresHash?: string | null;
  matchDate?: Date;
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  traceId?: string;
  status?: PredictionStatus;
}

interface PrismaPredictionUpdateInput {
  winnerPrediction?: string | null;
  scorePrediction?: string | null;
  overUnderPrediction?: number | null;
  confidence?: number;
  modelVersion?: string;
  featuresHash?: string | null;
  status?: PredictionStatus;
}

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }
  return '';
}

// Repository Error Class
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

// Unified type for prediction data (used by mappers)
export interface UnifiedPrediction {
  id: string;
  matchId: string;
  runId: string;
  userId: string;
  winnerPrediction: string | null;
  scorePrediction: string | null;
  overUnderPrediction: number | null;
  confidence: number;
  modelVersion: string;
  featuresHash: string | null;
  matchDate: Date;
  league: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  traceId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Types for repository operations
export interface PredictionCreateInput {
  matchId: string;
  runId: string;
  userId: string;
  winnerPrediction?: string | null;
  scorePrediction?: string | null;
  overUnderPrediction?: number | null;
  confidence: number;
  modelVersion: string;
  featuresHash?: string | null;
  matchDate?: Date;
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  traceId?: string;
}

export interface PredictionUpdateInput {
  winnerPrediction?: string | null;
  scorePrediction?: string | null;
  overUnderPrediction?: number | null;
  confidence?: number;
  modelVersion?: string;
  featuresHash?: string | null;
  status?: PredictionStatus;
}

export interface PredictionWithRelations {
  id: string;
  matchId: string;
  runId: string;
  userId: string;
  winnerPrediction: string | null;
  scorePrediction: string | null;
  overUnderPrediction: number | null;
  confidence: number;
  modelVersion: string;
  featuresHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  run?: {
    id: string;
    runDate: Date;
    status: string;
  };
  policyDecision?: {
    id: string;
    status: string;
    rationale: string;
  } | null;
}

// Select fields for consistent queries
const predictionSelect = {
  id: true,
  matchId: true,
  runId: true,
  userId: true,
  winnerPrediction: true,
  scorePrediction: true,
  overUnderPrediction: true,
  confidence: true,
  modelVersion: true,
  featuresHash: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Create a new prediction
 * @throws RepositoryError on database errors
 */
export async function createPrediction(
  input: PredictionCreateInput
): Promise<PredictionWithRelations> {
  try {
    const data: PrismaPredictionCreateInput = {
      matchId: input.matchId,
      run: { connect: { id: input.runId } },
      user: { connect: { id: input.userId } },
      winnerPrediction: input.winnerPrediction,
      scorePrediction: input.scorePrediction,
      overUnderPrediction: input.overUnderPrediction,
      confidence: input.confidence,
      modelVersion: input.modelVersion,
      featuresHash: input.featuresHash,
      matchDate: input.matchDate ?? new Date(),
      league: input.league ?? 'nba',
      homeTeam: input.homeTeam ?? 'TBD',
      awayTeam: input.awayTeam ?? 'TBD',
      traceId: input.traceId ?? `pred-${Date.now()}`,
      status: 'pending',
    };

    const prediction = await prisma.prediction.create({
      data: data as unknown as Parameters<typeof prisma.prediction.create>[0]['data'],
      select: predictionSelect,
    });

    return prediction as unknown as PredictionWithRelations;
  } catch (error: unknown) {
    const errorCode = getErrorCode(error);
    if (errorCode === 'P2002') {
      throw new RepositoryError(
        'Prediction already exists for this match',
        'UNIQUE_CONSTRAINT_VIOLATION',
        error
      );
    }
    if (errorCode === 'P2003') {
      throw new RepositoryError(
        'Invalid foreign key reference',
        'FOREIGN_KEY_VIOLATION',
        error
      );
    }
    throw new RepositoryError(
      'Failed to create prediction',
      'DATABASE_ERROR',
      error
    );
  }
}

/**
 * Get prediction by ID
 * @throws RepositoryError on database errors
 */
export async function getPredictionById(
  id: string
): Promise<PredictionWithRelations | null> {
  try {
    const prediction = await prisma.prediction.findUnique({
      where: { id },
      select: predictionSelect,
    });

    return prediction as PredictionWithRelations | null;
  } catch (error: unknown) {
    throw new RepositoryError(
      'Failed to fetch prediction',
      'DATABASE_ERROR',
      error
    );
  }
}

/**
 * Get predictions by run ID
 * @throws RepositoryError on database errors
 */
export async function getPredictionsByRunId(
  runId: string
): Promise<PredictionWithRelations[]> {
  try {
    const predictions = await prisma.prediction.findMany({
      where: { runId },
      select: predictionSelect,
      orderBy: { createdAt: 'desc' },
    });

    return predictions as PredictionWithRelations[];
  } catch (error: unknown) {
    throw new RepositoryError(
      'Failed to fetch predictions by run ID',
      'DATABASE_ERROR',
      error
    );
  }
}

/**
 * Get predictions by match ID
 * @throws RepositoryError on database errors
 */
export async function getPredictionsByMatchId(
  matchId: string
): Promise<PredictionWithRelations[]> {
  try {
    const predictions = await prisma.prediction.findMany({
      where: { matchId },
      select: predictionSelect,
      orderBy: { createdAt: 'desc' },
    });

    return predictions as PredictionWithRelations[];
  } catch (error: unknown) {
    throw new RepositoryError(
      'Failed to fetch predictions by match ID',
      'DATABASE_ERROR',
      error
    );
  }
}

/**
 * Update a prediction
 * @throws RepositoryError on database errors or if prediction not found
 */
export async function updatePrediction(
  id: string,
  input: PredictionUpdateInput
): Promise<PredictionWithRelations | null> {
  try {
    const data: PrismaPredictionUpdateInput = {};

    if (input.winnerPrediction !== undefined) {
      data.winnerPrediction = input.winnerPrediction;
    }
    if (input.scorePrediction !== undefined) {
      data.scorePrediction = input.scorePrediction;
    }
    if (input.overUnderPrediction !== undefined) {
      data.overUnderPrediction = input.overUnderPrediction;
    }
    if (input.confidence !== undefined) {
      data.confidence = input.confidence;
    }
    if (input.modelVersion !== undefined) {
      data.modelVersion = input.modelVersion;
    }
    if (input.featuresHash !== undefined) {
      data.featuresHash = input.featuresHash;
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }

    const prediction = await prisma.prediction.update({
      where: { id },
      data,
      select: predictionSelect,
    });

    return prediction as PredictionWithRelations;
  } catch (error: unknown) {
    if (getErrorCode(error) === 'P2025') {
      throw new RepositoryError(
        'Prediction not found',
        'NOT_FOUND',
        error
      );
    }
    throw new RepositoryError(
      'Failed to update prediction',
      'DATABASE_ERROR',
      error
    );
  }
}

/**
 * Delete a prediction
 * @throws RepositoryError on database errors or if prediction not found
 */
export async function deletePrediction(id: string): Promise<void> {
  try {
    await prisma.prediction.delete({
      where: { id },
    });
  } catch (error: unknown) {
    if (getErrorCode(error) === 'P2025') {
      throw new RepositoryError(
        'Prediction not found',
        'NOT_FOUND',
        error
      );
    }
    throw new RepositoryError(
      'Failed to delete prediction',
      'DATABASE_ERROR',
      error
    );
  }
}

/**
 * Count predictions by run ID
 * @throws RepositoryError on database errors
 */
export async function countPredictionsByRunId(runId: string): Promise<number> {
  try {
    return await prisma.prediction.count({
      where: { runId },
    });
  } catch (error: unknown) {
    throw new RepositoryError(
      'Failed to count predictions',
      'DATABASE_ERROR',
      error
    );
  }
}

/**
 * Get predictions with policy decisions
 * @throws RepositoryError on database errors
 */
export async function getPredictionsWithDecisions(
  runId: string
): Promise<PredictionWithRelations[]> {
  try {
    const predictions = await prisma.prediction.findMany({
      where: { runId },
      select: {
        ...predictionSelect,
        policyDecision: {
          select: {
            id: true,
            status: true,
            rationale: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return predictions as PredictionWithRelations[];
  } catch (error: unknown) {
    throw new RepositoryError(
      'Failed to fetch predictions with decisions',
      'DATABASE_ERROR',
      error
    );
  }
}
