/**
 * LogsView Component
 * Story 4.2: Implementer la vue Logs avec historique des decisions
 * 
 * Displays a list of decision logs with filtering and sorting controls
 * WCAG 2.2 AA compliant - keyboard accessible, screen reader friendly
 * 
 * Requirements:
 * - Chronological list of decisions (AC1)
 * - Filter by date range and status (AC4)
 * - Sort by newest/oldest (AC5)
 * - URL reflects filter state (AC4)
 * - Loading states with skeletons (AC2)
 * - Empty states with explanations (AC2)
 * - Mobile-first responsive
 * - Dark mode support
 * - Accessibility: keyboard nav, focus visible
 */

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, FileText, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import { LogEntryComponent } from './LogEntry';
import { DecisionTimeline } from './DecisionTimeline';
import { useLogs } from '../hooks/useLogs';
import type { LogEntry, LogSortField, LogSortOrder } from '../types';
import type { DecisionStatus } from '@/server/db/repositories/policy-decisions-repository';

// Status options for filter
const STATUS_OPTIONS: { value: DecisionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'PICK', label: 'PICK' },
  { value: 'NO_BET', label: 'No-Bet' },
  { value: 'HARD_STOP', label: 'Hard-Stop' },
];

// Sort options
const SORT_OPTIONS: { value: LogSortField; label: string }[] = [
  { value: 'matchDate', label: 'Date du match' },
  { value: 'executedAt', label: "Date d'exécution" },
];

// Session storage key for sort preference (AC5)
const SESSION_SORT_KEY = 'logs-sort-preference';

/**
 * Skeleton for loading state
 */
function LogsSkeleton() {
  return (
    <div className="space-y-4" data-testid="logs-skeleton">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-200 bg-white p-4 animate-pulse dark:bg-gray-800 dark:border-gray-700"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="mt-3 h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="mt-3 h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state when no logs match filters
 */
function EmptyLogsState({ fromDate, toDate, status }: { fromDate?: string; toDate?: string; status?: string }) {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 p-8 text-center"
      data-testid="logs-empty-state"
    >
      <FileText className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Aucune décision trouvée
      </h3>
      <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
        {fromDate || toDate || status ? (
          <>
            Aucune décision ne correspond aux filtres appliqués.
            {fromDate && toDate && ` Période: du ${fromDate} au ${toDate}.`}
            {status && status !== 'all' && ` Statut: ${status}.`}
            <br />
            Essayez de modifier vos filtres pour voir plus de résultats.
          </>
        ) : (
          "Aucune décision n'a encore été enregistrée. Les décisions apparaîtront ici une fois le pipeline exécuté."
        )}
      </p>
    </div>
  );
}

/**
 * Error state
 */
function ErrorLogsState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6"
      data-testid="logs-error-state"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            Erreur de chargement
          </h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {message}
          </p>
          <button
            onClick={onRetry}
            className="mt-3 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Réessayer
          </button>
        </div>
      </div>
    </div>
  );
}

export function LogsView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Default date range: last 30 days
  const defaultFromDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }, []);

  const defaultToDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // AC4: Get filter params from URL for bookmarking/sharing
  const fromDateParam = searchParams.get('fromDate');
  const toDateParam = searchParams.get('toDate');
  const statusParam = searchParams.get('status') as DecisionStatus | 'all' | null;
  const sortByParam = searchParams.get('sortBy') as LogSortField | null;
  const sortOrderParam = searchParams.get('sortOrder') as LogSortOrder | null;

  // State
  const [fromDate, setFromDate] = useState(fromDateParam || defaultFromDate);
  const [toDate, setToDate] = useState(toDateParam || defaultToDate);
  const [status, setStatus] = useState<DecisionStatus | 'all'>(statusParam || 'all');
  const [sortBy, setSortBy] = useState<LogSortField>(sortByParam || 'matchDate');
  const [sortOrder, setSortOrder] = useState<LogSortOrder>(sortOrderParam || 'desc');

  // Load sort preference from session storage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_SORT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.sortBy) setSortBy(parsed.sortBy);
        if (parsed.sortOrder) setSortOrder(parsed.sortOrder);
      }
    } catch {
      // Ignore session storage errors
    }
  }, []);

  // Sync state with URL params on mount
  useEffect(() => {
    if (fromDateParam) setFromDate(fromDateParam);
    if (toDateParam) setToDate(toDateParam);
    if (statusParam) setStatus(statusParam);
    if (sortByParam) setSortBy(sortByParam as LogSortField);
    if (sortOrderParam) setSortOrder(sortOrderParam as LogSortOrder);
  }, [fromDateParam, toDateParam, statusParam, sortByParam, sortOrderParam]);

  // Handle filter changes - update URL
  const handleFilterChange = useCallback((newFromDate: string, newToDate: string, newStatus: string) => {
    setFromDate(newFromDate);
    setToDate(newToDate);
    setStatus(newStatus as DecisionStatus | 'all');

    const params = new URLSearchParams(searchParams.toString());
    if (newFromDate) {
      params.set('fromDate', newFromDate);
    } else {
      params.delete('fromDate');
    }
    if (newToDate) {
      params.set('toDate', newToDate);
    } else {
      params.delete('toDate');
    }
    if (newStatus && newStatus !== 'all') {
      params.set('status', newStatus);
    } else {
      params.delete('status');
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Handle sort changes - update URL and session storage (AC5)
  const handleSortChange = useCallback((newSortBy: LogSortField, newSortOrder: LogSortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);

    // Persist to session storage (AC5)
    try {
      sessionStorage.setItem(SESSION_SORT_KEY, JSON.stringify({
        sortBy: newSortBy,
        sortOrder: newSortOrder,
      }));
    } catch {
      // Ignore session storage errors
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('sortBy', newSortBy);
    params.set('sortOrder', newSortOrder);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Fetch logs
  const { data, isLoading, isError, error, refetch } = useLogs({
    fromDate,
    toDate,
    status,
    sortBy,
    sortOrder,
  });

  const logs: LogEntry[] = data?.data ?? [];
  const meta = data?.meta;

  // State for timeline view (AC5)
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);

  // Handle log entry click (for future detail view)
  const handleLogClick = useCallback((entry: LogEntry) => {
    // Future: navigate to detail page
    console.log('Log clicked:', entry.id);
  }, []);

  // Handle timeline button click (AC5)
  const handleTimelineClick = useCallback((entry: LogEntry) => {
    setSelectedDecisionId(entry.id);
  }, []);

  // Handle back from timeline view (AC5)
  const handleTimelineBack = useCallback(() => {
    setSelectedDecisionId(null);
  }, []);

  return (
    <div data-testid="logs-view">
      {/* Filter Controls - AC4 */}
      <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Filtres
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* From Date */}
          <div>
            <label
              htmlFor="fromDate"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Date de début
            </label>
            <input
              type="date"
              id="fromDate"
              value={fromDate}
              onChange={(e) => handleFilterChange(e.target.value, toDate, status)}
              className="
                w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                dark:bg-gray-700 dark:border-gray-600 dark:text-white
                min-h-[44px]
              "
              data-testid="filter-from-date logs-date-from"
            />
          </div>

          {/* To Date */}
          <div>
            <label
              htmlFor="toDate"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Date de fin
            </label>
            <input
              type="date"
              id="toDate"
              value={toDate}
              onChange={(e) => handleFilterChange(fromDate, e.target.value, status)}
              className="
                w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                dark:bg-gray-700 dark:border-gray-600 dark:text-white
                min-h-[44px]
              "
              data-testid="filter-to-date logs-date-to"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Statut
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => handleFilterChange(fromDate, toDate, e.target.value)}
              className="
                w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                dark:bg-gray-700 dark:border-gray-600 dark:text-white
                min-h-[44px]
              "
              data-testid="filter-status logs-status-filter"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Controls - AC5 */}
          <div>
            <label
              id="sort-label"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Trier par
            </label>
            <div className="flex gap-2">
              <select
                aria-labelledby="sort-label"
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as LogSortField, sortOrder)}
                className="
                  flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  dark:bg-gray-700 dark:border-gray-600 dark:text-white
                  min-h-[44px]
                "
                data-testid="sort-by"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
                aria-label={sortOrder === 'asc' ? 'Trier du plus ancien au plus récent' : 'Trier du plus récent au plus ancien'}
                className="
                  px-3 py-2 border border-gray-300 rounded-md
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  dark:border-gray-600 dark:focus:ring-offset-gray-900
                  min-w-[44px] min-h-[44px]
                "
                data-testid="sort-order"
              >
                {sortOrder === 'asc' ? (
                  <ArrowUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State - AC2 */}
      {isLoading && <LogsSkeleton />}

      {/* Error State */}
      {isError && (
        <ErrorLogsState
          message={error instanceof Error ? error.message : 'Une erreur est survenue'}
          onRetry={() => refetch()}
        />
      )}

      {/* Empty State - AC2 */}
      {!isLoading && !isError && logs.length === 0 && (
        <EmptyLogsState fromDate={fromDate} toDate={toDate} status={status} />
      )}

      {/* Log Entries List */}
      {!isLoading && !isError && logs.length > 0 && (
        <div className="space-y-4" role="list" aria-label="Historique des décisions">
          {logs.map((entry) => (
            <div key={entry.id} role="listitem">
              <LogEntryComponent 
                entry={entry} 
                onClick={handleLogClick} 
                onTimelineClick={handleTimelineClick}
              />
            </div>
          ))}
        </div>
      )}

      {/* Timeline View (AC5) */}
      {selectedDecisionId && (
        <div className="mt-6">
          <DecisionTimeline 
            decisionId={selectedDecisionId} 
            onBack={handleTimelineBack}
          />
        </div>
      )}

      {/* Summary Info */}
      {!isLoading && !isError && meta && logs.length > 0 && (
        <p
          className="mt-4 text-sm text-gray-500 dark:text-gray-400"
          data-testid="logs-summary"
        >
          Affichage de <strong>{logs.length}</strong> décisions
          {meta.total > logs.length && <> sur {meta.total} au total</>}
          {fromDate && toDate && <> pour la période du {fromDate} au {toDate}</>}
        </p>
      )}
    </div>
  );
}

export default LogsView;
