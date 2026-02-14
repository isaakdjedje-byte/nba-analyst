/**
 * Decision Types
 * TypeScript types for decision/pick data
 * Story 3.2: Implement Picks view with today's decisions list
 */

export type DecisionStatus = 'PICK' | 'NO_BET' | 'HARD_STOP';

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string | null;
  league: string | null;
}

export interface Decision {
  id: string;
  match: Match;
  status: DecisionStatus;
  rationale: string;
  edge: number | null;
  confidence: number;
  recommendedPick: string | null;
  dailyRunId: string;
  createdAt: string;
}

export interface DecisionsResponse {
  data: Decision[];
  meta: {
    traceId: string;
    timestamp: string;
    count: number;
    date: string;
    fromCache: boolean;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  meta: {
    traceId: string;
    timestamp: string;
  };
}

export type StatusConfig = {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
};

export const STATUS_CONFIG: Record<DecisionStatus, StatusConfig> = {
  PICK: {
    label: 'Pick',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: '✓',
  },
  NO_BET: {
    label: 'No-Bet',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: '−',
  },
  HARD_STOP: {
    label: 'Hard-Stop',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    icon: '⚠',
  },
};
