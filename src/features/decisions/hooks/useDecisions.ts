/**
 * Use Decisions Hook
 * TanStack Query hook for fetching decisions
 * Story 3.2: Implement Picks view with today's decisions list
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchDecisions } from '../services/decision-service';
import type { DecisionsResponse, ApiError } from '../types';

interface UseDecisionsOptions {
  date?: string;
  status?: string;
  enabled?: boolean;
}

const QUERY_KEY = 'decisions';

// Custom error class that includes traceId for logging (AC6)
export class DecisionError extends Error {
  traceId?: string;
  code?: string;
  
  constructor(message: string, traceId?: string, code?: string) {
    super(message);
    this.name = 'DecisionError';
    this.traceId = traceId;
    this.code = code;
  }
}

/**
 * Hook to fetch today's decisions
 * Uses TanStack Query for caching and state management
 */
export function useDecisions(options: UseDecisionsOptions = {}) {
  const { date, status, enabled = true } = options;

  return useQuery<DecisionsResponse, DecisionError>({
    queryKey: [QUERY_KEY, { date, status }],
    queryFn: async () => {
      try {
        const result = await fetchDecisions(date, status);
        return result;
      } catch (error) {
        // Extract traceId from API error response for logging (AC6)
        if (error instanceof Error) {
          const apiError = error as unknown as ApiError;
          throw new DecisionError(
            error.message || 'Unknown error occurred',
            apiError.meta?.traceId,
            apiError.error?.code
          );
        }
        throw new DecisionError(String(error) || 'Unknown error occurred');
      }
    },
    enabled,
    // Cache for 2 minutes to balance freshness and performance
    staleTime: 2 * 60 * 1000,
    // Retry on failure
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

/**
 * Hook to fetch decisions with today's date as default
 */
export function useTodayDecisions(enabled = true) {
  const today = new Date().toISOString().split('T')[0];
  return useDecisions({ date: today, enabled });
}

/**
 * Hook to fetch decisions by status
 */
export function useDecisionsByStatus(status: string, enabled = true) {
  const today = new Date().toISOString().split('T')[0];
  return useDecisions({ date: today, status, enabled });
}
