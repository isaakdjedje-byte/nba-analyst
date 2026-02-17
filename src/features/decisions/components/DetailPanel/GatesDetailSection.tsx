/**
 * GatesDetailSection Component
 * Story 3.5: Display detailed gate outcomes with thresholds and actual values
 *
 * AC3: Detailed gate outcomes display
 * - Name, description, threshold value, actual value
 * - Pass/fail status with visual indicator
 * - Gates ordered by evaluation sequence
 */

'use client';

import React from 'react';
import type { GateOutcomeDetailed } from '../../types';

interface GatesDetailSectionProps {
  gates?: GateOutcomeDetailed[];
}

interface GateDetailRowProps {
  gate: GateOutcomeDetailed;
  sequence: number;
}

/**
 * Individual gate detail row
 * Shows gate name, threshold, actual value, and pass/fail status
 */
function GateDetailRow({ gate, sequence }: GateDetailRowProps) {
  const hasThreshold = gate.threshold !== undefined && gate.threshold !== null;
  const hasActual = gate.actual !== undefined && gate.actual !== null;

  return (
    <div
      className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
      data-testid={`gate-detail-${gate.name}`}
    >
      {/* Left: Sequence number and gate name */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span
          className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0"
          aria-hidden="true"
        >
          {sequence}.
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {gate.name}
          </span>
          {gate.description && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {gate.description}
            </span>
          )}
        </div>
      </div>

      {/* Right: Threshold, Actual, and Status */}
      <div className="flex items-center gap-3 text-sm flex-shrink-0">
        {/* Threshold value */}
        {hasThreshold && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Seuil: {typeof gate.threshold === 'number' ? gate.threshold.toFixed(2) : gate.threshold}
          </span>
        )}

        {/* Actual value */}
        {hasActual && (
          <span
            className={`font-medium ${
              gate.passed
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            Réel: {typeof gate.actual === 'number' ? gate.actual.toFixed(2) : gate.actual}
          </span>
        )}

        {/* Pass/Fail indicator */}
        <span
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
            ${gate.passed
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }
          `}
          aria-label={`${gate.name}: ${gate.passed ? 'passé' : 'échoué'}`}
        >
          <span aria-hidden="true">{gate.passed ? '✓' : '✗'}</span>
          <span>{gate.passed ? 'Passé' : 'Échoué'}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Displays detailed gate outcomes section
 * AC3: Complete gate details with evaluation sequence
 */
export function GatesDetailSection({ gates }: GatesDetailSectionProps) {
  // AC9: Handle missing or empty gates gracefully
  if (!gates || gates.length === 0) {
    return (
      <section
        aria-labelledby="gates-detail-heading"
        className="space-y-2"
        data-testid="gates-detail-section"
      >
        <h3
          id="gates-detail-heading"
          className="text-sm font-semibold text-gray-900 dark:text-white"
        >
          Validation Policy
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Informations de validation non disponibles
        </p>
      </section>
    );
  }

  // Count passed vs failed
  const passedCount = gates.filter(g => g.passed).length;
  const failedCount = gates.length - passedCount;

  return (
    <section
      aria-labelledby="gates-detail-heading"
      className="space-y-3"
      data-testid="gates-detail-section"
    >
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <h3
          id="gates-detail-heading"
          className="text-sm font-semibold text-gray-900 dark:text-white"
        >
          Validation Policy
        </h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-emerald-600 dark:text-emerald-400">
            {passedCount} passé{passedCount > 1 ? 's' : ''}
          </span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span className="text-red-600 dark:text-red-400">
            {failedCount} échoué{failedCount > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Gates list ordered by evaluation sequence */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
        {gates.map((gate, index) => (
          <GateDetailRow
            key={`${gate.name}-${index}`}
            gate={gate}
            sequence={index + 1}
          />
        ))}
      </div>

      {/* Evaluation order note */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Les portails sont évalués dans l&apos;ordre séquentiel affiché ci-dessus.
      </p>
    </section>
  );
}

export default GatesDetailSection;
