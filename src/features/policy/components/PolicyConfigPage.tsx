/**
 * PolicyConfigPage Component
 * Story 5.2: Interface admin de gestion des paramètres policy
 * 
 * Requirements:
 * - AC1: View and edit allowed parameters (edge, confidence, hard-stop limits)
 * - AC2: All configurable parameters grouped by category
 * - AC3: Validation against safe bounds with clear error messages
 * - AC4: Changes logged with timestamp, user, old/new values, reason
 * - AC5: RBAC - access denied for non-admin users
 * - Accessibility: WCAG 2.2 AA, keyboard navigation, touch targets >= 44x44px
 */

'use client';

import React, { useState } from 'react';
import { Shield, RefreshCw, AlertCircle, Clock, History, TrendingUp } from 'lucide-react';
import { usePolicyConfig } from '../hooks/usePolicyConfig';
import { PolicyParameterInput } from '../components/PolicyParameterInput';
import { PolicyVersionHistory } from './PolicyVersionHistory';
import { POLICY_CATEGORY_CONFIG } from '../types/config';

interface PolicyConfigPageProps {
  userRole?: string;
}

// Group parameters by category
function groupByCategory<T extends { category: string }>(items: T[]): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const category = item.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 animate-pulse"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
            </div>
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
}

// Error state
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="p-6 rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3 className="font-semibold text-red-800 dark:text-red-200">
            Erreur de chargement
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            {message}
          </p>
          <button
            onClick={onRetry}
            className={`
              mt-4 flex items-center gap-2 px-4 py-2 rounded-lg font-medium
              min-h-[44px]
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
              bg-red-600 hover:bg-red-700
              text-white
            `}
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>
        </div>
      </div>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="p-6 rounded-lg bg-gray-50 dark:bg-gray-800/50 border-2 border-gray-200 dark:border-gray-700">
      <div className="text-center">
        <Shield
          className="h-12 w-12 text-gray-400 mx-auto mb-3"
          aria-hidden="true"
        />
        <p className="text-gray-600 dark:text-gray-400">
          Aucun paramètre de policy disponible
        </p>
      </div>
    </div>
  );
}

export function PolicyConfigPage({ userRole = 'user' }: PolicyConfigPageProps) {
  const {
    state,
    parameters,
    error,
    lastSaved,
    adaptiveReport,
    refresh,
    updateParameter,
    validateValue,
    isLoading,
    isUpdating,
    isAdaptiveLoading,
  } = usePolicyConfig();

  // State for version history panel
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Check if user is admin
  const isAdmin = userRole === 'admin';
  const isOps = userRole === 'ops';

  // Group parameters by category
  const groupedParameters = groupByCategory(parameters);
  const categories = Object.keys(groupedParameters) as Array<keyof typeof POLICY_CATEGORY_CONFIG>;

  // Handle loading state
  if (state === 'loading' || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Configuration des Policies
          </h1>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  // Handle error state
  if (state === 'error' && error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Configuration des Policies
          </h1>
        </div>
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  // Handle empty state
  if (parameters.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Configuration des Policies
          </h1>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Configuration des Policies
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Gérez les paramètres de décision du système
            </p>
          </div>
        </div>

        {/* Last saved indicator */}
        {lastSaved && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Clock className="h-4 w-4" />
            <span>
              Dernière modification: {lastSaved.toLocaleString('fr-FR')}
            </span>
          </div>
        )}

        {/* Version history toggle button */}
        <button
          onClick={() => setShowVersionHistory(!showVersionHistory)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium
            min-h-[44px]
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${showVersionHistory 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}
          `}
          aria-expanded={showVersionHistory}
        >
          <History className="h-4 w-4" />
          <span>{showVersionHistory ? 'Masquer l\'historique' : 'Voir l\'historique'}</span>
        </button>
      </div>

      {/* Version History Panel */}
      {showVersionHistory && (
        <div className="mt-6">
          <PolicyVersionHistory onVersionRestored={refresh} />
        </div>
      )}

      {/* RBAC Notice for non-admin */}
      {!isAdmin && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Accès en lecture seule
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                {isOps
                  ? 'En tant qu\'ops, vous pouvez voir les paramètres mais ne pouvez pas les modifier.'
                  : 'Seuls les administrateurs peuvent modifier les paramètres de policy.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Adaptive threshold transparency */}
      <section
        aria-labelledby="adaptive-thresholds-heading"
        className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="adaptive-thresholds-heading" className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" aria-hidden="true" />
              Calibration adaptive des seuils
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Recommandations calculées automatiquement sur les résultats résolus récents.
            </p>
          </div>
          {isAdaptiveLoading && (
            <span className="text-xs text-gray-500 dark:text-gray-400">Chargement...</span>
          )}
        </div>

        {adaptiveReport ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3">
              <p className="text-gray-500 dark:text-gray-400">Seuils actifs</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Confiance {adaptiveReport.current.confidenceMinThreshold.toFixed(2)} - Edge {adaptiveReport.current.edgeMinThreshold.toFixed(2)}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3">
              <p className="text-gray-500 dark:text-gray-400">Recommandation ({adaptiveReport.lookbackDays} jours)</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {adaptiveReport.recommendation.applied && adaptiveReport.recommendation.overrides
                  ? `Confiance ${adaptiveReport.recommendation.overrides.confidence.minThreshold.toFixed(2)} - Edge ${adaptiveReport.recommendation.overrides.edge.minThreshold.toFixed(2)}`
                  : `Non appliquable (${adaptiveReport.recommendation.reason || 'no_candidate'})`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Samples: {adaptiveReport.recommendation.sampleSize}, selections: {adaptiveReport.recommendation.selectedCount}, precision: {(adaptiveReport.recommendation.precision * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-3 md:col-span-2">
              <p className="text-gray-500 dark:text-gray-400">Dernier snapshot adaptatif</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {adaptiveReport.latestAppliedSnapshot
                  ? `v${adaptiveReport.latestAppliedSnapshot.version} - ${new Date(adaptiveReport.latestAppliedSnapshot.createdAt).toLocaleString('fr-FR')} - ${adaptiveReport.latestAppliedSnapshot.createdBy}`
                  : 'Aucun snapshot adaptatif persisté'}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Rapport adaptatif indisponible.
          </p>
        )}
      </section>

      {/* Parameters by category */}
      {categories.map((category) => {
        const categoryParams = groupedParameters[category];
        const categoryConfig = POLICY_CATEGORY_CONFIG[category];

        return (
          <section key={category} aria-labelledby={`category-${category}`}>
            <h2
              id={`category-${category}`}
              className={`
                text-lg font-semibold mb-3 pb-2 border-b
                ${categoryConfig.color}
              `}
            >
              {categoryConfig.label}
            </h2>
            <div className="space-y-4">
              {categoryParams.map((param) => (
                <PolicyParameterInput
                  key={param.key}
                  parameter={param}
                  onUpdate={updateParameter}
                  onValidate={validateValue}
                  isUpdating={isUpdating}
                  disabled={!isAdmin}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default PolicyConfigPage;
