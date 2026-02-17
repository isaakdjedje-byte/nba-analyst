/**
 * ConfidenceEdgeSection Component
 * Story 3.5: Display confidence level details and edge calculation breakdown
 *
 * AC2: Complete detailed content
 * - Confidence level details with visual breakdown
 * - Edge calculation breakdown display
 */

'use client';

import React from 'react';
import type { DecisionDetail } from '../../types';

interface ConfidenceEdgeSectionProps {
  decision: DecisionDetail;
}

/**
 * Formats a decimal value as percentage string
 */
function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Displays confidence and edge breakdown section
 * AC2: Confidence level details and edge calculation
 */
export function ConfidenceEdgeSection({ decision }: ConfidenceEdgeSectionProps) {
  const { confidence, edge, confidenceBreakdown, edgeCalculation } = decision;

  const hasConfidenceBreakdown = confidenceBreakdown &&
    typeof confidenceBreakdown.mlConfidence === 'number';
  const hasEdgeCalculation = edgeCalculation &&
    typeof edgeCalculation.impliedProbability === 'number';

  return (
    <section
      aria-labelledby="confidence-edge-heading"
      className="space-y-4"
      data-testid="confidence-edge-section"
    >
      <h3
        id="confidence-edge-heading"
        className="text-sm font-semibold text-gray-900 dark:text-white"
      >
        Analyse Edge & Confiance
      </h3>

      {/* Confidence Breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Détails de confiance
        </h4>

        {hasConfidenceBreakdown ? (
          <div className="grid grid-cols-2 gap-3">
            {/* ML Confidence */}
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Confiance ML
              </span>
              <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                {formatPercent(confidenceBreakdown?.mlConfidence)}
              </span>
            </div>

            {/* Historical Accuracy */}
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Précision historique
              </span>
              <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                {formatPercent(confidenceBreakdown?.historicalAccuracy)}
              </span>
            </div>

            {/* Sample Size */}
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Taille échantillon
              </span>
              <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                {confidenceBreakdown?.sampleSize?.toLocaleString() ?? 'N/A'}
              </span>
            </div>

            {/* Adjusted Confidence */}
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Confiance ajustée
              </span>
              <span className="text-sm font-mono font-medium text-emerald-600 dark:text-emerald-400">
                {formatPercent(confidenceBreakdown?.adjustedConfidence)}
              </span>
            </div>
          </div>
        ) : (
          /* Fallback: Simple confidence display */
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${(confidence || 0) * 100}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="text-sm font-mono text-gray-700 dark:text-gray-300 min-w-[3ch]">
              {formatPercent(confidence)}
            </span>
          </div>
        )}
      </div>

      {/* Edge Calculation Breakdown */}
      <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Calcul Edge
        </h4>

        {hasEdgeCalculation ? (
          <div className="space-y-2">
            {/* Probability comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Probabilité implicite
                </span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {formatPercent(edgeCalculation?.impliedProbability)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Probabilité prédite
                </span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {formatPercent(edgeCalculation?.predictedProbability)}
                </span>
              </div>
            </div>

            {/* Odds comparison */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Cotes marché
                </span>
                <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {edgeCalculation?.marketOdds?.toFixed(2) ?? 'N/A'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Cotes justes
                </span>
                <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                  {edgeCalculation?.fairOdds?.toFixed(2) ?? 'N/A'}
                </span>
              </div>
            </div>

            {/* Final Edge */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Edge final
              </span>
              <span className={`text-lg font-mono font-semibold ${
                (edgeCalculation?.edge || 0) > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {(edgeCalculation?.edge || 0) > 0 ? '+' : ''}
                {((edgeCalculation?.edge || 0) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        ) : (
          /* Fallback: Simple edge display */
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Edge calculé</span>
            <span className={`text-lg font-mono font-semibold ${
              (edge || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'
            }`}>
              {(edge || 0) > 0 ? '+' : ''}{((edge || 0) * 100).toFixed(2)}%
            </span>
          </div>
        )}

        {/* Context explanation tooltip */}
        <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-2">
          L&apos;edge représente l&apos;avantage mathématique estimé par rapport aux cotes du marché.
        </p>
      </div>
    </section>
  );
}

export default ConfidenceEdgeSection;
