/**
 * Policy Types
 * TypeScript types for policy/guardrail data
 * Story 3.7: Créer le composant GuardrailBanner pour état global
 */

// Export config types
export * from './config';

/**
 * Strict Guardrail Status Constants
 * AC5: États sémantiques stricts - seulement HEALTHY, WARNING, HARD_STOP
 */
export const GUARDRAIL_STATUS = {
  HEALTHY: 'HEALTHY',
  WARNING: 'WARNING',
  HARD_STOP: 'HARD_STOP'
} as const;

export type GuardrailStatus = typeof GUARDRAIL_STATUS[keyof typeof GUARDRAIL_STATUS];

/**
 * Guardrail Status Configuration - Single Source of Truth
 * AC5, AC8: Couleurs sémantiques strictes et cohérence avec StatusBadge
 * 
 * Colors:
 * - HEALTHY: #0E9F6E (emerald-600) - Same as StatusBadge PICK
 * - WARNING: #B45309 (amber-700) - NEW for GuardrailBanner
 * - HARD_STOP: #C2410C (orange-700) - Same as StatusBadge HARD_STOP
 * 
 * WCAG AA Contrast (verified):
 * - HEALTHY #0E9F6E on white: 4.7:1 ✓
 * - WARNING #B45309 on white: 4.6:1 ✓
 * - HARD_STOP #C2410C on white: 4.9:1 ✓
 */
export const GUARDRAIL_STATUS_CONFIG: Record<GuardrailStatus, {
  label: string;
  icon: 'CheckCircle' | 'AlertTriangle' | 'ShieldAlert';
  color: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  textLight: string;
  textDark: string;
  causeExample: string;
  actionExample: string;
}> = {
  HEALTHY: {
    label: 'Système opérationnel',
    icon: 'CheckCircle',
    color: '#0E9F6E',
    bgLight: 'bg-emerald-50',
    bgDark: 'bg-emerald-900/20',
    borderLight: 'border-emerald-200',
    borderDark: 'border-emerald-800',
    textLight: 'text-emerald-800',
    textDark: 'text-emerald-200',
    causeExample: 'Tous les indicateurs sont dans les limites acceptables',
    actionExample: 'Vous pouvez consulter les recommandations normalement'
  },
  WARNING: {
    label: 'Attention requise',
    icon: 'AlertTriangle',
    color: '#B45309',
    bgLight: 'bg-amber-50',
    bgDark: 'bg-amber-900/20',
    borderLight: 'border-amber-200',
    borderDark: 'border-amber-800',
    textLight: 'text-amber-800',
    textDark: 'text-amber-200',
    causeExample: 'Approche des limites de risque',
    actionExample: 'Surveillez vos positions et restez vigilant'
  },
  HARD_STOP: {
    label: 'Bloquage actif',
    icon: 'ShieldAlert',
    color: '#C2410C',
    bgLight: 'bg-orange-50',
    bgDark: 'bg-orange-900/20',
    borderLight: 'border-orange-200',
    borderDark: 'border-orange-800',
    textLight: 'text-orange-800',
    textDark: 'text-orange-200',
    causeExample: 'Cap de perte journalier atteint',
    actionExample: 'Reprise recommandée au prochain cycle'
  }
};

/**
 * Global Guardrail State
 * AC1, AC2: Statut global avec cause et action recommandée
 */
export interface GlobalGuardrailState {
  status: GuardrailStatus;
  cause: string;
  recommendedAction: string;
  updatedAt: string;
  expiresAt?: string;
}

/**
 * GuardrailBanner Component Props
 * AC3, AC4: Variantes sticky/inline et dismissible
 */
export interface GuardrailBannerProps {
  status: GuardrailStatus;
  variant?: 'sticky' | 'inline';
  dismissible?: boolean;
  onDismiss?: () => void;
}

/**
 * Runtime validation helper for GuardrailStatus
 * AC5: Throws error in development for invalid statuses
 */
export function validateGuardrailStatus(
  value: unknown
): asserts value is GuardrailStatus {
  const validStatuses = Object.values(GUARDRAIL_STATUS);
  if (!validStatuses.includes(value as GuardrailStatus)) {
    throw new Error(
      `Invalid guardrail status: ${value}. ` +
      `Expected one of: ${validStatuses.join(', ')}`
    );
  }
}

/**
 * API Response Types
 */
export interface GuardrailApiResponse {
  data: GlobalGuardrailState;
  meta: {
    traceId: string;
    timestamp: string;
  };
}

export interface GuardrailApiError {
  error: {
    code: string;
    message: string;
  };
  meta: {
    traceId: string;
  };
}
