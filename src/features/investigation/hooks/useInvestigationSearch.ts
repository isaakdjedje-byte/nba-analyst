/**
 * useInvestigationSearch Hook
 * Story 4.4: Implementer l'investigation de decision contestee
 * 
 * TanStack Query hook for searching and fetching investigation data
 * Follows architecture patterns from Dev Notes
 * 
 * Query keys: ['investigations', filters]
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import type { 
  InvestigationFilters, 
  InvestigationSearchResponse, 
  InvestigationResult 
} from '../types';

const REQUEST_TIMEOUT_MS = 10000;

interface UseInvestigationSearchOptions {
  enabled?: boolean;
}

/**
 * Fetch investigation search results
 */
async function fetchInvestigations(
  filters: InvestigationFilters,
  page: number = 1,
  limit: number = 20
): Promise<InvestigationSearchResponse> {
  const params = new URLSearchParams();
  
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  if (filters.matchId) params.set('matchId', filters.matchId);
  if (filters.homeTeam) params.set('homeTeam', filters.homeTeam);
  if (filters.awayTeam) params.set('awayTeam', filters.awayTeam);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.status) params.set('status', filters.status);
  
  params.set('page', String(page));
  params.set('limit', String(limit));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`/api/v1/investigations/search?${params.toString()}`, {
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La requete investigation a expire. Veuillez reessayer.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch investigations');
  }

  return response.json();
}

/**
 * Fetch single investigation detail
 */
async function fetchInvestigationDetail(decisionId: string): Promise<InvestigationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`/api/v1/investigations/${decisionId}`, {
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La requete detail investigation a expire. Veuillez reessayer.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch investigation ${decisionId}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Main useInvestigationSearch hook
 */
export function useInvestigationSearch(
  filters: InvestigationFilters,
  options: UseInvestigationSearchOptions = {}
) {
  const { enabled = true } = options;
  const [page, setPage] = useState(1);

  const query = useQuery<InvestigationSearchResponse>({
    queryKey: ['investigations', filters, page],
    queryFn: async () => {
      const result = await fetchInvestigations(filters, page);
      return result;
    },
    enabled: enabled && Object.keys(filters).length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes - per architecture cache strategy
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Pagination
  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const nextPage = useCallback(() => {
    const totalPages = query.data?.meta.totalPages || 1;
    if (page < totalPages) {
      setPage((p) => p + 1);
    }
  }, [page, query.data?.meta.totalPages]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  }, [page]);

  return {
    ...query,
    results: query.data?.data || [],
    total: query.data?.meta.total || 0,
    page,
    totalPages: query.data?.meta.totalPages || 1,
    goToPage,
    nextPage,
    prevPage,
  };
}

/**
 * Hook for fetching single investigation detail
 */
export function useInvestigationDetail(
  decisionId: string | null,
  options: UseInvestigationSearchOptions = {}
) {
  const { enabled = true } = options;

  const query = useQuery<InvestigationResult>({
    queryKey: ['investigation', decisionId],
    queryFn: async () => {
      if (!decisionId) throw new Error('No decision ID provided');
      return fetchInvestigationDetail(decisionId);
    },
    enabled: enabled && !!decisionId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  return query;
}

export default useInvestigationSearch;
