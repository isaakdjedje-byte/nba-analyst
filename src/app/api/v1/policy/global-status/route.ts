/**
 * Global Guardrail Status API Endpoint
 * 
 * GET /api/v1/policy/global-status
 * 
 * Returns current global guardrail status for display in GuardrailBanner.
 * Story 3.7: Créer le composant GuardrailBanner pour état global
 */

import { NextResponse } from 'next/server';
import type { GlobalGuardrailState, GuardrailApiResponse, GuardrailApiError } from '@/features/policy/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/v1/policy/global-status
 * 
 * Returns current global guardrail status including:
 * - status: HEALTHY | WARNING | HARD_STOP
 * - cause: Reason for the current status
 * - recommendedAction: What action to take
 * - updatedAt: When status was last updated
 * - expiresAt: When status expires (if applicable)
 * 
 * AC1: Affichage du statut global
 * AC2: Affichage de la cause et action recommandée
 */
export async function GET(): Promise<NextResponse<GuardrailApiResponse | GuardrailApiError>> {
  const traceId = uuidv4();
  
  try {
    // TODO: In production, fetch from actual policy engine
    // For MVP: Return mock data based on current system state
    // This would typically query the policy service for active constraints
    
    const status: GlobalGuardrailState = await getCurrentGuardrailState();

    const response: GuardrailApiResponse = {
      data: status,
      meta: {
        traceId,
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    void error;

    const errorResponse: GuardrailApiError = {
      error: {
        code: 'GUARDRAIL_FETCH_ERROR',
        message: 'Failed to retrieve guardrail status',
      },
      meta: { traceId },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Get current guardrail state
 * In production, this would query the policy engine
 * For MVP, returns HEALTHY by default
 */
async function getCurrentGuardrailState(): Promise<GlobalGuardrailState> {
  // TODO: Integrate with actual policy evaluation
  // This should query the hard-stop status, warning thresholds, etc.
  
  return {
    status: 'HEALTHY',
    cause: 'Tous les indicateurs sont dans les limites acceptables',
    recommendedAction: 'Vous pouvez consulter les recommandations normalement',
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}
