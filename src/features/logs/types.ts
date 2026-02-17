/**
 * Logs Feature Types
 * Story 4.2: Implementer la vue Logs avec historique des decisions
 * 
 * Following architecture patterns from Dev Notes
 */

import type { DecisionStatus } from '@/server/db/repositories/policy-decisions-repository';

/**
 * Log entry representing a single decision in the logs view
 */
export interface LogEntry {
  id: string;
  matchId: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  status: DecisionStatus;
  rationale: string;
  rationaleSummary: string;
  confidenceGate: boolean;
  edgeGate: boolean;
  driftGate: boolean;
  hardStopGate: boolean;
  hardStopReason: string | null;
  recommendedPick: string | null;
  confidence: number;
  edge: number | null;
  traceId: string;
  executedAt: string;
  publishedAt: string | null;
}

/**
 * Sorting options for log entries
 */
export type LogSortField = 'matchDate' | 'executedAt';
export type LogSortOrder = 'asc' | 'desc';

/**
 * Filter options for log entries
 */
export interface LogFilters {
  fromDate?: string;
  toDate?: string;
  status?: DecisionStatus | 'all';
}

/**
 * Query parameters for logs API
 */
export interface LogsQueryParams {
  fromDate?: string;
  toDate?: string;
  status?: DecisionStatus | 'all';
  sortBy?: LogSortField;
  sortOrder?: LogSortOrder;
  page?: number;
  limit?: number;
}

/**
 * API response for logs list
 */
export interface LogsResponse {
  data: LogEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    fromDate?: string;
    toDate?: string;
    status?: DecisionStatus | 'all';
    sortBy?: LogSortField;
    sortOrder?: LogSortOrder;
    traceId?: string;
    timestamp: string;
  };
}

/**
 * Single log entry detail response
 */
export interface LogDetailResponse {
  data: LogEntry;
  meta: {
    traceId?: string;
    timestamp: string;
  };
}

/**
 * Log entry with gates for display
 */
export interface LogEntryGates {
  confidence: boolean;
  edge: boolean;
  drift: boolean;
  hardStop: boolean;
}

/**
 * State vocabulary per architecture
 */
export type LogsState = 'idle' | 'loading' | 'success' | 'error' | 'degraded' | 'blocked';

/**
 * Status badge variant mapping
 */
export const STATUS_BADGE_VARIANTS: Record<DecisionStatus, 'success' | 'warning' | 'error'> = {
  PICK: 'success',
  NO_BET: 'warning',
  HARD_STOP: 'error',
};

/**
 * Status label mapping
 */
export const STATUS_LABELS: Record<DecisionStatus, string> = {
  PICK: 'PICK',
  NO_BET: 'No-Bet',
  HARD_STOP: 'Hard-Stop',
};

// =====================================================
// Story 4.3: Decision Timeline Types
// =====================================================

/**
 * Timeline phases in order
 */
export type TimelinePhase = 'DATA_INGESTION' | 'ML_INFERENCE' | 'POLICY_EVALUATION' | 'DECISION_OUTPUT';

/**
 * Timeline event status
 */
export type TimelineEventStatus = 'success' | 'failure' | 'skipped';

/**
 * Individual timeline event/step
 */
export interface TimelineEvent {
  id: string;
  phase: TimelinePhase;
  name: string;
  description: string;
  timestamp: string;
  duration?: number; // in milliseconds
  status: TimelineEventStatus;
  traceId: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

/**
 * Grouped timeline events by phase
 */
export interface TimelinePhaseGroup {
  phase: TimelinePhase;
  phaseLabel: string;
  events: TimelineEvent[];
  startTime: string;
  endTime: string;
  totalDuration: number;
}

/**
 * Complete timeline for a decision
 */
export interface DecisionTimeline {
  decisionId: string;
  traceId: string;
  matchId: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  finalStatus: DecisionStatus;
  events: TimelineEvent[];
  phaseGroups: TimelinePhaseGroup[];
}

/**
 * API response for decision timeline
 */
export interface TimelineResponse {
  data: DecisionTimeline;
  meta: {
    traceId: string;
    timestamp: string;
  };
}

/**
 * Phase configuration for display
 */
export const PHASE_CONFIG: Record<TimelinePhase, { label: string; icon: string; color: string }> = {
  DATA_INGESTION: { label: 'Data Ingestion', icon: 'Database', color: 'blue' },
  ML_INFERENCE: { label: 'ML Inference', icon: 'Brain', color: 'purple' },
  POLICY_EVALUATION: { label: 'Policy Evaluation', icon: 'Shield', color: 'emerald' },
  DECISION_OUTPUT: { label: 'Decision Output', icon: 'CheckCircle', color: 'orange' },
};

/**
 * Phase order for sorting
 */
export const PHASE_ORDER: TimelinePhase[] = [
  'DATA_INGESTION',
  'ML_INFERENCE',
  'POLICY_EVALUATION',
  'DECISION_OUTPUT',
];

/**
 * Filter options for timeline
 */
export interface TimelineFilters {
  phase?: TimelinePhase | 'all';
  status?: TimelineEventStatus | 'all';
  expanded?: boolean;
}
