/**
 * EmptyState Component
 * Reusable empty state with icon, title, description and optional action
 * Story 3.9: Task 3 - Implement EmptyState component
 *
 * Requirements:
 * - AC2: Icon + title + description + optional action pattern
 * - AC2: Variants for different views (picks, no-bet, performance, logs)
 * - AC5: Accessible (proper heading hierarchy, alt text)
 * - AC9: Dark mode support
 * - NFR20: Never color alone (icon + text)
 */

import { Trophy, Ban, LineChart, History, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

export interface EmptyStateProps {
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Title of the empty state */
  title: string;
  /** Description explaining why it's empty */
  description: string;
  /** Optional action label for the button */
  actionLabel?: string;
  /** Optional href for link action */
  actionHref?: string;
  /** Optional callback for button action */
  onAction?: () => void;
  /** Optional additional CSS classes */
  className?: string;
  /** Optional test id for testing */
  testId?: string;
}

/**
 * Reusable EmptyState component
 * Displays an empty state with icon, title, description and optional action
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = '',
  testId = 'empty-state',
}: EmptyStateProps) {
  const hasAction = actionLabel && (actionHref || onAction);

  return (
    <div
      className={`
        flex flex-col items-center justify-center
        py-12 px-4 text-center
        ${className}
      `}
      data-testid={testId}
      role="status"
      aria-live="polite"
    >
      {/* Icon container with semantic background */}
      <div
        className="
          h-16 w-16 rounded-full
          bg-slate-100 dark:bg-slate-800
          flex items-center justify-center
          mb-4
        "
        aria-hidden="true"
      >
        <Icon
          className="h-8 w-8 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
      </div>

      {/* Title with proper heading hierarchy */}
      <h3
        className="
          text-lg font-medium
          text-slate-900 dark:text-slate-100
          mb-2
        "
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className="
          text-sm text-slate-600 dark:text-slate-400
          max-w-xs
          mb-4
        "
      >
        {description}
      </p>

      {/* Optional action button/link */}
      {hasAction && (
        <div className="mt-2">
          {actionHref ? (
            <Link
              href={actionHref}
              className="
                inline-flex items-center justify-center
                px-4 py-2
                text-sm font-medium
                text-slate-700 dark:text-slate-300
                bg-white dark:bg-slate-800
                border border-slate-300 dark:border-slate-600
                rounded-lg
                hover:bg-slate-50 dark:hover:bg-slate-700
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                transition-colors
                min-h-[44px]
              "
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="
                inline-flex items-center justify-center
                px-4 py-2
                text-sm font-medium
                text-slate-700 dark:text-slate-300
                bg-white dark:bg-slate-800
                border border-slate-300 dark:border-slate-600
                rounded-lg
                hover:bg-slate-50 dark:hover:bg-slate-700
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                transition-colors
                min-h-[44px]
              "
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pre-configured variant for Picks view
 * Used when no decisions are available
 */
export function EmptyPicksState() {
  return (
    <EmptyState
      icon={Trophy}
      title="Aucun pick disponible"
      description="Les décisions du jour ne sont pas encore disponibles. Attendez le prochain run quotidien ou consultez l'historique."
      actionLabel="Voir l'historique"
      actionHref="/dashboard/logs"
      testId="empty-picks-state"
    />
  );
}

/**
 * Pre-configured variant for No-Bet view
 * Used when no no-bet decisions are available
 */
export function EmptyNoBetState() {
  return (
    <EmptyState
      icon={Ban}
      title="Aucune décision no-bet"
      description="Il n'y a actuellement aucune recommandation no-bet pour aujourd'hui. Consultez les picks ou l'historique."
      actionLabel="Voir les picks"
      actionHref="/dashboard/picks"
      testId="empty-no-bet-state"
    />
  );
}

/**
 * Pre-configured variant for Performance view
 * Used when no performance data is available
 */
export function EmptyPerformanceState() {
  return (
    <EmptyState
      icon={LineChart}
      title="Aucune donnée de performance"
      description="Les statistiques de performance ne sont pas encore disponibles. Les données s'accumuleront après plusieurs jours d'utilisation."
      testId="empty-performance-state"
    />
  );
}

/**
 * Pre-configured variant for Logs view
 * Used when no log history is available
 */
export function EmptyLogsState() {
  return (
    <EmptyState
      icon={History}
      title="Aucun historique disponible"
      description="L'historique des décisions est vide. Les logs seront générés après le premier run quotidien."
      testId="empty-logs-state"
    />
  );
}
