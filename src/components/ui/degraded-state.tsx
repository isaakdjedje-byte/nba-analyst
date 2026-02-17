/**
 * DegradedState Component
 * Displays degraded mode warning with context and retry option
 * Story 3.9: Task 7 - DegradedState component
 *
 * Requirements:
 * - AC3: GuardrailBanner integration for degraded status
 * - AC3: Visual indicator for partial data
 * - AC3: Retry mechanism (manual retry button)
 * - AC5: Accessible (aria-live, proper heading)
 * - AC9: Dark mode support
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface DegradedStateProps {
  /** Reason for degraded state */
  reason: string;
  /** Optional retry callback */
  retry?: () => void;
  /** Optional additional CSS classes */
  className?: string;
  /** Optional test id for testing */
  testId?: string;
}

/**
 * DegradedState component
 * Shows a warning when the system is in degraded mode
 * with optional retry functionality
 */
export function DegradedState({
  reason,
  retry,
  className = '',
  testId = 'degraded-state',
}: DegradedStateProps) {
  return (
    <div
      className={`
        rounded-lg border-l-4 border-amber-500
        bg-amber-50 dark:bg-amber-900/20
        p-4
        ${className}
      `}
      data-testid={testId}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Warning icon */}
        <div
          className="flex-shrink-0 mt-0.5"
          aria-hidden="true"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Mode dégradé actif
          </h3>

          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            {reason}
          </p>

          {/* Retry button */}
          {retry && (
            <button
              type="button"
              onClick={retry}
              className="
                mt-3 inline-flex items-center gap-1.5
                px-3 py-1.5
                text-sm font-medium
                text-amber-700 dark:text-amber-300
                bg-amber-100 dark:bg-amber-800/50
                border border-amber-300 dark:border-amber-600
                rounded-md
                hover:bg-amber-200 dark:hover:bg-amber-700/50
                focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2
                transition-colors
                min-h-[36px]
              "
              data-testid="degraded-retry-button"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Réessayer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * DegradedStateBanner variant
 * Full-width banner for integration with GuardrailBanner pattern
 */
export function DegradedStateBanner({
  reason,
  retry,
  className = '',
  testId = 'degraded-banner',
}: DegradedStateProps) {
  return (
    <div
      className={`
        w-full rounded-lg
        bg-amber-50 dark:bg-amber-900/20
        border border-amber-200 dark:border-amber-800
        p-4
        ${className}
      `}
      data-testid={testId}
      role="alert"
      aria-live="polite"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Mode dégradé
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {reason}
            </p>
          </div>
        </div>

        {retry && (
          <button
            type="button"
            onClick={retry}
            className="
              inline-flex items-center justify-center gap-1.5
              px-4 py-2
              text-sm font-medium
              text-amber-700 dark:text-amber-300
              bg-white dark:bg-slate-800
              border border-amber-300 dark:border-amber-600
              rounded-lg
              hover:bg-amber-50 dark:hover:bg-amber-900/30
              focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2
              transition-colors
              min-h-[44px]
              sm:whitespace-nowrap
            "
            data-testid="degraded-banner-retry"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}
