/**
 * Performance Feature Types
 * Story 4.1: Creer la vue Performance avec historique des recommandations
 */

export interface PerformanceMetrics {
  accuracyRate: number;
  pickWinRate: number | null;
  resolvedPicksCount: number;
  wonPicksCount: number;
  pendingPicksCount: number;
  picksCount: number;
  noBetCount: number;
  hardStopCount: number;
  totalDecisions: number;
}

export interface PerformanceMetricsResponse {
  data: PerformanceMetrics;
  meta: {
    fromDate: string;
    toDate: string;
    calculatedAt: string;
    traceId?: string;
  };
}

export interface DateRange {
  fromDate: string;
  toDate: string;
}

export type PerformanceState = 'idle' | 'loading' | 'success' | 'error' | 'degraded' | 'blocked';
