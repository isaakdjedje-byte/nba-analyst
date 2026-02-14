/**
 * Prediction Mappers
 * 
 * Maps between database (snake_case) and API (camelCase) representations.
 * Story 2.4: Database schema for predictions and decisions.
 * 
 * @see https://github.com/isaacnino/nba-analyst/tree/main/docs/architecture.md#data-mappers
 */

import type { UnifiedPrediction } from '../repositories/predictions-repository';

// Database row shape (snake_case from Prisma)
export interface PredictionDbRow {
  id: string;
  match_id: string;
  run_id: string;
  user_id: string;
  winner_prediction: string | null;
  score_prediction: string | null;
  over_under_prediction: number | null;
  confidence: number;
  model_version: string;
  features_hash: string | null;
  match_date: Date;
  league: string;
  home_team: string;
  away_team: string;
  status: string;
  trace_id: string;
  created_at: Date;
  updated_at: Date;
}

// Helper to check if a value is snake_case or camelCase
function isSnakeCase(obj: unknown): obj is PredictionDbRow {
  return typeof obj === 'object' && obj !== null && 'match_id' in obj;
}

// API DTO shape (camelCase for frontend)
export interface PredictionDto {
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
  matchDate: string; // ISO format
  league: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  traceId: string;
  createdAt: string; // ISO format
  updatedAt: string; // ISO format
}

/**
 * Convert database row (snake_case) to API DTO (camelCase)
 */
export function toPredictionDto(
  dbRow: PredictionDbRow | UnifiedPrediction
): PredictionDto {
  const src = isSnakeCase(dbRow) ? {
    matchId: dbRow.match_id,
    runId: dbRow.run_id,
    userId: dbRow.user_id,
    winnerPrediction: dbRow.winner_prediction,
    scorePrediction: dbRow.score_prediction,
    overUnderPrediction: dbRow.over_under_prediction,
    modelVersion: dbRow.model_version,
    featuresHash: dbRow.features_hash,
    matchDate: dbRow.match_date,
    homeTeam: dbRow.home_team,
    awayTeam: dbRow.away_team,
    traceId: dbRow.trace_id,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
  } : {
    matchId: dbRow.matchId,
    runId: dbRow.runId,
    userId: dbRow.userId,
    winnerPrediction: dbRow.winnerPrediction,
    scorePrediction: dbRow.scorePrediction,
    overUnderPrediction: dbRow.overUnderPrediction,
    modelVersion: dbRow.modelVersion,
    featuresHash: dbRow.featuresHash,
    matchDate: dbRow.matchDate,
    homeTeam: dbRow.homeTeam,
    awayTeam: dbRow.awayTeam,
    traceId: dbRow.traceId,
    createdAt: dbRow.createdAt,
    updatedAt: dbRow.updatedAt,
  };

  return {
    id: dbRow.id,
    ...src,
    confidence: dbRow.confidence,
    league: 'league' in dbRow ? (dbRow as unknown as { league: string }).league : 'nba',
    status: dbRow.status,
    matchDate: src.matchDate?.toISOString() || new Date().toISOString(),
    createdAt: src.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: src.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Convert API DTO (camelCase) to database shape (snake_case)
 */
export function toPredictionDb(
  dto: Partial<PredictionDto>
): Partial<PredictionDbRow> {
  const dbRow: Partial<PredictionDbRow> = {};

  if (dto.matchId !== undefined) dbRow.match_id = dto.matchId;
  if (dto.runId !== undefined) dbRow.run_id = dto.runId;
  if (dto.userId !== undefined) dbRow.user_id = dto.userId;
  if (dto.winnerPrediction !== undefined) dbRow.winner_prediction = dto.winnerPrediction;
  if (dto.scorePrediction !== undefined) dbRow.score_prediction = dto.scorePrediction;
  if (dto.overUnderPrediction !== undefined) dbRow.over_under_prediction = dto.overUnderPrediction;
  if (dto.confidence !== undefined) dbRow.confidence = dto.confidence;
  if (dto.modelVersion !== undefined) dbRow.model_version = dto.modelVersion;
  if (dto.featuresHash !== undefined) dbRow.features_hash = dto.featuresHash;
  if (dto.matchDate !== undefined) dbRow.match_date = new Date(dto.matchDate);
  if (dto.league !== undefined) dbRow.league = dto.league;
  if (dto.homeTeam !== undefined) dbRow.home_team = dto.homeTeam;
  if (dto.awayTeam !== undefined) dbRow.away_team = dto.awayTeam;
  if (dto.status !== undefined) dbRow.status = dto.status;
  if (dto.traceId !== undefined) dbRow.trace_id = dto.traceId;

  return dbRow;
}

/**
 * Convert array of database rows to API DTOs
 */
export function toPredictionDtos(
  dbRows: (PredictionDbRow | UnifiedPrediction)[]
): PredictionDto[] {
  return dbRows.map(toPredictionDto);
}
