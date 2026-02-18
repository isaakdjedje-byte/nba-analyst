/**
 * Policy Decisions Repository
 * 
 * Handles database operations for the PolicyDecision model.
 * Story 2.4: Database schema for policy engine decisions.
 * Story 2.9: Enhanced with decision history and audit trail support.
 * 
 * @see https://github.com/isaacnino/nba-analyst/tree/main/docs/architecture.md#data-access-layer
 */

import { prisma } from '@/server/db/client';
import { v4 as uuidv4 } from 'uuid';
import type { DataSourceFingerprints } from '@/server/audit/types';
import type { Prisma } from '@prisma/client';

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
  // Story 2.9: Decision History fields
  matchDate: Date;
  homeTeam: string;
  awayTeam: string;
  recommendedPick?: string | null;
  confidence: number;
  edge?: number | null;
  modelVersion: string;
  predictionInputs?: Record<string, unknown> | null;
  publishedAt?: Date | null;
  traceId: string;
  executedAt: Date;
  // Story 4.5: Data source fingerprints
  dataSourceFingerprints?: DataSourceFingerprints | null;
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
  // Story 2.9: Decision History fields
  recommendedPick?: string | null;
  publishedAt?: Date | null;
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
  // Story 2.9: Decision History fields
  matchDate: Date;
  homeTeam: string;
  awayTeam: string;
  recommendedPick: string | null;
  confidence: number;
  edge: number | null;
  modelVersion: string;
  predictionInputs: Record<string, unknown> | null;
  publishedAt: Date | null;
  traceId: string;
  executedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  // Story 4.5: Data source fingerprints for audit
  dataSourceFingerprints: DataSourceFingerprints | null;
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
  // Story 2.9: Decision History fields
  matchDate: true,
  homeTeam: true,
  awayTeam: true,
  recommendedPick: true,
  confidence: true,
  edge: true,
  modelVersion: true,
  predictionInputs: true,
  publishedAt: true,
  traceId: true,
  executedAt: true,
  createdAt: true,
  updatedAt: true,
  // Story 4.5: Data source fingerprints for audit
  dataSourceFingerprints: true,
};

/**
 * Create a new policy decision
 */
export async function createPolicyDecision(
  input: PolicyDecisionCreateInput
): Promise<PolicyDecisionWithRelations> {
  // C11: Ensure traceId is unique by adding timestamp + random suffix if needed
  let uniqueTraceId = input.traceId;
  if (!uniqueTraceId || uniqueTraceId.length < 8) {
    uniqueTraceId = `${uuidv4()}-${Date.now()}`;
  } else {
    // Add timestamp suffix to ensure uniqueness
    uniqueTraceId = `${uniqueTraceId}-${Date.now()}`;
  }
  
  const data: Prisma.PolicyDecisionCreateInput = {
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
    // Story 2.9: Decision History fields
    matchDate: input.matchDate,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    recommendedPick: input.recommendedPick,
    confidence: input.confidence,
    edge: input.edge,
    modelVersion: input.modelVersion,
    predictionInputs: input.predictionInputs as Prisma.InputJsonValue,
    publishedAt: input.publishedAt,
    traceId: input.traceId,
    executedAt: input.executedAt,
    // Story 4.5: Data source fingerprints for audit
    dataSourceFingerprints: input.dataSourceFingerprints as unknown as Prisma.InputJsonValue,
  };

  const decision = await prisma.policyDecision.create({
    data,
    select: policyDecisionSelect,
  });

  return decision as unknown as unknown as PolicyDecisionWithRelations;
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

  return decision as unknown as unknown as PolicyDecisionWithRelations | null;
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

  return decision as unknown as PolicyDecisionWithRelations | null;
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

  return decisions as unknown as PolicyDecisionWithRelations[];
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

  return decisions as unknown as PolicyDecisionWithRelations[];
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

  return decisions as unknown as PolicyDecisionWithRelations[];
}

/**
 * Update a policy decision
 */
export async function updatePolicyDecision(
  id: string,
  input: PolicyDecisionUpdateInput
): Promise<PolicyDecisionWithRelations | null> {
  const data: Prisma.PolicyDecisionUpdateInput = {};

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

  return decision as unknown as unknown as PolicyDecisionWithRelations;
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

  return decision as unknown as PolicyDecisionWithRelations | null;
}

// =====================================================
// Story 2.9: Decision History Query Functions
// =====================================================

/**
 * Query parameters for decision history
 */
export interface DecisionHistoryQueryParams {
  fromDate?: Date;
  toDate?: Date;
  status?: DecisionStatus;
  matchId?: string;
  dateField?: 'matchDate' | 'executedAt';
  sortBy?: 'matchDate' | 'executedAt';
  sortOrder?: 'asc' | 'desc';
  includeSynthetic?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Decision history response with pagination
 */
export interface DecisionHistoryResult {
  decisions: PolicyDecisionWithRelations[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Get decision history with filters and pagination (Story 2.9)
 */
export async function getDecisionHistory(
  params: DecisionHistoryQueryParams
): Promise<DecisionHistoryResult> {
  const {
    fromDate,
    toDate,
    status,
    matchId,
    dateField = 'matchDate',
    sortBy = 'matchDate',
    sortOrder = 'desc',
    includeSynthetic = false,
    page = 1,
    limit = 20,
  } = params;
  
  // Build where clause
  const where: Prisma.PolicyDecisionWhereInput = {};
  
  if (fromDate || toDate) {
    where[dateField] = {};
    if (fromDate) {
      where[dateField].gte = fromDate;
    }
    if (toDate) {
      where[dateField].lte = toDate;
    }
  }
  
  if (status) {
    where.status = status;
  }
  
  if (matchId) {
    where.matchId = matchId;
  }

  if (!includeSynthetic) {
    where.NOT = [
      {
        modelVersion: {
          startsWith: 'season-end-',
        },
      },
    ];
  }

  // Get total count
  const total = await prisma.policyDecision.count({ where });

  // Get paginated results
  const decisions = await prisma.policyDecision.findMany({
    where,
    select: policyDecisionSelect,
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    decisions: decisions as unknown as PolicyDecisionWithRelations[],
    total,
    page,
    limit,
  };
}

/**
 * Get policy decision by traceId (Story 2.9)
 */
export async function getPolicyDecisionByTraceId(
  traceId: string
): Promise<PolicyDecisionWithRelations | null> {
  const decision = await prisma.policyDecision.findFirst({
    where: { traceId },
    select: policyDecisionSelect,
  });

  return decision as unknown as PolicyDecisionWithRelations | null;
}

/**
 * Save many policy decisions at once (Story 2.9)
 */
export async function createManyPolicyDecisions(
  decisions: PolicyDecisionCreateInput[]
): Promise<PolicyDecisionWithRelations[]> {
  const created = await prisma.policyDecision.createManyAndReturn({
    data: decisions.map(d => ({
      prediction: { connect: { id: d.predictionId } },
      matchId: d.matchId,
      userId: d.userId,
      run: { connect: { id: d.runId } },
      status: d.status,
      rationale: d.rationale,
      confidenceGate: d.confidenceGate,
      edgeGate: d.edgeGate,
      driftGate: d.driftGate,
      hardStopGate: d.hardStopGate,
      hardStopReason: d.hardStopReason,
      recommendedAction: d.recommendedAction,
      matchDate: d.matchDate,
      homeTeam: d.homeTeam,
      awayTeam: d.awayTeam,
      recommendedPick: d.recommendedPick,
      confidence: d.confidence,
      edge: d.edge,
      modelVersion: d.modelVersion,
      predictionInputs: d.predictionInputs,
      publishedAt: d.publishedAt,
      traceId: d.traceId,
      executedAt: d.executedAt,
    })) as unknown as Parameters<typeof prisma.policyDecision.createManyAndReturn>[0]['data'],
    select: policyDecisionSelect,
  });

  return created as unknown as PolicyDecisionWithRelations[];
}

/**
 * Publish a decision (mark as published) (Story 2.9)
 */
export async function publishPolicyDecision(
  id: string
): Promise<PolicyDecisionWithRelations | null> {
  const decision = await prisma.policyDecision.update({
    where: { id },
    data: { publishedAt: new Date() },
    select: policyDecisionSelect,
  });

  return decision as unknown as PolicyDecisionWithRelations | null;
}

/**
 * Get decisions for retention cleanup (Story 2.9)
 */
export async function getDecisionsForRetention(
  beforeDate: Date,
  limit: number = 1000
): Promise<PolicyDecisionWithRelations[]> {
  const decisions = await prisma.policyDecision.findMany({
    where: {
      publishedAt: { lt: beforeDate },
    },
    select: {
      ...policyDecisionSelect,
      traceId: true,
    },
    orderBy: { publishedAt: 'asc' },
    take: limit,
  });

  return decisions as unknown as PolicyDecisionWithRelations[];
}

/**
 * Count decisions by status (Story 2.9)
 */
export async function countDecisionsByStatus(): Promise<Record<DecisionStatus, number>> {
  const [pick, noBet, hardStop] = await Promise.all([
    prisma.policyDecision.count({ where: { status: 'PICK' } }),
    prisma.policyDecision.count({ where: { status: 'NO_BET' } }),
    prisma.policyDecision.count({ where: { status: 'HARD_STOP' } }),
  ]);

  return {
    PICK: pick,
    NO_BET: noBet,
    HARD_STOP: hardStop,
  };
}
