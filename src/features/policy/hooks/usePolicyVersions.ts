/**
 * Policy Versions Hook
 * Story 5.3: Implementer le versioning et historique des changements policy
 * 
 * Client-side hook for fetching and managing policy version history
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

export interface PolicyVersion {
  id: string;
  version: number;
  createdAt: string;
  createdBy: string;
  changeReason?: string;
  isRestore: boolean;
  previousVersionId?: string;
  config: PolicyConfigData;
}

export interface PolicyConfigData {
  confidence: {
    minThreshold: number;
  };
  edge: {
    minThreshold: number;
  };
  drift: {
    maxDriftScore: number;
  };
  hardStops: {
    dailyLossLimit: number;
    consecutiveLosses: number;
    bankrollPercent: number;
  };
}

export interface VersionHistoryResponse {
  data: {
    versions: PolicyVersion[];
    total: number;
    pagination: {
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
  meta: {
    traceId: string;
    timestamp: string;
  };
}

export interface RestoreResponse {
  data: {
    message: string;
    restoredVersion: PolicyVersion;
    sourceVersion: {
      id: string;
      version: number;
    };
  };
  meta: {
    traceId: string;
    timestamp: string;
  };
}

/**
 * Fetch policy version history
 */
async function fetchVersionHistory(limit = 20, offset = 0): Promise<VersionHistoryResponse> {
  const response = await fetch(
    `/api/v1/policy/config/history?type=versions&limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch version history');
  }

  return response.json();
}

/**
 * Restore a policy version
 */
async function restoreVersion(versionId: string): Promise<RestoreResponse> {
  const response = await fetch(`/api/v1/policy/config/restore/${versionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to restore version');
  }

  return response.json();
}

/**
 * Hook to fetch policy version history
 */
export function usePolicyVersions(limit = 20, offset = 0) {
  const { data: session } = useSession();
  
  return useQuery({
    queryKey: ['policyVersions', limit, offset],
    queryFn: () => fetchVersionHistory(limit, offset),
    enabled: !!session,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to restore a policy version
 */
export function useRestorePolicyVersion() {
  const queryClient = useQueryClient();
  useSession();

  return useMutation({
    mutationFn: (versionId: string) => restoreVersion(versionId),
    onSuccess: () => {
      // Invalidate version history cache
      queryClient.invalidateQueries({ queryKey: ['policyVersions'] });
      // Invalidate current config cache
      queryClient.invalidateQueries({ queryKey: ['policyConfig'] });
    },
  });
}

/**
 * Calculate diff between two policy versions
 */
export function calculateVersionDiff(
  oldVersion: PolicyVersion,
  newVersion: PolicyVersion
): Array<{
  key: string;
  path: string;
  oldValue: string | number;
  newValue: string | number;
  changed: boolean;
}> {
  const diffs: Array<{
    key: string;
    path: string;
    oldValue: string | number;
    newValue: string | number;
    changed: boolean;
  }> = [];

  const oldConfig = oldVersion.config;
  const newConfig = newVersion.config;

  // Compare confidence
  if (oldConfig.confidence.minThreshold !== newConfig.confidence.minThreshold) {
    diffs.push({
      key: 'confidence.minThreshold',
      path: 'Seuil de confiance',
      oldValue: (oldConfig.confidence.minThreshold * 100).toFixed(0) + '%',
      newValue: (newConfig.confidence.minThreshold * 100).toFixed(0) + '%',
      changed: true,
    });
  }

  // Compare edge
  if (oldConfig.edge.minThreshold !== newConfig.edge.minThreshold) {
    diffs.push({
      key: 'edge.minThreshold',
      path: 'Seuil de valeur (edge)',
      oldValue: (oldConfig.edge.minThreshold * 100).toFixed(0) + '%',
      newValue: (newConfig.edge.minThreshold * 100).toFixed(0) + '%',
      changed: true,
    });
  }

  // Compare drift
  if (oldConfig.drift.maxDriftScore !== newConfig.drift.maxDriftScore) {
    diffs.push({
      key: 'drift.maxDriftScore',
      path: 'Score de dérive maximum',
      oldValue: (oldConfig.drift.maxDriftScore * 100).toFixed(0) + '%',
      newValue: (newConfig.drift.maxDriftScore * 100).toFixed(0) + '%',
      changed: true,
    });
  }

  // Compare hard stops
  if (oldConfig.hardStops.dailyLossLimit !== newConfig.hardStops.dailyLossLimit) {
    diffs.push({
      key: 'hardStops.dailyLossLimit',
      path: 'Limite de perte quotidienne',
      oldValue: '€' + oldConfig.hardStops.dailyLossLimit,
      newValue: '€' + newConfig.hardStops.dailyLossLimit,
      changed: true,
    });
  }

  if (oldConfig.hardStops.consecutiveLosses !== newConfig.hardStops.consecutiveLosses) {
    diffs.push({
      key: 'hardStops.consecutiveLosses',
      path: 'Pertes consécutives maximales',
      oldValue: oldConfig.hardStops.consecutiveLosses.toString(),
      newValue: newConfig.hardStops.consecutiveLosses.toString(),
      changed: true,
    });
  }

  if (oldConfig.hardStops.bankrollPercent !== newConfig.hardStops.bankrollPercent) {
    diffs.push({
      key: 'hardStops.bankrollPercent',
      path: 'Pourcentage de bankroll',
      oldValue: (oldConfig.hardStops.bankrollPercent * 100).toFixed(0) + '%',
      newValue: (newConfig.hardStops.bankrollPercent * 100).toFixed(0) + '%',
      changed: true,
    });
  }

  return diffs;
}
