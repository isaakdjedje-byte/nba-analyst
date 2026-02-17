/**
 * useLogs Hook
 * Story 4.2: Implementer la vue Logs avec historique des decisions
 * 
 * TanStack Query hook for fetching decision logs
 * Follows architecture patterns from Dev Notes
 * 
 * Stores traceId from API response for debugging purposes
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { 
  LogsResponse, 
  LogSortField,
  LogSortOrder,
} from '../types';
import type { DecisionStatus } from '@/server/db/repositories/policy-decisions-repository';

interface UseLogsOptions {
  fromDate?: string;
  toDate?: string;
  status?: DecisionStatus | 'all';
  sortBy?: LogSortField;
  sortOrder?: LogSortOrder;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

async function fetchLogs(
  fromDate?: string,
  toDate?: string,
  status?: DecisionStatus | 'all',
  sortBy?: LogSortField,
  sortOrder?: LogSortOrder,
  page?: number,
  limit?: number
): Promise<LogsResponse> {
  const params = new URLSearchParams();
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);
  if (status) params.set('status', status);
  if (sortBy) params.set('sortBy', sortBy);
  if (sortOrder) params.set('sortOrder', sortOrder);
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));

  const response = await fetch(`/api/v1/logs?${params.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch logs');
  }

  return response.json();
}

export function useLogs(options: UseLogsOptions = {}) {
  const { 
    fromDate, 
    toDate, 
    status = 'all',
    sortBy = 'matchDate',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
    enabled = true 
  } = options;
  
  const [lastTraceId, setLastTraceId] = useState<string | undefined>(undefined);

  const query = useQuery<LogsResponse>({
    queryKey: ['logs', { fromDate, toDate, status, sortBy, sortOrder, page, limit }],
    queryFn: async () => {
      const result = await fetchLogs(fromDate, toDate, status, sortBy, sortOrder, page, limit);
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

export default useLogs;
