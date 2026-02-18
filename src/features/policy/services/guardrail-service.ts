/**
 * Guardrail Service
 * Service layer for fetching global guardrail status
 * Story 3.7: Créer le composant GuardrailBanner pour état global
 */

import type { GuardrailStatus, GlobalGuardrailState, GuardrailApiResponse } from '../types';

const API_BASE = '/api/v1';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Fetch global guardrail status from API
 * AC1: Affichage du statut global
 * @returns GlobalGuardrailState with status, cause, and recommended action
 */
export async function getGlobalGuardrailStatus(): Promise<GlobalGuardrailState> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/policy/global-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La requete guardrail a expire. Veuillez reessayer.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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

export function createDegradedGuardrailStatus(): GlobalGuardrailState {
  const now = new Date();
  return {
    status: 'WARNING',
    cause: 'Statut guardrail indisponible temporairement',
    recommendedAction: 'Réessayez dans quelques instants',
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
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
