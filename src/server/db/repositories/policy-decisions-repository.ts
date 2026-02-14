/**
 * Policy Decisions Repository
 * 
 * Handles database operations for the PolicyDecision model.
 * Story 2.4: Database schema for policy engine decisions.
 * 
 * @see https://github.com/isaacnino/nba-analyst/tree/main/docs/architecture.md#data-access-layer
 */

import { prisma } from '@/server/db/client';
import { RepositoryError } from './predictions-repository';

// Re-export the DecisionStatus enum type
export type DecisionStatus = 'PICK' | 'NO_BET' | 'HARD_STOP';

// Types for repository operations
export interface PolicyDecisionCreateInput {
  predictionId: string;
  matchId: string;
  userId: string;
  runId: string;
  status: DecisionStatus;
  rationale: string;
  confidenceGate: boolean;
  edgeGate: boolean;
  driftGate: boolean;
  hardStopGate: boolean;
  hardStopReason?: string | null;
  recommendedAction?: string | null;
  traceId: string;
  executedAt: Date;
}

export interface PolicyDecisionUpdateInput {
  status?: DecisionStatus;
  rationale?: string;
  confidenceGate?: boolean;
  edgeGate?: boolean;
  driftGate?: boolean;
  hardStopGate?: boolean;
  hardStopReason?: string | null;
  recommendedAction?: string | null;
}

export interface PolicyDecisionWithRelations {
  id: string;
  predictionId: string;
  matchId: string;
  userId: string;
  runId: string;
  status: DecisionStatus;
  rationale: string;
  confidenceGate: boolean;
  edgeGate: boolean;
  driftGate: boolean;
  hardStopGate: boolean;
  hardStopReason: string | null;
  recommendedAction: string | null;
  traceId: string;
  executedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  prediction?: {
    id: string;
    matchId: string;
    confidence: number;
  } | null;
}

// Select fields for consistent queries
const policyDecisionSelect = {
  id: true,
  predictionId: true,
  matchId: true,
  userId: true,
  runId: true,
  status: true,
  rationale: true,
  confidenceGate: true,
  edgeGate: true,
  driftGate: true,
  hardStopGate: true,
  hardStopReason: true,
  recommendedAction: true,
  traceId: true,
  executedAt: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * Create a new policy decision
 */
export async function createPolicyDecision(
  input: PolicyDecisionCreateInput
): Promise<PolicyDecisionWithRelations> {
  const data: any = {
    prediction: { connect: { id: input.predictionId } },
    matchId: input.matchId,
    userId: input.userId,
    run: { connect: { id: input.runId } },
    status: input.status,
    rationale: input.rationale,
    confidenceGate: input.confidenceGate,
    edgeGate: input.edgeGate,
    driftGate: input.driftGate,
    hardStopGate: input.hardStopGate,
    hardStopReason: input.hardStopReason,
    recommendedAction: input.recommendedAction,
    traceId: input.traceId,
    executedAt: input.executedAt,
  };

  const decision = await prisma.policyDecision.create({
    data,
    select: policyDecisionSelect,
  });

  return decision as PolicyDecisionWithRelations;
}

/**
 * Get policy decision by ID
 */
export async function getPolicyDecisionById(
  id: string
): Promise<PolicyDecisionWithRelations | null> {
  const decision = await prisma.policyDecision.findUnique({
    where: { id },
    select: policyDecisionSelect,
  });

  return decision as PolicyDecisionWithRelations | null;
}

/**
 * Get policy decision by prediction ID
 */
export async function getPolicyDecisionByPredictionId(
  predictionId: string
): Promise<PolicyDecisionWithRelations | null> {
  const decision = await prisma.policyDecision.findUnique({
    where: { predictionId },
    select: policyDecisionSelect,
  });

  return decision as PolicyDecisionWithRelations | null;
}

/**
 * Get policy decisions by run ID
 */
export async function getPolicyDecisionsByRunId(
  runId: string
): Promise<PolicyDecisionWithRelations[]> {
  const decisions = await prisma.policyDecision.findMany({
    where: { runId },
    select: policyDecisionSelect,
    orderBy: { executedAt: 'desc' },
  });

  return decisions as PolicyDecisionWithRelations[];
}

/**
 * Get policy decisions by status
 */
export async function getPolicyDecisionsByStatus(
  status: DecisionStatus
): Promise<PolicyDecisionWithRelations[]> {
  const decisions = await prisma.policyDecision.findMany({
    where: { status },
    select: policyDecisionSelect,
    orderBy: { executedAt: 'desc' },
  });

  return decisions as PolicyDecisionWithRelations[];
}

/**
 * Get policy decisions by match ID
 */
export async function getPolicyDecisionsByMatchId(
  matchId: string
): Promise<PolicyDecisionWithRelations[]> {
  const decisions = await prisma.policyDecision.findMany({
    where: { matchId },
    select: policyDecisionSelect,
    orderBy: { executedAt: 'desc' },
  });

  return decisions as PolicyDecisionWithRelations[];
}

/**
 * Update a policy decision
 */
export async function updatePolicyDecision(
  id: string,
  input: PolicyDecisionUpdateInput
): Promise<PolicyDecisionWithRelations | null> {
  const data: any = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.rationale !== undefined) {
    data.rationale = input.rationale;
  }
  if (input.confidenceGate !== undefined) {
    data.confidenceGate = input.confidenceGate;
  }
  if (input.edgeGate !== undefined) {
    data.edgeGate = input.edgeGate;
  }
  if (input.driftGate !== undefined) {
    data.driftGate = input.driftGate;
  }
  if (input.hardStopGate !== undefined) {
    data.hardStopGate = input.hardStopGate;
  }
  if (input.hardStopReason !== undefined) {
    data.hardStopReason = input.hardStopReason;
  }
  if (input.recommendedAction !== undefined) {
    data.recommendedAction = input.recommendedAction;
  }

  const decision = await prisma.policyDecision.update({
    where: { id },
    data,
    select: policyDecisionSelect,
  });

  return decision as PolicyDecisionWithRelations;
}

/**
 * Delete a policy decision
 */
export async function deletePolicyDecision(id: string): Promise<void> {
  await prisma.policyDecision.delete({
    where: { id },
  });
}

/**
 * Count policy decisions by run ID
 */
export async function countPolicyDecisionsByRunId(runId: string): Promise<number> {
  return await prisma.policyDecision.count({
    where: { runId },
  });
}

/**
 * Get decision statistics for a run
 */
export async function getDecisionStatsByRunId(runId: string): Promise<{
  total: number;
  picks: number;
  noBets: number;
  hardStops: number;
}> {
  const [
    total,
    picks,
    noBets,
    hardStops,
  ] = await Promise.all([
    prisma.policyDecision.count({ where: { runId } }),
    prisma.policyDecision.count({ where: { runId, status: 'PICK' } }),
    prisma.policyDecision.count({ where: { runId, status: 'NO_BET' } }),
    prisma.policyDecision.count({ where: { runId, status: 'HARD_STOP' } }),
  ]);

  return { total, picks, noBets, hardStops };
}

/**
 * Get policy decision with prediction details
 */
export async function getPolicyDecisionWithPrediction(
  id: string
): Promise<PolicyDecisionWithRelations | null> {
  const decision = await prisma.policyDecision.findUnique({
    where: { id },
    select: {
      ...policyDecisionSelect,
      prediction: {
        select: {
          id: true,
          matchId: true,
          confidence: true,
        },
      },
    },
  });

  return decision as PolicyDecisionWithRelations | null;
}
