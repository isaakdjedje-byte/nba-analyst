/**
 * useBlockCause Hook
 * Story 5.1: Créer le panneau d'affichage des causes de blocage policy
 * 
 * TanStack Query hook for fetching block cause information
 * Follows architecture patterns from Dev Notes
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import type { BlockCauseResponse, BlockCause } from '../types';

interface UseBlockCauseOptions {
  enabled?: boolean;
}

async function fetchBlockCause(decisionId: string): Promise<BlockCauseResponse> {
  const response = await fetch(`/api/v1/decisions/${decisionId}/block-cause`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // If decision is not blocked (404 or NOT_BLOCKED), return null data
    if (response.status === 404 || errorData.error?.code === 'NOT_BLOCKED') {
      return { data: null as unknown as BlockCause, meta: { traceId: '', timestamp: new Date().toISOString() } };
    }
    throw new Error(errorData.error?.message || `Failed to fetch block cause for decision ${decisionId}`);
  }

  return response.json();
}

export function useBlockCause(decisionId: string, options: UseBlockCauseOptions = {}) {
  const { enabled = true } = options;
  
  const query = useQuery<BlockCauseResponse>({
    queryKey: ['decisions', decisionId, 'block-cause'],
    queryFn: async () => {
      try {
        return await fetchBlockCause(decisionId);
      } catch (error) {
        // Return empty response for non-blocked decisions
        if (error instanceof Error && error.message.includes('not blocked')) {
          return { data: null as unknown as BlockCause, meta: { traceId: '', timestamp: new Date().toISOString() } };
        }
        throw error;
      }
    },
    enabled: enabled && !!decisionId,
    staleTime: 5 * 60 * 1000, // 5 minutes - block cause rarely changes
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    retry: 1,
    refetchOnWindowFocus: false,
    // Don't show error UI for non-blocked decisions
    throwOnError: false,
  });

  // Determine if decision is blocked based on response
  const isBlocked = query.data?.data !== null && query.data?.data !== undefined && 'category' in (query.data?.data || {});

  return {
    ...query,
    isBlocked,
    blockCause: query.data?.data,
  };
}

export default useBlockCause;
