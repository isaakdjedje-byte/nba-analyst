/**
 * Policy Decision Mappers
 * 
 * Maps between database (snake_case) and API (camelCase) representations.
 * Story 2.4: Database schema for predictions and decisions.
 * 
 * @see https://github.com/isaacnino/nba-analyst/tree/main/docs/architecture.md#data-mappers
 */

import type { PolicyDecisionWithRelations, DecisionStatus } from '../repositories/policy-decisions-repository';

// Database row shape (snake_case from Prisma)
export interface PolicyDecisionDbRow {
  id: string;
  prediction_id: string;
  match_id: string;
  user_id: string;
  status: 'PICK' | 'NO_BET' | 'HARD_STOP';
  rationale: string;
  confidence_gate: boolean;
  edge_gate: boolean;
  drift_gate: boolean;
  hard_stop_gate: boolean;
  hard_stop_reason: string | null;
  recommended_action: string | null;
  trace_id: string;
  executed_at: Date;
  run_id: string;
  created_at: Date;
  updated_at: Date;
}

// API DTO shape (camelCase for frontend)
export interface PolicyDecisionDto {
  id: string;
  predictionId: string;
  matchId: string;
  userId: string;
  status: DecisionStatus;
  rationale: string;
  confidenceGate: boolean;
  edgeGate: boolean;
  driftGate: boolean;
  hardStopGate: boolean;
  hardStopReason: string | null;
  recommendedAction: string | null;
  traceId: string;
  executedAt: string; // ISO format
  runId: string;
  createdAt: string; // ISO format
  updatedAt: string; // ISO format
}

/**
 * Convert database row (snake_case) to API DTO (camelCase)
 */
export function toPolicyDecisionDto(
  dbRow: PolicyDecisionDbRow | PolicyDecisionWithRelations
): PolicyDecisionDto {
  return {
    id: dbRow.id,
    predictionId: 'prediction_id' in dbRow 
      ? dbRow.prediction_id 
      : dbRow.predictionId,
    matchId: 'match_id' in dbRow ? dbRow.match_id : dbRow.matchId,
    userId: 'user_id' in dbRow ? dbRow.user_id : dbRow.userId,
    status: dbRow.status as DecisionStatus,
    rationale: dbRow.rationale,
    confidenceGate: 'confidence_gate' in dbRow 
      ? dbRow.confidence_gate 
      : dbRow.confidenceGate,
    edgeGate: 'edge_gate' in dbRow ? dbRow.edge_gate : dbRow.edgeGate,
    driftGate: 'drift_gate' in dbRow ? dbRow.drift_gate : dbRow.driftGate,
    hardStopGate: 'hard_stop_gate' in dbRow 
      ? dbRow.hard_stop_gate 
      : dbRow.hardStopGate,
    hardStopReason: 'hard_stop_reason' in dbRow 
      ? dbRow.hard_stop_reason 
      : dbRow.hardStopReason,
    recommendedAction: 'recommended_action' in dbRow 
      ? dbRow.recommended_action 
      : dbRow.recommendedAction,
    traceId: 'trace_id' in dbRow ? dbRow.trace_id : dbRow.traceId,
    executedAt: ('executed_at' in dbRow 
      ? dbRow.executed_at 
      : dbRow.executedAt).toISOString(),
    runId: 'run_id' in dbRow ? dbRow.run_id : dbRow.runId,
    createdAt: ('created_at' in dbRow 
      ? dbRow.created_at 
      : dbRow.createdAt).toISOString(),
    updatedAt: ('updated_at' in dbRow 
      ? dbRow.updated_at 
      : dbRow.updatedAt).toISOString(),
  };
}

/**
 * Convert API DTO (camelCase) to database shape (snake_case)
 */
export function toPolicyDecisionDb(
  dto: Partial<PolicyDecisionDto>
): Partial<PolicyDecisionDbRow> {
  const dbRow: Partial<PolicyDecisionDbRow> = {};

  if (dto.predictionId !== undefined) dbRow.prediction_id = dto.predictionId;
  if (dto.matchId !== undefined) dbRow.match_id = dto.matchId;
  if (dto.userId !== undefined) dbRow.user_id = dto.userId;
  if (dto.status !== undefined) dbRow.status = dto.status;
  if (dto.rationale !== undefined) dbRow.rationale = dto.rationale;
  if (dto.confidenceGate !== undefined) dbRow.confidence_gate = dto.confidenceGate;
  if (dto.edgeGate !== undefined) dbRow.edge_gate = dto.edgeGate;
  if (dto.driftGate !== undefined) dbRow.drift_gate = dto.driftGate;
  if (dto.hardStopGate !== undefined) dbRow.hard_stop_gate = dto.hardStopGate;
  if (dto.hardStopReason !== undefined) dbRow.hard_stop_reason = dto.hardStopReason;
  if (dto.recommendedAction !== undefined) dbRow.recommended_action = dto.recommendedAction;
  if (dto.traceId !== undefined) dbRow.trace_id = dto.traceId;
  if (dto.executedAt !== undefined) dbRow.executed_at = new Date(dto.executedAt);
  if (dto.runId !== undefined) dbRow.run_id = dto.runId;

  return dbRow;
}

/**
 * Convert array of database rows to API DTOs
 */
export function toPolicyDecisionDtos(
  dbRows: (PolicyDecisionDbRow | PolicyDecisionWithRelations)[]
): PolicyDecisionDto[] {
  return dbRows.map(toPolicyDecisionDto);
}
