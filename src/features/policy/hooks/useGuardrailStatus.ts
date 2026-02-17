/**
 * useGuardrailStatus Hook
 * Story 3.7: Créer le composant GuardrailBanner pour état global
 * 
 * Custom React hook for fetching and managing guardrail status
 * with loading states, error handling, and caching.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GlobalGuardrailState, GuardrailStatus } from '../types';
import { getGlobalGuardrailStatus, getMockGuardrailStatus } from '../services/guardrail-service';

interface UseGuardrailStatusReturn {
  status: GlobalGuardrailState | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseGuardrailStatusOptions {
  /** Enable automatic refetching on window focus */
  refetchOnFocus?: boolean;
  /** Polling interval in milliseconds (0 to disable) */
  pollingInterval?: number;
  /** Use mock data instead of API */
  useMock?: boolean;
  /** Initial mock status (for testing) */
  initialMockStatus?: GuardrailStatus;
}

/**
 * Hook for fetching and managing guardrail status
 * 
 * @param options Configuration options
 * @returns Guardrail status state and controls
 * 
 * @example
 * ```tsx
 * const { status, isLoading, error, refetch } = useGuardrailStatus({
 *   refetchOnFocus: true,
 *   pollingInterval: 60000 // 1 minute
 * });
 * ```
 */
export function useGuardrailStatus(
  options: UseGuardrailStatusOptions = {}
): UseGuardrailStatusReturn {
  const {
    refetchOnFocus = false,
    pollingInterval = 0,
    useMock = false,
    initialMockStatus = 'HEALTHY',
  } = options;

  const [status, setStatus] = useState<GlobalGuardrailState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = useMock
        ? getMockGuardrailStatus(initialMockStatus)
        : await getGlobalGuardrailStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch guardrail status'));
      // Set a degraded state on error
      setStatus(getMockGuardrailStatus('WARNING'));
    } finally {
      setIsLoading(false);
    }
  }, [useMock, initialMockStatus]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnFocus) return;

    const handleFocus = () => {
      fetchStatus();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchStatus, refetchOnFocus]);

  // Polling
  useEffect(() => {
    if (pollingInterval <= 0) return;

    const intervalId = setInterval(() => {
      fetchStatus();
    }, pollingInterval);

    return () => clearInterval(intervalId);
  }, [fetchStatus, pollingInterval]);

  return {
    status,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}

export default useGuardrailStatus;
