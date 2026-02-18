/**
 * Logs Service
 * Story 4.2: Implementer la vue Logs avec historique des decisions
 * 
 * Server-side service for retrieving decision logs
 * Follows architecture patterns from Dev Notes
 */

import { v4 as uuidv4 } from 'uuid';
import {
  getDecisionHistory,
  getPolicyDecisionByTraceId,
  getPolicyDecisionById,
  type DecisionStatus,
  type PolicyDecisionWithRelations,
} from '@/server/db/repositories/policy-decisions-repository';
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
    recommendedPick: decision.recommendedPick,
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

  // Build query params for repository
  const normalizedFromDate = fromDate ? new Date(fromDate) : undefined;
  const normalizedToDate = toDate ? new Date(toDate) : undefined;

  if (normalizedFromDate) {
    normalizedFromDate.setHours(0, 0, 0, 0);
  }

  if (normalizedToDate) {
    normalizedToDate.setHours(23, 59, 59, 999);
  }

  const repoParams = {
    fromDate: normalizedFromDate,
    toDate: normalizedToDate,
    status: status && status !== 'all' ? status as DecisionStatus : undefined,
    dateField: 'executedAt' as const,
    sortBy,
    sortOrder,
    page,
    limit: Math.min(limit, 100), // Cap at 100 per page
  };

  // Query database
  const result = await getDecisionHistory(repoParams);

  // Transform to LogEntry format
  const data = result.decisions.map(transformToLogEntry);

  // Calculate total pages
  const totalPages = Math.ceil(result.total / limit);

  return {
    data,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
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
