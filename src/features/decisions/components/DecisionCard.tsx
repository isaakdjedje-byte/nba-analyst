/**
 * Decision Card Component
 * Displays a single decision with match info, status, and rationale
 * Story 3.3: Enhanced DecisionCard with explicit status and expandable details
 * Story 3.5: Integration with DetailPanel for comprehensive details
 *
 * Requirements:
 * - Card layout with teams, time, status badge (AC1-2)
 * - Edge/confidence with IBM Plex Mono (AC3)
 * - Short rationale preview (AC4)
 * - Expandable details panel (AC5)
 * - State variants: default, hover, expanded, blocked, degraded, loading (AC6)
 * - Mobile-first responsive: compact/standard variants (AC7)
 * - Full accessibility: role, aria-labelledby, aria-expanded (AC8)
 * - Dark mode coherence (AC9)
 * - WCAG 2.2 AA contrast (NFR19)
 * - Never color alone for status (NFR20)
 * - Keyboard navigation (NFR21)
 * - Touch targets >= 44x44px (NFR22)
 * - Session persistence for expansion state (Story 3.5 AC6)
 */

'use client';

import { useCallback, useRef } from 'react';
import { StatusBadge } from './StatusBadge';
import { DecisionCardSkeleton } from './DecisionCardSkeleton';
import { RationalePanel } from './RationalePanel';
import { DetailPanel } from './DetailPanel';
import { useExpansionState } from '../hooks/useExpansionState';
import { useIsMobile } from '@/hooks/useMediaQuery'; // Story 3.8: Use shared hook (AC2)
import { formatMatchTime, formatEdge, formatConfidence } from '../services/decision-service';
import type { Decision, DecisionDetail } from '../types';

interface DecisionCardProps {
  decision: Decision;
  variant?: 'compact' | 'standard' | 'auto';
  isLoading?: boolean;
  onClick?: (decision: Decision) => void;
  onExpand?: (decision: Decision, isExpanded: boolean) => void;
  className?: string;
}

export function DecisionCard({
  decision,
  variant = 'auto',
  isLoading = false,
  onClick,
  onExpand,
  className = '',
}: DecisionCardProps) {
  // Story 3.5: Use useExpansionState for session persistence (AC6)
  const { isExpanded, toggle: toggleExpand } = useExpansionState(decision.id);
  const isMobileViewport = useIsMobile(); // Uses 768px breakpoint from shared hook (AC2)

  // Refs for focus management (AC1, AC5)
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const cardHeaderRef = useRef<HTMLDivElement>(null);

  // Safely destructure with defaults for optional properties
  const {
    match,
    status,
    edge,
    confidence,
    recommendedPick,
    hardStopReason,
    recommendedAction,
    isDegraded = false,
  } = decision;

  // Handle expand toggle with focus management (AC1, AC5)
  const handleExpand = useCallback(() => {
    const willExpand = !isExpanded;
    toggleExpand();

    // AC1: Move focus to expanded content when expanding
    if (willExpand) {
      setTimeout(() => {
        detailPanelRef.current?.focus();
      }, 350); // Wait for animation
    } else {
      // AC5: Return focus to expand button when collapsing
      expandButtonRef.current?.focus();
    }

    if (onExpand) {
      onExpand(decision, willExpand);
    }
  }, [isExpanded, decision, onExpand, toggleExpand]);

  // Handle card click
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(decision);
    }
  }, [onClick, decision]);

  // Handle keyboard navigation (NFR21: Full keyboard navigation)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleClick();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isExpanded) handleExpand();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isExpanded) handleExpand();
        break;
    }
  };

  // Loading state
  if (isLoading) {
    return <DecisionCardSkeleton />;
  }

  // Variant classes (AC7: Mobile-First Responsive)
  const variantClasses = {
    compact: 'p-3 gap-2',
    standard: 'p-4 gap-3',
  };

  // Auto-detect variant based on viewport (AC7 requirement)
  const currentVariant = variant === 'auto' 
    ? (isMobileViewport ? 'compact' : 'standard') 
    : variant;
  const paddingClass = variantClasses[currentVariant];

  return (
    <div
      role="group"
      aria-labelledby={`decision-title-${decision.id}`}
      className={`
        rounded-xl border border-gray-200 bg-white shadow-sm
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
      data-testid="decision-card"
      data-variant={currentVariant}
      data-expanded={isExpanded}
      data-status={status.toLowerCase()}
    >
      {/* AC8: Screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="expansion-status"
      >
        {isExpanded ? 'Panneau de détails ouvert' : 'Panneau de détails fermé'}
      </div>

      {/* Card Header - Match Info & Status */}
      <div ref={cardHeaderRef} className={`flex flex-col gap-2 ${paddingClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Title with sr-only prefix for accessibility */}
            <h3
              id={`decision-title-${decision.id}`}
              className="text-lg font-semibold text-gray-900 dark:text-white truncate"
              title={`${match.homeTeam} vs ${match.awayTeam}`}
            >
              <span className="sr-only">Décision pour </span>
              {match.homeTeam} <span className="text-gray-500 dark:text-gray-400">vs</span> {match.awayTeam}
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
            <StatusBadge
              status={status}
              size={currentVariant === 'compact' ? 'sm' : 'md'}
            />
          </div>
        </div>

        {/* Edge & Confidence Metrics - IBM Plex Mono */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              {currentVariant === 'compact' ? 'Edge' : 'Edge'}
            </span>
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
              {edge !== null && edge > 0 ? '+' : ''}{formatEdge(edge)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              {currentVariant === 'compact' ? 'Conf' : 'Confiance'}
            </span>
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              {formatConfidence(confidence)}
            </span>
          </div>
        </div>

        {/* RationalePanel Integration - Story 3.4 */}
        <RationalePanel
          decision={decision}
          variant="embedded"
          isExpanded={isExpanded}
        />

        {/* Recommended Pick (for PICK status only) */}
        {recommendedPick && status === 'PICK' && (
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Recommandation
              </span>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {recommendedPick}
              </span>
            </div>
          </div>
        )}

        {/* Hard-Stop Blocked State (with null-safe optional chaining) */}
        {status === 'HARD_STOP' && (hardStopReason ?? decision.hardStopReason) && (
          <div className="mt-2 rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
            <div className="flex items-start gap-2">
              <span className="text-orange-600 dark:text-orange-400 text-lg" aria-hidden="true">
                ⚠
              </span>
              <div>
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                  Blocage actif
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5">
                  {hardStopReason ?? decision.hardStopReason}
                </p>
                {(recommendedAction ?? decision.recommendedAction) && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Action recommandée: {recommendedAction ?? decision.recommendedAction}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Degraded State Warning */}
        {isDegraded && (
          <div
            className="mt-2 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400"
            data-testid="degraded-warning"
          >
            <svg
              className="h-4 w-4 flex-shrink-0"
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
            <span>Données partielles - décision avec prudence</span>
          </div>
        )}
      </div>

      {/* Expand/Collapse Button - Story 3.5: Enhanced ARIA attributes */}
      <div className="px-4 pb-3">
        <button
          ref={expandButtonRef}
          type="button"
          id={`expand-trigger-${decision.id}`}
          onClick={(e) => {
            e.stopPropagation();
            handleExpand();
          }}
          aria-expanded={isExpanded}
          aria-controls={`decision-details-${decision.id}`}
          className="
            flex items-center gap-1.5 text-sm text-blue-600
            hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300
            transition-colors min-h-[44px] min-w-[44px]
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            rounded px-2 -ml-2
          "
          data-testid="expand-button"
        >
          <span>{isExpanded ? 'Moins de détails' : 'Plus de détails'}</span>
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expandable Details Panel - Story 3.5: DetailPanel Integration */}
      <div
        ref={detailPanelRef}
        id={`decision-details-${decision.id}`}
        data-testid="decision-details"
        className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
        `}
        role="region"
        aria-labelledby={`expand-trigger-${decision.id}`}
        hidden={!isExpanded}
        tabIndex={isExpanded ? 0 : -1}
      >
        {/* Story 3.5: DetailPanel with comprehensive decision details */}
        <div className="px-4 pb-4">
          <DetailPanel
            decision={decision as DecisionDetail}
            isExpanded={isExpanded}
          />
        </div>
      </div>
    </div>
  );
}

export default DecisionCard;
