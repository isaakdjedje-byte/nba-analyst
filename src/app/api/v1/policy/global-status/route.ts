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
import { getHardStopStatus } from '@/jobs/daily-run-job';
import { requireOps } from '@/server/auth/server-rbac';
import { NextRequest } from 'next/server';

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
export async function GET(request: NextRequest): Promise<NextResponse<GuardrailApiResponse | GuardrailApiError>> {
  const traceId = uuidv4();
  
  try {
    const authResult = await requireOps(request);
    if (authResult.error) {
      return authResult.error as NextResponse<GuardrailApiResponse | GuardrailApiError>;
    }

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
 * Uses the persisted hard-stop state and thresholds.
 */
async function getCurrentGuardrailState(): Promise<GlobalGuardrailState> {
  const hardStopStatus = await getHardStopStatus();
  const now = new Date();

  if (hardStopStatus.isActive) {
    return {
      status: 'HARD_STOP',
      cause: hardStopStatus.triggerReason || 'Hard-stop actif',
      recommendedAction: hardStopStatus.recommendedAction,
      updatedAt: now.toISOString(),
    };
  }

  const dailyLossRatio = hardStopStatus.limits.dailyLossLimit > 0
    ? hardStopStatus.currentState.dailyLoss / hardStopStatus.limits.dailyLossLimit
    : 0;
  const consecutiveLossRatio = hardStopStatus.limits.consecutiveLosses > 0
    ? hardStopStatus.currentState.consecutiveLosses / hardStopStatus.limits.consecutiveLosses
    : 0;
  const bankrollRatio = hardStopStatus.limits.bankrollPercent > 0
    ? hardStopStatus.currentState.bankrollPercent / hardStopStatus.limits.bankrollPercent
    : 0;

  const riskRatio = Math.max(dailyLossRatio, consecutiveLossRatio, bankrollRatio);
  if (riskRatio >= 0.8) {
    return {
      status: 'WARNING',
      cause: 'Les limites de risque se rapprochent du seuil de blocage',
      recommendedAction: hardStopStatus.recommendedAction,
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    };
  }

  return {
    status: 'HEALTHY',
    cause: 'Tous les indicateurs sont dans les limites acceptables',
    recommendedAction: 'Vous pouvez consulter les recommandations normalement',
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}
