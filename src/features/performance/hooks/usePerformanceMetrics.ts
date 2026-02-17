/**
 * usePerformanceMetrics Hook
 * Story 4.1: Creer la vue Performance avec historique des recommandations
 * 
 * TanStack Query hook for fetching performance metrics
 * Follows architecture patterns from Dev Notes
 * 
 * Stores traceId from API response for debugging purposes
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { PerformanceMetricsResponse } from '../types';

interface UsePerformanceMetricsOptions {
  fromDate?: string;
  toDate?: string;
  enabled?: boolean;
}

async function fetchPerformanceMetrics(
  fromDate?: string,
  toDate?: string
): Promise<PerformanceMetricsResponse> {
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);

  const response = await fetch(`/api/v1/metrics/performance?${params.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch performance metrics');
  }

  return response.json();
}

export function usePerformanceMetrics(options: UsePerformanceMetricsOptions = {}) {
  const { fromDate, toDate, enabled = true } = options;
  const [lastTraceId, setLastTraceId] = useState<string | undefined>(undefined);

  const query = useQuery<PerformanceMetricsResponse>({
    queryKey: ['performance', { fromDate, toDate }],
    queryFn: async () => {
      const result = await fetchPerformanceMetrics(fromDate, toDate);
      // Store traceId for debugging/logging
      if (result.meta?.traceId) {
        setLastTraceId(result.meta.traceId);
      }
      return result;
    },
    enabled,
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

export default usePerformanceMetrics;
