/**
 * usePolicyConfig Hook
 * Story 5.2: Interface admin de gestion des paramètres policy
 * 
 * React hook for managing policy configuration state
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  fetchPolicyConfig,
  fetchAdaptivePolicyReport,
  updatePolicyConfig,
  transformConfigToParameters,
  validateParameter,
} from '../services/policy-config-service';
import type {
  AdaptivePolicyReportResponse,
  PolicyParameter,
  PolicyUpdateRequest,
  PolicyConfigState,
} from '../types/config';

interface UsePolicyConfigReturn {
  // State
  state: PolicyConfigState;
  parameters: PolicyParameter[];
  error: string | null;
  lastSaved: Date | null;
  adaptiveReport: AdaptivePolicyReportResponse['data'] | null;
  
  // Actions
  refresh: () => Promise<void>;
  updateParameter: (
    key: string,
    value: number,
    reason?: string
  ) => Promise<{ success: boolean; error?: string }>;
  validateValue: (
    key: string,
    value: number,
    minValue: number,
    maxValue: number
  ) => { valid: boolean; error?: string };
  
  // Loading states
  isLoading: boolean;
  isUpdating: boolean;
  isAdaptiveLoading: boolean;
}

export function usePolicyConfig(): UsePolicyConfigReturn {
  const [state, setState] = useState<PolicyConfigState>('idle');
  const [parameters, setParameters] = useState<PolicyParameter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [adaptiveReport, setAdaptiveReport] = useState<AdaptivePolicyReportResponse['data'] | null>(null);
  const [isAdaptiveLoading, setIsAdaptiveLoading] = useState(false);

  const refresh = useCallback(async () => {
    setState('loading');
    setError(null);
    setIsAdaptiveLoading(true);

    try {
      const [configResponse, adaptiveResponse] = await Promise.all([
        fetchPolicyConfig(),
        fetchAdaptivePolicyReport().catch(() => null),
      ]);

      const response = configResponse;
      const params = transformConfigToParameters(response.config);
      setParameters(params);
      setAdaptiveReport(adaptiveResponse?.data ?? null);
      setState('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement de la configuration';
      setError(message);
      setAdaptiveReport(null);
      setState('error');
    } finally {
      setIsAdaptiveLoading(false);
    }
  }, []);

  const updateParameter = useCallback(
    async (key: string, value: number, reason?: string) => {
      // First validate the value
      const param = parameters.find((p) => p.key === key);
      if (!param) {
        return { success: false, error: 'Paramètre non trouvé' };
      }

      const validation = validateParameter(key, value, param.minValue, param.maxValue);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Build update request
      const [category, field] = key.split('.');
      const updateRequest: PolicyUpdateRequest = {};

      if (category === 'confidence') {
        updateRequest.confidence = { minThreshold: value };
      } else if (category === 'edge') {
        updateRequest.edge = { minThreshold: value };
      } else if (category === 'drift') {
        updateRequest.drift = { maxDriftScore: value };
      } else if (category === 'hardStops') {
        updateRequest.hardStops = { [field]: value } as PolicyUpdateRequest['hardStops'];
      }

      setIsUpdating(true);
      setError(null);

      try {
        await updatePolicyConfig(updateRequest, reason);
        
        // Refresh to get updated values
        await refresh();
        setLastSaved(new Date());
        
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsUpdating(false);
      }
    },
    [parameters, refresh]
  );

  const validateValue = useCallback(
    (key: string, value: number, minValue: number, maxValue: number) => {
      return validateParameter(key, value, minValue, maxValue);
    },
    []
  );

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    state,
    parameters,
    error,
    lastSaved,
    adaptiveReport,
    refresh,
    updateParameter,
    validateValue,
    isLoading: state === 'loading',
    isUpdating,
    isAdaptiveLoading,
  };
}

export default usePolicyConfig;
