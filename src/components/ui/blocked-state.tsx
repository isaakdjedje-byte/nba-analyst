/**
 * BlockedState Component
 * Displays hard-stop blocked state with reason and recommended action
 * Story 3.9: Task 8 - BlockedState component
 *
 * Requirements:
 * - AC4: Hard-stop visual (orange #C2410C)
 * - AC4: Policy block message
 * - AC4: Recommended action clearly displayed
 * - AC4: No bypass possible (NFR13: 100% enforcement)
 * - AC5: Accessible (proper heading, aria-live)
 * - NFR20: Never color alone (icon + text + color)
 */

import { ShieldAlert } from 'lucide-react';

export interface BlockedStateProps {
  /** Reason for the block */
  reason: string;
  /** Recommended action for the user */
  recommendedAction: string;
  /** Optional additional CSS classes */
  className?: string;
  /** Optional test id for testing */
  testId?: string;
}

/**
 * BlockedState component
 * Shows a hard-stop state when access is blocked
 * Uses orange color (#C2410C) per AC4 requirement
 * No bypass possible - NFR13: 100% enforcement
 */
export function BlockedState({
  reason,
  recommendedAction,
  className = '',
  testId = 'blocked-state',
}: BlockedStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center
        py-12 px-4 text-center
        ${className}
      `}
      data-testid={testId}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon container with hard-stop orange styling */}
      <div
        className="
          h-16 w-16 rounded-full
          bg-orange-100 dark:bg-orange-900/20
          flex items-center justify-center
          mb-4
        "
        aria-hidden="true"
      >
        <ShieldAlert
          className="h-8 w-8 text-orange-600 dark:text-orange-400"
          aria-hidden="true"
        />
      </div>

      {/* Title with hard-stop semantic styling */}
      <h3
        className="
          text-lg font-semibold
          text-orange-700 dark:text-orange-400
          mb-2
        "
      >
        Décision bloquée
      </h3>

      {/* Reason message */}
      <p
        className="
          text-sm text-slate-600 dark:text-slate-400
          max-w-xs
          mb-4
        "
      >
        {reason}
      </p>

      {/* Recommended action - prominently displayed */}
      <div
        className="
          mt-2
          bg-orange-50 dark:bg-orange-900/20
          border border-orange-200 dark:border-orange-800
          rounded-lg
          px-4 py-3
          max-w-xs
        "
      >
        <p className="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide font-medium mb-1">
          Action recommandée
        </p>
        <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
          {recommendedAction}
      </p>
      </div>

      {/* Hidden text for screen readers indicating no bypass */}
      <span className="sr-only">
        Cette décision est bloquée et ne peut pas être contournée.
      </span>
    </div>
  );
}

/**
 * InlineBlockedState variant
 * Compact version for inline display within cards or lists
 */
export function InlineBlockedState({
  reason,
  recommendedAction,
  className = '',
  testId = 'inline-blocked-state',
}: BlockedStateProps) {
  return (
    <div
      className={`
        rounded-lg
        bg-orange-50 dark:bg-orange-900/20
        border border-orange-200 dark:border-orange-800
        p-4
        ${className}
      `}
      data-testid={testId}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5" aria-hidden="true">
          <ShieldAlert className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-200">
            Blocage actif
          </h4>

          <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
            {reason}
          </p>

          <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-700">
            <p className="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide font-medium">
              Action recommandée
            </p>
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mt-0.5">
              {recommendedAction}
            </p>
          </div>
        </div>
      </div>

      {/* Screen reader only - no bypass message */}
      <span className="sr-only">
        Cette décision est bloquée et ne peut pas être contournée.
      </span>
    </div>
  );
}
