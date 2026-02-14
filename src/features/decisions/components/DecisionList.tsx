/**
 * Decision List Component
 * Container for displaying a list of decisions
 * Story 3.2: Implement Picks view with today's decisions list
 */

'use client';

import { useState, useEffect } from 'react';
import { DecisionCard } from './DecisionCard';
import { DecisionCardSkeleton, DecisionListSkeleton } from './DecisionCardSkeleton';
import { useTodayDecisions, DecisionError } from '../hooks/useDecisions';
import type { Decision, DecisionStatus } from '../types';

interface DecisionListProps {
  initialData?: Decision[];
}

export function DecisionList({ initialData }: DecisionListProps) {
  const { data, isLoading, error, refetch } = useTodayDecisions();
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  // Log errors with traceId for debugging (AC6)
  useEffect(() => {
    if (error) {
      const traceId = error instanceof DecisionError ? error.traceId : 'unknown';
      const code = error instanceof DecisionError ? error.code : 'UNKNOWN';
      console.error('[DecisionList] Error loading decisions:', {
        traceId,
        code,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }, [error]);

  // Use initial data if provided (Server Component hydration)
  const decisions = data?.data || initialData || [];

  // Loading state
  if (isLoading && !initialData) {
    return <DecisionListSkeleton count={6} />;
  }

  // Error state
  if (error) {
    return (
      <div 
        className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20"
        role="alert"
        aria-live="polite"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg
            className="h-6 w-6 text-red-600 dark:text-red-400"
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
        </div>
        <h3 className="text-lg font-medium text-red-900 dark:text-red-200">
          Erreur de chargement
        </h3>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error.message || "Impossible de charger les décisions."}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
          aria-label="Réessayer de charger les décisions"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Réessayer
        </button>
      </div>
    );
  }

  // Empty state
  if (decisions.length === 0) {
    return (
      <div 
        className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
          <svg
            className="h-8 w-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Aucune décision disponible
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Il n&apos;y a pas encore de décisions pour aujourd&apos;hui.
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Revenez après le daily run (généralement le matin).
        </p>
        <div className="mt-6">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser
          </button>
        </div>
      </div>
    );
  }

  // Success state - display decision cards
  return (
    <div 
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      role="list"
      aria-label="Liste des décisions du jour"
      data-testid="decision-list"
    >
      {decisions.map((decision) => (
        <DecisionCard
          key={decision.id}
          decision={decision}
          onClick={setSelectedDecision}
          className="h-full"
        />
      ))}
    </div>
  );
}

interface DecisionStatusFilterProps {
  selectedStatus: DecisionStatus | null;
  onStatusChange: (status: DecisionStatus | null) => void;
  counts: Record<DecisionStatus, number>;
}

export function DecisionStatusFilter({ selectedStatus, onStatusChange, counts }: DecisionStatusFilterProps) {
  const statuses: { value: DecisionStatus | null; label: string }[] = [
    { value: null, label: 'Tous' },
    { value: 'PICK', label: 'Pick' },
    { value: 'NO_BET', label: 'No-Bet' },
    { value: 'HARD_STOP', label: 'Hard-Stop' },
  ];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
      {statuses.map(({ value, label }) => {
        const count = value ? counts[value] || 0 : Object.values(counts).reduce((a, b) => a + b, 0);
        const isSelected = selectedStatus === value;
        
        return (
          <button
            key={label}
            onClick={() => onStatusChange(value)}
            className={`
              inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${isSelected
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }
            `}
            aria-pressed={isSelected}
            aria-label={`${label} (${count} décisions)`}
          >
            <span>{label}</span>
            <span 
              className={`
                rounded-full px-2 py-0.5 text-xs
                ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}
              `}
              aria-hidden="true"
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
