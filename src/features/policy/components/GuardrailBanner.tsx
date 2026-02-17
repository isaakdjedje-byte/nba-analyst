/**
 * GuardrailBanner Component
 * Story 3.7: Créer le composant GuardrailBanner pour état global
 * 
 * Requirements:
 * - AC1: Affichage du statut global (HEALTHY/WARNING/HARD_STOP)
 * - AC2: Affichage de la cause et action recommandée
 * - AC3: Persistance non-intrusive (sticky ou inline)
 * - AC4: Variantes de positionnement (sticky/inline)
 * - AC5: États sémantiques stricts
 * - AC6: Conformité accessibilité WCAG AA
 * - AC7: Intégration Dashboard
 * - AC8: Cohérence avec StatusBadge (mêmes couleurs)
 * 
 * ARIA: role="alert" + aria-live="assertive" for WARNING/HARD_STOP
 *       role="status" + aria-live="polite" for HEALTHY
 */

'use client';

import React from 'react';
import { CheckCircle, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { 
  GUARDRAIL_STATUS_CONFIG, 
  type GuardrailStatus, 
  type GuardrailBannerProps,
  validateGuardrailStatus 
} from '../types';

const ICON_MAP = {
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
};

// Static class mappings for Tailwind JIT compatibility
const bgClassMap: Record<GuardrailStatus, { light: string; dark: string }> = {
  HEALTHY: { light: 'bg-emerald-50', dark: 'dark:bg-emerald-900/20' },
  WARNING: { light: 'bg-amber-50', dark: 'dark:bg-amber-900/20' },
  HARD_STOP: { light: 'bg-orange-50', dark: 'dark:bg-orange-900/20' },
};

const borderClassMap: Record<GuardrailStatus, { light: string; dark: string }> = {
  HEALTHY: { light: 'border-emerald-200', dark: 'dark:border-emerald-800' },
  WARNING: { light: 'border-amber-200', dark: 'dark:border-amber-800' },
  HARD_STOP: { light: 'border-orange-200', dark: 'dark:border-orange-800' },
};

const textClassMap: Record<GuardrailStatus, { light: string; dark: string }> = {
  HEALTHY: { light: 'text-emerald-800', dark: 'dark:text-emerald-200' },
  WARNING: { light: 'text-amber-800', dark: 'dark:text-amber-200' },
  HARD_STOP: { light: 'text-orange-800', dark: 'dark:text-orange-200' },
};

/**
 * Get ARIA props based on status severity
 * AC6: role="alert" for WARNING/HARD_STOP, role="status" for HEALTHY
 */
function getAriaProps(status: GuardrailStatus): {
  role: 'alert' | 'status';
  'aria-live': 'assertive' | 'polite';
} {
  if (status === 'WARNING' || status === 'HARD_STOP') {
    return {
      role: 'alert',
      'aria-live': 'assertive',
    };
  }
  return {
    role: 'status',
    'aria-live': 'polite',
  };
}

export function GuardrailBanner({
  status,
  variant = 'sticky',
  dismissible = false,
  onDismiss,
}: GuardrailBannerProps) {
  // Runtime validation for strict status enforcement (AC5)
  validateGuardrailStatus(status);

  const config = GUARDRAIL_STATUS_CONFIG[status];
  const Icon = ICON_MAP[config.icon];
  const ariaProps = getAriaProps(status);

  // Static class mappings for Tailwind JIT compatibility
  const bgClasses = bgClassMap[status];
  const borderClasses = borderClassMap[status];
  const textClasses = textClassMap[status];

  const baseClasses = `
    w-full border-b px-4 py-3
    ${variant === 'sticky' ? 'sticky top-0 z-40' : ''}
    ${bgClasses.light} ${bgClasses.dark}
    ${borderClasses.light} ${borderClasses.dark}
  `;

  return (
    <div
      {...ariaProps}
      aria-label={`Statut global: ${config.label}`}
      className={baseClasses}
      data-testid="guardrail-banner"
      data-status={status}
      data-variant={variant}
    >
      <div className="mx-auto max-w-7xl flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            style={{ color: config.color }}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm ${textClasses.light} ${textClasses.dark}`}>
              {config.label}
            </h3>
            <p className={`text-sm mt-1 ${textClasses.light} ${textClasses.dark} opacity-90`}>
              {config.causeExample} • {config.actionExample}
            </p>
          </div>
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className={`
              flex-shrink-0 p-2 rounded min-h-[44px] min-w-[44px]
              hover:bg-black/5 dark:hover:bg-white/10
              focus:outline-none focus:ring-2 focus:ring-offset-1
              focus:ring-current transition-colors
            `}
            aria-label="Masquer le bandeau"
            type="button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export default GuardrailBanner;
