/**
 * Investigation Feature Types
 * Story 4.4: Implementer l'investigation de decision contestee
 * 
 * Following architecture patterns from Dev Notes
 */

import type { DecisionStatus } from '@/server/db/repositories/policy-decisions-repository';

/**
 * Investigation search filters
 */
export interface InvestigationFilters {
  fromDate?: string;
  toDate?: string;
  matchId?: string;
  homeTeam?: string;
  awayTeam?: string;
  userId?: string;
  status?: DecisionStatus | 'all';
}

/**
 * Investigation search query parameters
 */
export interface InvestigationSearchParams {
  fromDate?: string;
  toDate?: string;
  matchId?: string;
  homeTeam?: string;
  awayTeam?: string;
  userId?: string;
  status?: DecisionStatus | 'all';
  page?: number;
  limit?: number;
}

/**
 * Investigation search result entry
 */
export interface InvestigationResult {
  id: string;
  matchId: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  status: DecisionStatus;
  rationaleSummary: string;
  confidence: number;
  edge: number | null;
  traceId: string;
  executedAt: string;
  publishedAt: string | null;
  // Additional evidence fields for investigation
  gates: {
    confidence: boolean;
    edge: boolean;
    drift: boolean;
    hardStop: boolean;
  };
  hardStopReason: string | null;
  recommendedPick: string | null;
  mlOutput?: {
    confidence: number;
    dominantFactors: string[];
  };
  dataQuality?: {
    signal: string;
    isAnomaly: boolean;
  }[];
}

/**
 * Investigation API response
 */
export interface InvestigationSearchResponse {
  data: InvestigationResult[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    filters: InvestigationFilters;
    traceId: string;
    timestamp: string;
  };
}

/**
 * Investigation detail response (single decision with full trace)
 */
export interface InvestigationDetailResponse {
  data: InvestigationResult;
  meta: {
    traceId: string;
    timestamp: string;
  };
}

/**
 * Investigation export formats
 */
export type InvestigationExportFormat = 'pdf' | 'summary';

/**
 * Investigation export request
 */
export interface InvestigationExportRequest {
  decisionId: string;
  format: InvestigationExportFormat;
  includeTimeline?: boolean;
  includeEvidence?: boolean;
}

/**
 * Investigation export response
 */
export interface InvestigationExportResponse {
  data: {
    content: string; // PDF base64 or text summary
    filename: string;
    traceId: string;
  };
  meta: {
    timestamp: string;
  };
}

/**
 * Investigation audit log entry
 */
export interface InvestigationAuditLog {
  id: string;
  decisionId: string;
  investigatorId: string;
  investigatorName: string;
  action: 'view' | 'export_pdf' | 'export_summary' | 'copy_trace';
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * State vocabulary per architecture
 */
export type InvestigationState = 'idle' | 'loading' | 'success' | 'error' | 'degraded' | 'blocked';
