/**
 * DataSignalsSection Component
 * Story 3.5: Display data signals and ML model information
 *
 * AC4: Data signals section
 * - Source data signatures (odds sources, data freshness)
 * - ML model version display
 * - Data source reliability indicators
 */

'use client';

import React from 'react';
import type { DataSignals } from '../../types';

interface DataSignalsSectionProps {
  dataSignals?: DataSignals;
}

/**
 * Formats ISO timestamp to readable format
 */
function formatTimestamp(isoString: string | undefined): string {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}

/**
 * Gets reliability color based on score
 */
function getReliabilityColor(score: number): string {
  if (score >= 0.8) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 0.6) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Displays data signals section with sources and ML info
 * AC4: Complete data signals display
 */
export function DataSignalsSection({ dataSignals }: DataSignalsSectionProps) {
  // AC9: Handle missing data gracefully
  if (!dataSignals) {
    return (
      <section
        aria-labelledby="data-signals-heading"
        className="space-y-2"
        data-testid="data-signals-section"
      >
        <h3
          id="data-signals-heading"
          className="text-sm font-semibold text-gray-900 dark:text-white"
        >
          Signaux de données
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Informations de signaux de données non disponibles
        </p>
      </section>
    );
  }

  const { sources, mlModelVersion, trainingDate } = dataSignals;
  const hasSources = sources && sources.length > 0;

  return (
    <section
      aria-labelledby="data-signals-heading"
      className="space-y-4"
      data-testid="data-signals-section"
    >
      <h3
        id="data-signals-heading"
        className="text-sm font-semibold text-gray-900 dark:text-white"
      >
        Signaux de données
      </h3>

      {/* ML Model Information */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 space-y-2">
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Modèle ML
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 dark:text-gray-400">Version</span>
            <span className="text-sm font-mono text-gray-900 dark:text-white">
              {mlModelVersion || 'N/A'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 dark:text-gray-400">Entraîné le</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {formatTimestamp(trainingDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Data Sources */}
      {hasSources ? (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Sources de données
          </h4>
          <div className="space-y-2">
            {sources.map((source, index) => (
              <div
                key={`${source.name}-${index}`}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {source.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(source.freshness)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Fiabilité:
                  </span>
                  <span
                    className={`text-sm font-mono font-medium ${
                      getReliabilityColor(source.reliability)
                    }`}
                  >
                    {Math.round(source.reliability * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Aucune source de données disponible
        </p>
      )}
    </section>
  );
}

export default DataSignalsSection;
