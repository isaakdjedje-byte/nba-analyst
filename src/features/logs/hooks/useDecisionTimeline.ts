/**
 * useDecisionTimeline Hook
 * Story 4.3: Creer le composant DecisionTimeline pour replay decisionnel
 * 
 * TanStack Query hook for fetching decision timeline
 * Follows architecture patterns from Dev Notes
 * 
 * Stores traceId from API response for debugging purposes
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { TimelineResponse } from '../types';

interface UseDecisionTimelineOptions {
  enabled?: boolean;
}

async function fetchTimeline(decisionId: string): Promise<TimelineResponse> {
  const response = await fetch(`/api/v1/logs/${decisionId}/timeline`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch timeline for decision ${decisionId}`);
  }

  return response.json();
}

export function useDecisionTimeline(decisionId: string, options: UseDecisionTimelineOptions = {}) {
  const { enabled = true } = options;
  
  const [lastTraceId, setLastTraceId] = useState<string | undefined>(undefined);

  const query = useQuery<TimelineResponse>({
    queryKey: ['logs', decisionId, 'timeline'],
    queryFn: async () => {
      const result = await fetchTimeline(decisionId);
      // Store traceId for debugging/logging
      if (result.meta?.traceId) {
        setLastTraceId(result.meta.traceId);
      }
      return result;
    },
    enabled: enabled && !!decisionId,
    staleTime: 2 * 60 * 1000, // 2 minutes - per architecture cache strategy
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Expose traceId for debugging
  return {
    ...query,
    traceId: lastTraceId,
  };
}

export default useDecisionTimeline;
