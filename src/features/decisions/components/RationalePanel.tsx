/**
 * RationalePanel Component
 * Story 3.4: Implementer le RationalePanel avec justification courte
 * 
 * Displays a brief explanation for each decision with:
 * - Edge and confidence contextualization (AC2)
 * - Gate outcomes visualization (AC3)
 * - Error states for missing data (AC9)
 * - Embedded and detailed variants (AC6)
 * - Full accessibility support (AC7)
 * - Dark mode coherence (AC8)
 */

'use client';

import type { ReactElement } from 'react';
import type { Decision, GateOutcome } from '../types';

// =============================================================================
// INTERFACES
// =============================================================================

export interface RationalePanelProps {
  decision: Decision;
  variant?: 'embedded' | 'detailed';
  isExpanded?: boolean;
  className?: string;
}

interface GateIndicatorProps {
  gate: GateOutcome & { description?: string };
  size?: 'sm' | 'md';
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get contextual explanation for edge and confidence based on decision status
 * AC2: Explication Edge et Confiance
 */
function getRationaleContext(decision: Decision): string {
  const edgePercent = decision.edge !== null ? `${Math.round(decision.edge * 100)}%` : 'N/A';
  const confidencePercent = Math.round(decision.confidence * 100);

  switch (decision.status) {
    case 'PICK':
      return `Edge de ${edgePercent} avec confiance à ${confidencePercent}%. Opportunité validée par les règles de policy.`;
    case 'NO_BET':
      return decision.edge !== null 
        ? `Edge insuffisant (${edgePercent}) ou confiance trop faible (${confidencePercent}%). Abstention recommandée.`
        : `Edge non disponible, confiance à ${confidencePercent}%. Abstention recommandée.`;
    case 'HARD_STOP':
      return decision.hardStopReason || 'Blocage policy actif. Consultez les détails pour plus d\'informations.';
    default:
      return '';
  }
}

/**
 * Check if rationale data is available
 * AC9: Etat Donnees Manquantes
 */
function hasRationaleData(decision: Decision): boolean {
  return Boolean(decision.rationale && decision.rationale.trim().length > 0);
}

// =============================================================================
// SUB-COMPONENT: GateIndicator
// =============================================================================

/**
 * Displays a single gate status indicator
 * AC3: Affichage des Gates Pertinents
 */
function GateIndicator({ gate, size = 'md' }: GateIndicatorProps): ReactElement {
  const baseClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-xs'
    : 'px-2 py-1 text-sm';

  const statusClasses = gate.passed
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';

  const icon = gate.passed ? '✓' : '✗';

  return (
    <span
      data-testid={`gate-indicator-${gate.name}`}
      className={`inline-flex items-center gap-1 rounded ${baseClasses} ${statusClasses}`}
      title={gate.description}
      aria-label={`${gate.name}: ${gate.passed ? 'passé' : 'échoué'}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{gate.name}</span>
    </span>
  );
}

// =============================================================================
// MAIN COMPONENT: RationalePanel
// =============================================================================

/**
 * RationalePanel - Displays decision rationale with gates visualization
 * 
 * Features:
 * - AC1: Justification visible by default (concise view)
 * - AC2: Edge and confidence contextualization
 * - AC3: Gate outcomes visualization
 * - AC6: Embedded and detailed variants
 * - AC7: Full accessibility (ARIA attributes, semantic HTML)
 * - AC8: Dark mode coherence
 * - AC9: Error states for missing data
 */
export function RationalePanel({
  decision,
  variant = 'embedded',
  isExpanded = false,
  className = '',
}: RationalePanelProps): ReactElement {
  // Determine if we have valid rationale data
  const hasRationale = hasRationaleData(decision);
  const hasGates = decision.gates && decision.gates.length > 0;

  // Get contextual explanation
  const contextText = getRationaleContext(decision);

  // Embedded variant classes (default for DecisionCard inline display)
  const embeddedClasses = 'mt-2 space-y-2';
  const detailedClasses = 'p-4 space-y-4 bg-slate-50 dark:bg-slate-800 rounded-lg';

  const containerClasses = variant === 'embedded' ? embeddedClasses : detailedClasses;

  // Error state (AC9: Etat Donnees Manquantes)
  if (!hasRationale) {
    return (
      <section
        data-testid="rationale-panel"
        aria-labelledby={`rationale-title-${decision.id}`}
        className={`${containerClasses} ${className}`}
      >
        <h4 id={`rationale-title-${decision.id}`} className="sr-only">
          Justification pour {decision.match.homeTeam} contre {decision.match.awayTeam}
        </h4>
        <div className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-400">
          <svg
            data-testid="alert-icon"
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>Données de justification indisponibles</span>
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="rationale-panel"
      aria-labelledby={`rationale-title-${decision.id}`}
      className={`${containerClasses} ${className}`}
    >
      {/* AC7: Accessible title for screen readers */}
      <h4 id={`rationale-title-${decision.id}`} className="sr-only">
        Justification pour {decision.match.homeTeam} contre {decision.match.awayTeam}
      </h4>

      {/* AC1: Rationale text display */}
      {/* AC4: Line-clamp for mobile (2-3 lines max) */}
      <div data-testid="rationale-content">
        <p
          className={`
            text-base text-slate-700 dark:text-slate-300
            ${isExpanded ? '' : 'line-clamp-2'}
          `}
          title={decision.rationale}
        >
          {decision.rationale}
        </p>
      </div>

      {/* AC2: Contextual explanation */}
      <p className="text-sm text-slate-600 dark:text-slate-400 italic">
        {contextText}
      </p>

      {/* AC3: Gates visualization */}
      {hasGates ? (
        <div data-testid="gates-section">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
            Validations policy
          </p>
          {/* AC4: Mobile optimization - limit to 3 gates with overflow indicator */}
          <ul
            aria-label="Validations policy"
            className="flex flex-wrap gap-1.5"
          >
            {decision.gates?.slice(0, 3).map((gate) => (
              <li key={gate.name}>
                <GateIndicator gate={gate} size="sm" />
              </li>
            ))}
            {decision.gates && decision.gates.length > 3 && (
              <li
                className="text-xs text-slate-500 dark:text-slate-400 px-1.5 py-0.5"
                aria-label={`${decision.gates.length - 3} validations supplémentaires`}
              >
                +{decision.gates.length - 3}
              </li>
            )}
          </ul>
        </div>
      ) : (
        // AC9: Handle missing gates data gracefully
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Informations de validation non disponibles
        </p>
      )}
    </section>
  );
}

export { GateIndicator };
export default RationalePanel;
