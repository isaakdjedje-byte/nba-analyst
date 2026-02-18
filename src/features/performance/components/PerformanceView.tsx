/**
 * PerformanceView Component
 * Story 4.1: Creer la vue Performance avec historique des recommandations
 * 
 * Displays aggregated performance metrics with date range filtering
 * WCAG 2.2 AA compliant - keyboard accessible, screen reader friendly
 */

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { DateRangePicker } from '../components/DateRangePicker';
import { usePerformanceMetrics } from '../hooks/usePerformanceMetrics';
import type { PerformanceMetrics } from '../types';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Skeleton component for loading state
function PerformanceMetricsSkeleton() {
  return (
      <div 
        className="grid grid-cols-2 lg:grid-cols-6 gap-4"
        data-testid="performance-metrics-skeleton"
      >
        {[...Array(6)].map((_, i) => (
        <div 
          key={i}
          className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
        >
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
}

// Empty state when no data
function EmptyPerformanceMetrics({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  return (
    <div 
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center"
      data-testid="performance-empty-state"
    >
      <TrendingUp className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Aucune donnée de performance
      </h3>
      <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
        Les statistiques de performance ne sont pas disponibles pour la periode du {fromDate} au {toDate}.
        Les donnees s&apos;accumuleront apres plusieurs jours d&apos;utilisation.
      </p>
    </div>
  );
}

// Error state
function ErrorPerformanceMetrics({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div 
      className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6"
      data-testid="performance-error-state"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            Erreur de chargement
          </h3>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {message}
          </p>
          <button
            onClick={onRetry}
            className="mt-3 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Réessayer
          </button>
        </div>
      </div>
    </div>
  );
}

export function PerformanceView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Default date range: last 30 days
  const defaultFromDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return formatLocalDate(date);
  }, []);

  const defaultToDate = useMemo(() => {
    return formatLocalDate(new Date());
  }, []);

  // AC4: Get dates from URL params for bookmarking/sharing
  const fromDateParam = searchParams.get('fromDate');
  const toDateParam = searchParams.get('toDate');
  
  const [fromDate, setFromDate] = useState(fromDateParam || defaultFromDate);
  const [toDate, setToDate] = useState(toDateParam || defaultToDate);

  // Sync state with URL params on mount
  useEffect(() => {
    if (fromDateParam) setFromDate(fromDateParam);
    if (toDateParam) setToDate(toDateParam);
  }, [fromDateParam, toDateParam]);

  const handleDateChange = useCallback((newFromDate: string, newToDate: string) => {
    setFromDate(newFromDate);
    setToDate(newToDate);
    
    // AC4: Update URL for bookmarking/sharing
    const params = new URLSearchParams(searchParams.toString());
    params.set('fromDate', newFromDate);
    params.set('toDate', newToDate);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const { data, isLoading, isError, error, refetch } = usePerformanceMetrics({
    fromDate,
    toDate,
  });

  const metrics: PerformanceMetrics | null = data?.data ?? null;

  return (
    <div data-testid="performance-view">
      {/* Date Range Filter */}
      <div className="mb-6">
        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onDateChange={handleDateChange}
          testId="performance-date-range"
        />
      </div>

      {/* Metrics Display */}
      {isLoading && <PerformanceMetricsSkeleton />}
      
      {isError && (
        <ErrorPerformanceMetrics 
          message={error instanceof Error ? error.message : 'Une erreur est survenue'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && metrics && metrics.totalDecisions === 0 && (
        <EmptyPerformanceMetrics fromDate={fromDate} toDate={toDate} />
      )}

      {!isLoading && !isError && metrics && metrics.totalDecisions > 0 && (
        <div 
          className="grid grid-cols-2 lg:grid-cols-6 gap-4"
          role="list"
          aria-label="Métriques de performance"
        >
          <div role="listitem">
            <MetricCard
              label="Win Rate (PICK résolus)"
              value={metrics.pickWinRate ?? 'N/A'}
              suffix={metrics.pickWinRate !== null ? '%' : undefined}
              tooltip="Taux de réussite réel sur les picks dont le résultat est connu"
              testId="metric-accuracy"
              variant="success"
            />
          </div>
          <div role="listitem">
            <MetricCard
              label="Picks"
              value={metrics.picksCount}
              tooltip="Nombre de recommandations de pari validées"
              testId="metric-picks"
            />
          </div>
          <div role="listitem">
            <MetricCard
              label="No-Bet"
              value={metrics.noBetCount}
              tooltip="Nombre de décisions où le système a recommandé de ne pas parier"
              testId="metric-no-bet"
              variant="warning"
            />
          </div>
          <div role="listitem">
            <MetricCard
              label="Hard-Stop"
              value={metrics.hardStopCount}
              tooltip="Nombre de décisions bloquées par les limites de risque"
              testId="metric-hard-stop"
              variant="error"
            />
          </div>
          <div role="listitem">
            <MetricCard
              label="Picks résolus"
              value={metrics.resolvedPicksCount}
              tooltip="Nombre de picks avec issue connue (gagné/perdu)"
              testId="metric-resolved-picks"
            />
          </div>
          <div role="listitem">
            <MetricCard
              label="Picks en attente"
              value={metrics.pendingPicksCount}
              tooltip="Nombre de picks encore non résolus"
              testId="metric-pending-picks"
              variant="warning"
            />
          </div>
        </div>
      )}

      {/* Summary info */}
      {!isLoading && !isError && metrics && (
        <p 
          className="mt-4 text-sm text-gray-500 dark:text-gray-400"
          data-testid="performance-summary"
        >
          Total des décisions analysées: <strong>{metrics.totalDecisions}</strong> pour la période du {fromDate} au {toDate}
        </p>
      )}
    </div>
  );
}

export default PerformanceView;
