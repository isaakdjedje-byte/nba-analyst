/**
 * Decision Card Component
 * Displays a single decision with match info, status, and rationale
 * Story 3.2: Implement Picks view with today's decisions list
 * 
 * Requirements:
 * - Card layout with teams, time, status badge
 * - Short rationale preview
 * - Hover/focus states
 * - 44x44px touch targets (NFR22)
 * - Accessible with semantic HTML
 */

'use client';

import { StatusBadge } from './StatusBadge';
import { formatMatchTime, formatEdge, formatConfidence } from '../services/decision-service';
import type { Decision } from '../types';

interface DecisionCardProps {
  decision: Decision;
  onClick?: (decision: Decision) => void;
  className?: string;
}

export function DecisionCard({ decision, onClick, className = '' }: DecisionCardProps) {
  const { match, status, rationale, edge, confidence, recommendedPick } = decision;
  
  const handleClick = () => {
    if (onClick) {
      onClick(decision);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="group"
      aria-label={`Match: ${match.homeTeam} vs ${match.awayTeam}`}
      className={`
        rounded-lg border border-gray-200 bg-white p-4 shadow-sm
        transition-all duration-200
        hover:shadow-md hover:border-gray-300
        focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500
        dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : -1}
      data-testid="decision-card"
    >
      {/* Match Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Teams */}
          <h3 
            className="text-lg font-semibold text-gray-900 dark:text-white truncate"
            title={`${match.homeTeam} vs ${match.awayTeam}`}
          >
            <span className="sr-only">Match: </span>
            {match.homeTeam} <span className="text-gray-500">vs</span> {match.awayTeam}
          </h3>
          
          {/* Match Time & League */}
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <time dateTime={match.startTime || undefined}>
              {formatMatchTime(match.startTime)}
            </time>
            {match.league && (
              <>
                <span aria-hidden="true">•</span>
                <span className="uppercase">{match.league}</span>
              </>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex-shrink-0">
          <StatusBadge status={status} size="sm" />
        </div>
      </div>

      {/* Edge & Confidence */}
      <div className="mt-3 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 dark:text-gray-400">Edge:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatEdge(edge)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 dark:text-gray-400">Confiance:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatConfidence(confidence)}
          </span>
        </div>
      </div>

      {/* Rationale Preview */}
      <div className="mt-3">
        <p 
          className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2"
          title={rationale}
        >
          {rationale}
        </p>
      </div>

      {/* Recommended Pick (if applicable) */}
      {recommendedPick && status === 'PICK' && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Recommandation:</span>
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
              {recommendedPick}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
