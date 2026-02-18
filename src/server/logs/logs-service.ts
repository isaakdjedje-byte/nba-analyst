/**
 * Logs Service
 * Story 4.2: Implementer la vue Logs avec historique des decisions
 * 
 * Server-side service for retrieving decision logs
 * Follows architecture patterns from Dev Notes
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/server/db/client';
import {
  getPolicyDecisionByTraceId,
  getPolicyDecisionById,
  type DecisionStatus,
  type PolicyDecisionWithRelations,
} from '@/server/db/repositories/policy-decisions-repository';
import { formatRecommendedPick } from '@/server/policy/recommended-pick';
import type {
  LogEntry,
  LogsQueryParams,
  LogsResponse,
  LogDetailResponse,
} from '@/features/logs/types';

/**
 * Generate a traceId for the request
 */
function generateTraceId(): string {
  return `logs-${uuidv4()}`;
}

/**
 * Transform a PolicyDecision to a LogEntry
 */
function transformToLogEntry(decision: PolicyDecisionWithRelations): LogEntry {
  // Generate rationale summary (first 100 chars)
  const rationaleSummary = decision.rationale.length > 100
    ? `${decision.rationale.substring(0, 100)}...`
    : decision.rationale;

  return {
    id: decision.id,
    matchId: decision.matchId,
    matchDate: decision.matchDate instanceof Date 
      ? decision.matchDate.toISOString() 
      : new Date(decision.matchDate).toISOString(),
    homeTeam: decision.homeTeam,
    awayTeam: decision.awayTeam,
    status: decision.status,
    rationale: decision.rationale,
    rationaleSummary,
    confidenceGate: decision.confidenceGate,
    edgeGate: decision.edgeGate,
    driftGate: decision.driftGate,
    hardStopGate: decision.hardStopGate,
    hardStopReason: decision.hardStopReason,
    recommendedPick: formatRecommendedPick(
      decision.recommendedPick,
      decision.homeTeam,
      decision.awayTeam
    ),
    confidence: decision.confidence,
    edge: decision.edge,
    traceId: decision.traceId,
    executedAt: decision.executedAt instanceof Date
      ? decision.executedAt.toISOString()
      : new Date(decision.executedAt).toISOString(),
    publishedAt: decision.publishedAt instanceof Date
      ? decision.publishedAt.toISOString()
      : decision.publishedAt 
        ? new Date(decision.publishedAt).toISOString() 
        : null,
  };
}

/**
 * Get logs with filtering, sorting, and pagination
 * Story 4.2: Implementer la vue Logs avec historique des decisions
 */
export async function getLogs(params: LogsQueryParams): Promise<LogsResponse> {
  const traceId = generateTraceId();
  const timestamp = new Date().toISOString();

  // Parse and validate params
  const {
    fromDate,
    toDate,
    status,
    sortBy = 'matchDate',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
  } = params;

  const normalizedFromDate = fromDate ? new Date(fromDate) : undefined;
  const normalizedToDate = toDate ? new Date(toDate) : undefined;

  if (normalizedFromDate) normalizedFromDate.setHours(0, 0, 0, 0);
  if (normalizedToDate) normalizedToDate.setHours(23, 59, 59, 999);

  const where = {
    ...(normalizedFromDate || normalizedToDate
      ? {
          matchDate: {
            ...(normalizedFromDate ? { gte: normalizedFromDate } : {}),
            ...(normalizedToDate ? { lte: normalizedToDate } : {}),
          },
        }
      : {}),
    ...(status && status !== 'all'
      ? status === 'PICK'
        ? {
            OR: [
              { policyDecision: { is: null } },
              { policyDecision: { is: { status: 'PICK' as DecisionStatus } } },
            ],
          }
        : { policyDecision: { is: { status: status as DecisionStatus } } }
      : {}),
  };

  const predictions = await prisma.prediction.findMany({
    where,
    include: {
      policyDecision: {
        select: {
          id: true,
          matchId: true,
          matchDate: true,
          homeTeam: true,
          awayTeam: true,
          status: true,
          rationale: true,
          confidenceGate: true,
          edgeGate: true,
          driftGate: true,
          hardStopGate: true,
          hardStopReason: true,
          recommendedPick: true,
          confidence: true,
          edge: true,
          traceId: true,
          executedAt: true,
          publishedAt: true,
          runId: true,
          userId: true,
          predictionId: true,
          recommendedAction: true,
          modelVersion: true,
          predictionInputs: true,
          createdAt: true,
          updatedAt: true,
          dataSourceFingerprints: true,
        },
      },
    },
  });

  const entries: LogEntry[] = predictions.map((prediction) => {
    if (prediction.policyDecision) {
      return transformToLogEntry(prediction.policyDecision as unknown as PolicyDecisionWithRelations);
    }

    const recommendedPick = formatRecommendedPick(
      prediction.winnerPrediction,
      prediction.homeTeam,
      prediction.awayTeam
    );

    const fallbackRationale = recommendedPick
      ? `Historical prediction resolved from model ${prediction.modelVersion}`
      : `Historical prediction without winner recommendation`;

    return {
      id: prediction.id,
      matchId: prediction.matchId,
      matchDate: prediction.matchDate.toISOString(),
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      status: 'PICK',
      rationale: fallbackRationale,
      rationaleSummary: fallbackRationale,
      confidenceGate: true,
      edgeGate: true,
      driftGate: true,
      hardStopGate: false,
      hardStopReason: null,
      recommendedPick,
      confidence: prediction.confidence,
      edge: prediction.edge,
      traceId: prediction.traceId,
      executedAt: prediction.createdAt.toISOString(),
      publishedAt: null,
    };
  });

  const sorted = entries.sort((a, b) => {
    const getSortValue = (entry: LogEntry): number => {
      const value = sortBy === 'executedAt' ? entry.executedAt : entry.matchDate;
      return new Date(value).getTime();
    };

    const left = getSortValue(a);
    const right = getSortValue(b);
    return sortOrder === 'asc' ? left - right : right - left;
  });

  const safeLimit = Math.min(limit, 100);
  const offset = (page - 1) * safeLimit;
  const data = sorted.slice(offset, offset + safeLimit);
  const total = sorted.length;
  const totalPages = Math.ceil(total / safeLimit);

  return {
    data,
    meta: {
      total,
      page,
      limit: safeLimit,
      totalPages,
      fromDate,
      toDate,
      status,
      sortBy,
      sortOrder,
      traceId,
      timestamp,
    },
  };
}

/**
 * Get a single log entry by ID
 */
export async function getLogById(id: string): Promise<LogDetailResponse | null> {
  const traceId = generateTraceId();
  const timestamp = new Date().toISOString();

  const decision = await getPolicyDecisionById(id);
  
  if (!decision) {
    return null;
  }

  return {
    data: transformToLogEntry(decision),
    meta: {
      traceId,
      timestamp,
    },
  };
}

/**
 * Get a single log entry by traceId
 */
export async function getLogByTraceId(traceId: string): Promise<LogDetailResponse | null> {
  const requestTraceId = generateTraceId();
  const timestamp = new Date().toISOString();

  const decision = await getPolicyDecisionByTraceId(traceId);
  
  if (!decision) {
    return null;
  }

  return {
    data: transformToLogEntry(decision),
    meta: {
      traceId: requestTraceId,
      timestamp,
    },
  };
}
