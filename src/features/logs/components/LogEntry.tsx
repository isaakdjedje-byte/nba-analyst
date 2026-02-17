/**
 * LogEntry Component
 * Story 4.2: Implementer la vue Logs avec historique des decisions
 * 
 * Displays a single log entry with match, date, status, rationale summary
 * WCAG 2.2 AA compliant - keyboard accessible, screen reader friendly
 * 
 * Requirements:
 * - Match name, date, status badge, rationale summary
 * - Expandable for full details (AC3)
 * - Click to expand or navigate to detail view (AC3)
 * - Mobile-first responsive
 * - Dark mode support
 * - Accessibility: keyboard nav, focus visible, status redundancy
 */

'use client';

import { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Clipboard, Clock } from 'lucide-react';
import { StatusBadge } from '@/features/decisions/components/StatusBadge';
import type { LogEntry } from '../types';

interface LogEntryProps {
  entry: LogEntry;
  onClick?: (entry: LogEntry) => void;
  onTimelineClick?: (entry: LogEntry) => void;
  className?: string;
}

/**
 * Format date for display
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format match teams
 */
function formatMatch(homeTeam: string, awayTeam: string): string {
  return `${homeTeam} vs ${awayTeam}`;
}

/**
 * Copy traceId to clipboard
 */
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

export function LogEntryComponent({ entry, onClick, onTimelineClick, className = '' }: LogEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(entry);
    }
  }, [entry, onClick]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleClick();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isExpanded) handleToggle();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isExpanded) handleToggle();
        break;
    }
  };

  return (
    <article
      role="article"
      aria-labelledby={`log-entry-${entry.id}`}
      className={`
        rounded-lg border border-gray-200 bg-white shadow-sm
        transition-all duration-200 ease-in-out
        hover:shadow-md hover:border-gray-300
        focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500
        dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600
        ${onClick ? 'cursor-pointer' : ''}
        ${isExpanded ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        ${className}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : -1}
      data-testid="log-entry"
      data-expanded={isExpanded}
      data-status={entry.status.toLowerCase()}
    >
      {/* Screen reader announcement for expansion state */}
      <div role="status" aria-live="polite" className="sr-only">
        {isExpanded ? 'Détails de la décision ouverts' : 'Détails de la décision fermés'}
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Match Title */}
            <h3
              id={`log-entry-${entry.id}`}
              className="text-base font-semibold text-gray-900 dark:text-white truncate"
              title={formatMatch(entry.homeTeam, entry.awayTeam)}
              data-testid="log-entry-match"
            >
              {formatMatch(entry.homeTeam, entry.awayTeam)}
            </h3>

            {/* Date */}
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400" data-testid="log-entry-date">
              <time dateTime={entry.matchDate}>
                {formatDate(entry.matchDate)}
              </time>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex-shrink-0" data-testid="log-entry-status">
            <StatusBadge status={entry.status} size="sm" />
          </div>
        </div>

        {/* Rationale Summary */}
        <div className="mt-3" data-testid="log-entry-rationale">
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {entry.rationaleSummary}
          </p>
        </div>

        {/* Expand/Collapse Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          aria-expanded={isExpanded}
          aria-controls={`log-details-${entry.id}`}
          className="
            mt-3 flex items-center gap-1.5 text-sm text-blue-600
            hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300
            transition-colors min-h-[44px] min-w-[44px]
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            rounded px-2 -ml-2
          "
          data-testid="expand-button"
        >
          <span>{isExpanded ? 'Moins de détails' : 'Plus de détails'}</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Expandable Details Panel */}
      <div
        id={`log-details-${entry.id}`}
        data-testid="log-details"
        className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
        `}
        role="region"
        aria-labelledby={`log-entry-${entry.id}`}
        hidden={!isExpanded}
      >
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          {/* Full Rationale */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Justification complète
            </h4>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {entry.rationale}
            </p>
          </div>

          {/* Gate Outcomes */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Portes de décision
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={entry.confidenceGate ? 'text-emerald-600' : 'text-red-600'}>
                  {entry.confidenceGate ? '✓' : '✗'}
                </span>
                <span className="text-gray-600 dark:text-gray-400">Confiance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={entry.edgeGate ? 'text-emerald-600' : 'text-red-600'}>
                  {entry.edgeGate ? '✓' : '✗'}
                </span>
                <span className="text-gray-600 dark:text-gray-400">Edge</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={entry.driftGate ? 'text-emerald-600' : 'text-red-600'}>
                  {entry.driftGate ? '✓' : '✗'}
                </span>
                <span className="text-gray-600 dark:text-gray-400">Drift</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={entry.hardStopGate ? 'text-emerald-600' : 'text-red-600'}>
                  {entry.hardStopGate ? '✓' : '✗'}
                </span>
                <span className="text-gray-600 dark:text-gray-400">Hard-Stop</span>
              </div>
            </div>
          </div>

          {/* Hard Stop Reason (if applicable) */}
          {entry.status === 'HARD_STOP' && entry.hardStopReason && (
            <div className="mb-4 rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                Raison du blocage
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                {entry.hardStopReason}
              </p>
            </div>
          )}

          {/* Data Signals (AC3) */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Signaux de données
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Confiance</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {typeof entry.confidence === 'number' ? `${(entry.confidence * 100).toFixed(1)}%` : 'N/A'}
                </p>
              </div>
              {entry.edge !== null && (
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Edge</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {entry.edge !== null ? `${entry.edge.toFixed(2)}` : 'N/A'}
                  </p>
                </div>
              )}
              {entry.recommendedPick && (
                <div className="col-span-2 rounded-lg bg-green-50 dark:bg-green-900/20 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Choix recommandé</p>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                    {entry.recommendedPick}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Trace ID */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Trace ID:</span> {entry.traceId}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(entry.traceId);
              }}
              className="
                p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 rounded
                min-h-[44px] min-w-[44px]
              "
              aria-label="Copier le trace ID"
              title="Copier le trace ID"
            >
              <Clipboard className="h-4 w-4" />
            </button>
          </div>

          {/* Timeline Link Button (AC5) */}
          {onTimelineClick && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTimelineClick(entry);
                }}
                className="
                  w-full flex items-center justify-center gap-2 px-4 py-2
                  text-sm font-medium text-blue-600 dark:text-blue-400
                  bg-blue-50 dark:bg-blue-900/20
                  border border-blue-200 dark:border-blue-800
                  rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  dark:focus:ring-offset-gray-800
                  min-h-[44px]
                  transition-colors
                "
                data-testid="timeline-button"
              >
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span>Voir la timeline</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default LogEntryComponent;
