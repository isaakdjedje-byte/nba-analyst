/**
 * Guardrail Service
 * Service layer for fetching global guardrail status
 * Story 3.7: Créer le composant GuardrailBanner pour état global
 */

import type { GuardrailStatus, GlobalGuardrailState, GuardrailApiResponse } from '../types';

const API_BASE = '/api/v1';

/**
 * Fetch global guardrail status from API
 * AC1: Affichage du statut global
 * @returns GlobalGuardrailState with status, cause, and recommended action
 */
export async function getGlobalGuardrailStatus(): Promise<GlobalGuardrailState> {
  const response = await fetch(`${API_BASE}/policy/global-status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || 
      `Failed to fetch guardrail status: ${response.status}`
    );
  }

  const apiResponse = await response.json() as GuardrailApiResponse;
  return apiResponse.data;
}

/**
 * Mock implementation for development
 * AC2: Affichage de la cause et action recommandée
 * @param status The guardrail status to mock
 * @returns Mock GlobalGuardrailState
 */
export function getMockGuardrailStatus(status: GuardrailStatus = 'HEALTHY'): GlobalGuardrailState {
  const configs = {
    HEALTHY: {
      cause: 'Tous les indicateurs sont dans les limites',
      action: 'Consultation normale des recommandations'
    },
    WARNING: {
      cause: 'Approche des limites de risque',
      action: 'Surveillance recommandée'
    },
    HARD_STOP: {
      cause: 'Cap de perte journalier atteint',
      action: 'Reprise au prochain cycle'
    }
  };

  const config = configs[status];
  
  return {
    status,
    cause: config.cause,
    recommendedAction: config.action,
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
  };
}

/**
 * Determine guardrail status from policy gates
 * Used to compute status based on actual policy evaluation
 * @param gates Array of policy gate outcomes
 * @returns GuardrailStatus based on gate evaluation
 */
export function computeGuardrailStatus(
  gates: { name: string; passed: boolean; severity?: 'warning' | 'critical' }[]
): GuardrailStatus {
  const hasCriticalFailure = gates.some(
    gate => !gate.passed && gate.severity === 'critical'
  );
  
  const hasWarningFailure = gates.some(
    gate => !gate.passed && gate.severity === 'warning'
  );

  if (hasCriticalFailure) return 'HARD_STOP';
  if (hasWarningFailure) return 'WARNING';
  return 'HEALTHY';
}
