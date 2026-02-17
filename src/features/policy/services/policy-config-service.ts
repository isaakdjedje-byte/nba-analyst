/**
 * Policy Configuration Service
 * Story 5.2: Interface admin de gestion des paramètres policy
 * 
 * Handles fetching and updating policy configuration
 */

import type {
  PolicyConfigResponse,
  PolicyUpdateRequest,
  PolicyUpdateResponse,
  PolicyConfigError,
  AuditHistoryResponse,
} from '../types/config';

const API_BASE = '/api/v1/policy';

/**
 * Fetch current policy configuration
 */
export async function fetchPolicyConfig(): Promise<PolicyConfigResponse> {
  const response = await fetch(`${API_BASE}/config`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error: PolicyConfigError = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch policy configuration');
  }

  return response.json();
}

/**
 * Update policy configuration
 */
export async function updatePolicyConfig(
  config: PolicyUpdateRequest,
  reason?: string
): Promise<PolicyUpdateResponse> {
  const response = await fetch(`${API_BASE}/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...config,
      _meta: {
        reason,
      },
    }),
  });

  if (!response.ok) {
    const error: PolicyConfigError = await response.json();
    throw new Error(error.error?.message || 'Failed to update policy configuration');
  }

  return response.json();
}

/**
 * Fetch policy change audit history
 */
export async function fetchPolicyAuditHistory(
  limit: number = 50,
  offset: number = 0
): Promise<AuditHistoryResponse> {
  const response = await fetch(
    `${API_BASE}/config/history?limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error: PolicyConfigError = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch audit history');
  }

  return response.json();
}

/**
 * Transform API config to display parameters
 */
export function transformConfigToParameters(config: PolicyConfigResponse['config']): Array<{
  key: string;
  name: string;
  description: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  unit: string;
  category: 'edge' | 'confidence' | 'hard_stop' | 'data_quality';
}> {
  return [
    {
      key: 'confidence.minThreshold',
      name: 'Seuil de confiance minimum',
      description: 'Confiance minimale requise pour publier une recommandation',
      currentValue: config.confidence.minThreshold,
      minValue: 0,
      maxValue: 1,
      unit: '%',
      category: 'confidence',
    },
    {
      key: 'edge.minThreshold',
      name: 'Seuil de valeur minimum',
      description: 'Valeur minimale de l\'avantage (edge) requise',
      currentValue: config.edge.minThreshold,
      minValue: 0,
      maxValue: 1,
      unit: '%',
      category: 'edge',
    },
    {
      key: 'drift.maxDriftScore',
      name: 'Score de dérive maximum',
      description: 'Score de dérive maximal toléré avant NO_BET',
      currentValue: config.drift.maxDriftScore,
      minValue: 0,
      maxValue: 1,
      unit: '%',
      category: 'data_quality',
    },
    {
      key: 'hardStops.dailyLossLimit',
      name: 'Limite de perte quotidienne',
      description: 'Montant maximal de perte quotidienne avant HARD_STOP',
      currentValue: config.hardStops.dailyLossLimit,
      minValue: 0,
      maxValue: 10000,
      unit: '€',
      category: 'hard_stop',
    },
    {
      key: 'hardStops.consecutiveLosses',
      name: 'Pertes consécutives maximales',
      description: 'Nombre de pertes consécutives avant HARD_STOP',
      currentValue: config.hardStops.consecutiveLosses,
      minValue: 0,
      maxValue: 20,
      unit: '',
      category: 'hard_stop',
    },
    {
      key: 'hardStops.bankrollPercent',
      name: 'Pourcentage de bankroll',
      description: 'Pourcentage de bankroll risqué par pari',
      currentValue: config.hardStops.bankrollPercent,
      minValue: 0,
      maxValue: 1,
      unit: '%',
      category: 'hard_stop',
    },
  ];
}

/**
 * Validate a parameter value against its bounds
 */
export function validateParameter(
  key: string,
  value: number,
  minValue: number,
  maxValue: number
): { valid: boolean; error?: string } {
  if (isNaN(value)) {
    return { valid: false, error: 'La valeur doit être un nombre' };
  }

  if (value < minValue) {
    return { valid: false, error: `La valeur minimum est ${minValue}` };
  }

  if (value > maxValue) {
    return { valid: false, error: `La valeur maximum est ${maxValue}` };
  }

  return { valid: true };
}
