/**
 * InvestigationSearch Component
 * Story 4.4: Implementer l'investigation de decision contestee
 * 
 * Search interface for investigating contested decisions
 * Reuses patterns from Logs feature (story 4-2)
 * 
 * Requirements (AC1, AC2):
 * - AC1: Search by date + match + user with FR23
 * - AC2: Search filters include date range, match/team, user, decision status
 * 
 * WCAG 2.2 AA compliant
 * Mobile-first responsive
 * Dark mode support
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  Users, 
  Filter, 
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { DecisionStatus } from '@/server/db/repositories/policy-decisions-repository';
import type { InvestigationFilters, InvestigationResult } from '../types';

// Status options for filter
const STATUS_OPTIONS: { value: DecisionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'PICK', label: 'PICK' },
  { value: 'NO_BET', label: 'No-Bet' },
  { value: 'HARD_STOP', label: 'Hard-Stop' },
];

/**
 * InvestigationSearch Component Props
 */
interface InvestigationSearchProps {
  onSearch: (filters: InvestigationFilters) => void;
  onSelectDecision: (decisionId: string) => void;
  results?: InvestigationResult[];
  isLoading?: boolean;
  error?: Error | null;
  totalResults?: number;
}

/**
 * Skeleton for loading state (per story 3-9 UX patterns)
 */
function SearchResultsSkeleton() {
  return (
    <div className="space-y-3" data-testid="search-results-skeleton">
      {[1, 2, 3].map((i) => (
        <div 
          key={i}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="mt-3 h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="mt-2 h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state when no results found
 */
function EmptySearchState() {
  return (
    <div 
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center"
      data-testid="search-empty-state"
    >
      <Search className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Aucun résultat trouvé
      </h3>
      <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
        Essayez de modifier vos criteres de recherche ou d&apos;elargir la periode de dates.
      </p>
    </div>
  );
}

/**
 * Error state
 */
function SearchErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div 
      className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6"
      data-testid="search-error-state"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
            Erreur de recherche
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

/**
 * Individual search result item
 */
function InvestigationResultItem({ 
  result, 
  onSelect 
}: { 
  result: InvestigationResult; 
  onSelect: (id: string) => void;
}) {
  const statusColors = {
    PICK: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    NO_BET: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    HARD_STOP: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  const statusLabels = {
    PICK: 'PICK',
    NO_BET: 'No-Bet',
    HARD_STOP: 'Hard-Stop',
  };

  return (
    <button
      onClick={() => onSelect(result.id)}
      className="
        w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 
        bg-white dark:bg-gray-800 p-4 transition-colors
        hover:bg-gray-50 dark:hover:bg-gray-700/50
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
      "
      data-testid={`investigation-result-${result.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {result.homeTeam} vs {result.awayTeam}
            </h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[result.status]}`}>
              {statusLabels[result.status]}
            </span>
          </div>
          
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {result.rationaleSummary || 'Aucune justification disponible'}
          </p>

          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {new Date(result.matchDate).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span>Match: {result.matchId}</span>
            {result.confidence && (
              <span>Confiance: {Math.round(result.confidence * 100)}%</span>
            )}
            <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
              {result.traceId.slice(0, 8)}...
            </span>
          </div>

          {/* Evidence indicators (AC3, AC4) */}
          <div className="mt-2 flex items-center gap-2">
            {result.gates?.confidence !== undefined && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                result.gates.confidence 
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                Confiance: {result.gates.confidence ? 'Pass' : 'Fail'}
              </span>
            )}
            {result.gates?.edge !== undefined && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                result.gates.edge 
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                Edge: {result.gates.edge ? 'Pass' : 'Fail'}
              </span>
            )}
            {result.gates?.hardStop && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                Hard-Stop
              </span>
            )}
          </div>
        </div>

        <ChevronRightIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" aria-hidden="true" />
      </div>
    </button>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}

export function InvestigationSearch({
  onSearch,
  onSelectDecision,
  results = [],
  isLoading = false,
  error = null,
  totalResults = 0,
}: InvestigationSearchProps) {
  // Form state
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [matchId, setMatchId] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState<DecisionStatus | 'all'>('all');

  // Filter panel visibility
  const [showFilters, setShowFilters] = useState(true);

  // Build filters object
  const filters = useMemo<InvestigationFilters>(() => ({
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    matchId: matchId || undefined,
    homeTeam: homeTeam || undefined,
    awayTeam: awayTeam || undefined,
    userId: userId || undefined,
    status: status === 'all' ? undefined : status,
  }), [fromDate, toDate, matchId, homeTeam, awayTeam, userId, status]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(fromDate || toDate || matchId || homeTeam || awayTeam || userId || status !== 'all');
  }, [fromDate, toDate, matchId, homeTeam, awayTeam, userId, status]);

  // Handle search submit
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  }, [filters, onSearch]);

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    setFromDate('');
    setToDate('');
    setMatchId('');
    setHomeTeam('');
    setAwayTeam('');
    setUserId('');
    setStatus('all');
    onSearch({});
  }, [onSearch]);

  // Handle retry on error
  const handleRetry = useCallback(() => {
    onSearch(filters);
  }, [filters, onSearch]);

  return (
    <div data-testid="investigation-search">
      {/* Search Form */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-6">
        <form onSubmit={handleSubmit}>
          {/* Main search row */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Match ID input */}
            <div className="flex-1">
              <label
                htmlFor="investigation-match-id"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                ID Match
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  id="investigation-match-id"
                  type="text"
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  placeholder="Ex: match_12345"
                  className="
                    w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    dark:bg-gray-700 dark:border-gray-600 dark:text-white
                    min-h-[44px]
                  "
                  data-testid="search-match-id"
                />
              </div>
            </div>

            {/* Home Team input */}
            <div className="flex-1">
              <label
                htmlFor="investigation-home-team"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Équipe à domicile
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  id="investigation-home-team"
                  type="text"
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  placeholder="Ex: Lakers"
                  className="
                    w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    dark:bg-gray-700 dark:border-gray-600 dark:text-white
                    min-h-[44px]
                  "
                  data-testid="search-home-team"
                />
              </div>
            </div>

            {/* Away Team input */}
            <div className="flex-1">
              <label
                htmlFor="investigation-away-team"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Équipe visiteuse
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  id="investigation-away-team"
                  type="text"
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  placeholder="Ex: Celtics"
                  className="
                    w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    dark:bg-gray-700 dark:border-gray-600 dark:text-white
                    min-h-[44px]
                  "
                  data-testid="search-away-team"
                />
              </div>
            </div>

            {/* Search button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isLoading}
                className="
                  w-full sm:w-auto px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md
                  hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  dark:focus:ring-offset-gray-900 min-h-[44px]
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
                data-testid="search-submit"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Rechercher'
                )}
              </button>
            </div>
          </div>

          {/* Toggle filters button */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            aria-expanded={showFilters}
            data-testid="toggle-filters"
          >
            {showFilters ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
            <Filter className="h-4 w-4" aria-hidden="true" />
            {showFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
            {hasActiveFilters && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                Filtres actifs
              </span>
            )}
          </button>

          {/* Advanced filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Date range - From */}
                <div>
                  <label
                    htmlFor="investigation-from-date"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    <Calendar className="inline h-4 w-4 mr-1" aria-hidden="true" />
                    Date début
                  </label>
                  <input
                    id="investigation-from-date"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="
                      w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                      dark:bg-gray-700 dark:border-gray-600 dark:text-white
                      min-h-[44px]
                    "
                    data-testid="search-from-date"
                  />
                </div>

                {/* Date range - To */}
                <div>
                  <label
                    htmlFor="investigation-to-date"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    <Calendar className="inline h-4 w-4 mr-1" aria-hidden="true" />
                    Date fin
                  </label>
                  <input
                    id="investigation-to-date"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="
                      w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                      dark:bg-gray-700 dark:border-gray-600 dark:text-white
                      min-h-[44px]
                    "
                    data-testid="search-to-date"
                  />
                </div>

                {/* User ID input (AC1) */}
                <div>
                  <label
                    htmlFor="investigation-user-id"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    <Users className="inline h-4 w-4 mr-1" aria-hidden="true" />
                    Utilisateur
                  </label>
                  <input
                    id="investigation-user-id"
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="ID ou email utilisateur"
                    className="
                      w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                      dark:bg-gray-700 dark:border-gray-600 dark:text-white
                      min-h-[44px]
                    "
                    data-testid="search-user-id"
                  />
                </div>

                {/* Status filter (AC2) */}
                <div>
                  <label
                    htmlFor="investigation-status"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Statut
                  </label>
                  <select
                    id="investigation-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DecisionStatus | 'all')}
                    className="
                      w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                      dark:bg-gray-700 dark:border-gray-600 dark:text-white
                      min-h-[44px]
                    "
                    data-testid="search-status"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clear filters button */}
              {hasActiveFilters && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    data-testid="clear-filters"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Effacer les filtres
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Results section */}
      <div data-testid="search-results">
        {isLoading && <SearchResultsSkeleton />}

        {error && (
          <SearchErrorState 
            message={error.message} 
            onRetry={handleRetry} 
          />
        )}

        {!isLoading && !error && results.length === 0 && hasActiveFilters && (
          <EmptySearchState />
        )}

        {!isLoading && !error && results.length > 0 && (
          <div className="space-y-3">
            {/* Results count */}
            <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="results-count">
              <strong>{totalResults}</strong> résultat{totalResults !== 1 ? 's' : ''} trouvé{totalResults !== 1 ? 's' : ''}
            </p>

            {/* Results list */}
            {results.map((result) => (
              <InvestigationResultItem
                key={result.id}
                result={result}
                onSelect={onSelectDecision}
              />
            ))}
          </div>
        )}

        {!isLoading && !error && results.length === 0 && !hasActiveFilters && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
            <Search className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Rechercher une décision
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Entrez des critères de recherche pour trouver une décision à investiguer.
              Vous pouvez rechercher par date, équipe, ID de match, ou utilisateur.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default InvestigationSearch;
