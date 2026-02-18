/**
 * Decision List Component
 * Container for displaying a list of decisions
 * Story 3.2: Implement Picks view with today's decisions list
 * Story 3.8: Mobile-first responsive with virtual scrolling (AC6)
 * 
 * AC6: Virtual scrolling pour listes > 20 éléments
 * AC4: Performance de chargement mobile (60fps)
 * AC1: Parcours mobile optimisé (< 2 minutes)
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DecisionCard } from './DecisionCard';
import { DecisionListSkeleton } from './DecisionCardSkeleton';
import { useTodayDecisions, useDecisionsByStatus, DecisionError } from '../hooks/useDecisions';
import { EmptyPicksState, DegradedStateBanner, BlockedState } from '@/components/ui';
import type { Decision, DecisionStatus } from '../types';

interface DecisionListProps {
  initialData?: Decision[];
  filterStatuses?: DecisionStatus[];
}

// AC6: Hauteur estimée d'une carte sur mobile
const ESTIMATED_ITEM_SIZE = 140;

export function DecisionList({ initialData, filterStatuses }: DecisionListProps) {
  const singleStatus = filterStatuses && filterStatuses.length === 1 ? filterStatuses[0] : null;
  const singleStatusQuery = useDecisionsByStatus(singleStatus ?? 'PICK', Boolean(singleStatus));
  const allStatusesQuery = useTodayDecisions(!singleStatus);
  const queryResult = singleStatus ? singleStatusQuery : allStatusesQuery;
  const { data, isLoading, error, refetch } = queryResult;
  const handleDecisionClick = useCallback(() => {}, []);

  // Log errors with traceId for debugging (AC6)
  useEffect(() => {
    if (error) {
      const traceId = error instanceof DecisionError ? error.traceId : 'unknown';
      const code = error instanceof DecisionError ? error.code : 'UNKNOWN';
      console.error('[DecisionList] Error loading decisions:', {
        traceId,
        code,
        message: error.message || 'No error message',
        errorObject: error,
        timestamp: new Date().toISOString(),
      });
      
      // Also log data state for debugging
      console.log('[DecisionList] Data state:', { data, isLoading });
    }
  }, [error, data, isLoading]);

  // Use initial data when query returns an empty array to avoid blank client overwrite
  const fetchedDecisions = data?.data;
  const baseDecisions = fetchedDecisions && fetchedDecisions.length > 0
    ? fetchedDecisions
    : (initialData ?? fetchedDecisions ?? []);
  const decisions = filterStatuses && filterStatuses.length > 0
    ? baseDecisions.filter((decision) => filterStatuses.includes(decision.status))
    : baseDecisions;
  const meta = data?.meta;

  // AC3: Degraded state check
  const isDegraded = meta?.degraded === true;
  const degradedReason = meta?.degradedReason;

  // AC4: Blocked state check
  const isBlocked = meta?.blocked === true;
  const blockedReason = meta?.blockedReason;
  const blockedAction = meta?.recommendedAction;

  // AC6: Virtual scrolling pour listes > 20 éléments
  // Story 3.8: Fixed ref pattern - use proper React ref (HIGH-3 fix)
  const parentRef = useRef<HTMLDivElement>(null);

  // Virtualizer uniquement si > 20 items (AC6)
  const shouldVirtualize = decisions.length > 20;

  const virtualizer = useVirtualizer({
    count: decisions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ITEM_SIZE,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Loading state
  if (isLoading && !initialData) {
    return <DecisionListSkeleton count={6} />;
  }

  // Error state
  if (error) {
    return (
      <div 
        className="rounded-lg border border-red-200 bg-red-50 p-4 sm:p-6 text-center dark:border-red-800 dark:bg-red-900/20"
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
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 min-h-[44px]"
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

  // AC4: Blocked state - Hard-stop with 100% enforcement
  if (isBlocked && blockedReason) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <BlockedState
          reason={blockedReason}
          recommendedAction={blockedAction || 'Attendre la résolution du blocage'}
        />
      </div>
    );
  }

  // AC3: Degraded state banner
  const degradedBanner = isDegraded && degradedReason ? (
    <div className="mb-4">
      <DegradedStateBanner
        reason={degradedReason}
        retry={() => refetch()}
      />
    </div>
  ) : null;

  // Empty state - AC2: Empty states explicites avec actions suggerees
  if (decisions.length === 0 && !isDegraded) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <EmptyPicksState />
      </div>
    );
  }

  // Empty state avec degradation
  if (decisions.length === 0 && isDegraded) {
    return (
      <div className="space-y-4">
        {degradedBanner}
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <EmptyPicksState />
        </div>
      </div>
    );
  }

  // AC6: Virtual scrolling pour listes > 20 éléments
  if (shouldVirtualize) {
    return (
      <>
        {degradedBanner}
        <div
          ref={parentRef}
          className="h-[calc(100vh-280px)] overflow-auto -mx-3 px-3 sm:-mx-4 sm:px-4"
          role="list"
          aria-label="Liste des décisions du jour"
          data-testid="decision-list-virtual"
        >
          <div style={{ height: totalSize, position: 'relative' }}>
            {virtualItems.map((virtualItem) => (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="pb-3 sm:pb-4"
              >
                <DecisionCard
                  decision={decisions[virtualItem.index]}
                  onClick={handleDecisionClick}
                  className="h-full"
                />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  // Standard list for small datasets (< 20 items)
  return (
    <>
      {degradedBanner}
      <div 
        className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label="Liste des décisions du jour"
        data-testid="decision-list"
      >
        {decisions.map((decision) => (
          <DecisionCard
            key={decision.id}
            decision={decision}
            onClick={handleDecisionClick}
            className="h-full"
          />
        ))}
      </div>
    </>
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
              inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              min-h-[44px]
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

export default DecisionList;
