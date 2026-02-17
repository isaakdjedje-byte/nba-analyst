/**
 * BlockCausePanel Component
 * Story 5.1: Créer le panneau d'affichage des causes de blocage policy
 *
 * Requirements:
 * - AC1: Display specific cause and recommended next action (FR11)
 * - AC2: Show exact hard-stop rule, thresholds, current vs limit
 * - AC3: Reference to policy rule for context
 * - AC4: Data quality metrics with recovery recommendation
 * - AC5: User-friendly language, expandable technical details
 * - StatusBadge semantic colors: Hard-Stop = orange (#C2410C)
 * - Icon + text + color for status (per NFR20)
 * - Accessibility: WCAG 2.2 AA, keyboard navigation, ARIA labels
 * - Touch targets >= 44x44px
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  ShieldAlert,
  Database,
  Brain,
  Activity,
  ServerOff,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  BlockCausePanelProps,
  BLOCK_CAUSE_CATEGORY_CONFIG,
} from '../types';

const ICON_MAP = {
  ShieldAlert,
  Database,
  Brain,
  Activity,
  ServerOff,
};

// Static class mappings for Tailwind JIT compatibility
const categoryBgMap = {
  bankroll_limit: 'bg-orange-50 dark:bg-orange-900/20',
  data_quality: 'bg-purple-50 dark:bg-purple-900/20',
  model_confidence: 'bg-red-50 dark:bg-red-900/20',
  drift_detection: 'bg-amber-50 dark:bg-amber-900/20',
  service_unavailable: 'bg-slate-50 dark:bg-slate-900/20',
};

const categoryBorderMap = {
  bankroll_limit: 'border-orange-200 dark:border-orange-800',
  data_quality: 'border-purple-200 dark:border-purple-800',
  model_confidence: 'border-red-200 dark:border-red-800',
  drift_detection: 'border-amber-200 dark:border-amber-800',
  service_unavailable: 'border-slate-200 dark:border-slate-800',
};

const categoryTextMap = {
  bankroll_limit: 'text-orange-800 dark:text-orange-200',
  data_quality: 'text-purple-800 dark:text-purple-200',
  model_confidence: 'text-red-800 dark:text-red-200',
  drift_detection: 'text-amber-800 dark:text-amber-200',
  service_unavailable: 'text-slate-800 dark:text-slate-200',
};

const categoryIconMap = {
  bankroll_limit: 'text-orange-600 dark:text-orange-400',
  data_quality: 'text-purple-600 dark:text-purple-400',
  model_confidence: 'text-red-600 dark:text-red-400',
  drift_detection: 'text-amber-600 dark:text-amber-400',
  service_unavailable: 'text-slate-600 dark:text-slate-400',
};

/**
 * Format the triggered date for display
 */
function formatTriggeredDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Sanitize text to prevent XSS attacks
 * Removes HTML tags and encodes special characters
 */
function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  // First remove any HTML tags
  const withoutHtml = text.replace(/<[^>]*>/g, '');
  // Then encode special characters to prevent injection
  return withoutHtml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format a number as percentage
 */
function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Calculate progress percentage for threshold display
 */
function calculateProgress(current: number, threshold: number): number {
  if (threshold === 0) return 0;
  return Math.min((current / threshold) * 100, 100);
}

export function BlockCausePanel({
  decisionId,
  cause,
  expanded = false,
  onExpandChange,
  showTechnicalDetails = false,
  className = '',
}: BlockCausePanelProps) {
  const [isUserExpanded, setIsUserExpanded] = useState(false);

  const config = BLOCK_CAUSE_CATEGORY_CONFIG[cause.category];
  const Icon = ICON_MAP[config.icon];

  const handleToggleExpand = useCallback(() => {
    const newExpanded = !isUserExpanded;
    setIsUserExpanded(newExpanded);
    if (onExpandChange) {
      onExpandChange(newExpanded);
    }
  }, [isUserExpanded, onExpandChange]);

  // Determine if we should show expanded content
  const showExpanded = expanded || isUserExpanded;

  // Calculate progress for threshold display
  const progressPercent = calculateProgress(cause.currentValue, cause.threshold);

  // Get CSS classes for category
  const bgClasses = categoryBgMap[cause.category];
  const borderClasses = categoryBorderMap[cause.category];
  const textClasses = categoryTextMap[cause.category];
  const iconClasses = categoryIconMap[cause.category];

  return (
    <div
      role="region"
      aria-labelledby={`block-cause-${decisionId}`}
      className={`
        rounded-lg border-2 ${bgClasses} ${borderClasses}
        transition-all duration-200
        ${className}
      `}
      data-testid="block-cause-panel"
      data-category={cause.category}
    >
      {/* Header - Always Visible */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Category Icon */}
          <div
            className={`
              flex-shrink-0 p-2 rounded-full
              ${bgClasses} ${borderClasses}
            `}
            aria-hidden="true"
          >
            <Icon className={`h-5 w-5 ${iconClasses}`} />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Category Label */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${textClasses}`}
              >
                {config.label}
              </span>
            </div>

            {/* Rule Name (AC1: specific cause) */}
            <h3
              id={`block-cause-${decisionId}`}
              className={`font-semibold text-base ${textClasses}`}
            >
              {cause.ruleName}
            </h3>

            {/* Rule Description */}
            <p 
              className={`text-sm mt-1 ${textClasses} opacity-90`}
               
              dangerouslySetInnerHTML={{ __html: sanitizeText(cause.ruleDescription) }}
            />

            {/* Threshold Display (AC2: exact rule, threshold, current vs limit) */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className={`font-medium ${textClasses}`}>
                  Valeur actuelle: {cause.currentValue.toLocaleString('fr-FR')}
                </span>
                <span className={`font-medium ${textClasses}`}>
                  Seuil: {cause.threshold.toLocaleString('fr-FR')}
                </span>
              </div>

              {/* Progress Bar */}
              <div
                className={`
                  h-2 rounded-full overflow-hidden
                  ${bgClasses}
                `}
                role="progressbar"
                aria-valuenow={cause.currentValue}
                aria-valuemin={0}
                aria-valuemax={cause.threshold}
                aria-label={`Progression: ${progressPercent.toFixed(0)}% du seuil`}
              >
                <div
                  className={`
                    h-full rounded-full transition-all duration-300
                    ${progressPercent >= 100 
                      ? 'bg-red-500' 
                      : progressPercent >= 80 
                        ? 'bg-amber-500' 
                        : iconClasses.replace('text-', 'bg-')
                    }
                  `}
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Recommended Action (AC1, AC4) */}
            <div
              className={`
                mt-3 flex items-start gap-2 p-2 rounded
                bg-emerald-50 dark:bg-emerald-900/20
                border border-emerald-200 dark:border-emerald-800
              `}
            >
              <CheckCircle2
                className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                  Action recommandée
                </span>
                <p 
                  className="text-sm text-emerald-800 dark:text-emerald-200 mt-0.5"
                   
                  dangerouslySetInnerHTML={{ __html: sanitizeText(cause.recommendation) }}
                />
              </div>
            </div>

            {/* Expandable Technical Details (AC5: for admin/ops) */}
            {(showTechnicalDetails || cause.relatedPolicyId || cause.dataQualityMetrics) && (
              <button
                type="button"
                onClick={handleToggleExpand}
                aria-expanded={showExpanded}
                aria-controls={`block-cause-details-${decisionId}`}
                className={`
                  mt-3 flex items-center gap-1 text-sm font-medium
                  text-blue-600 dark:text-blue-400
                  hover:text-blue-800 dark:hover:text-blue-300
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  rounded min-h-[44px] min-w-[44px] px-2 -ml-2
                  transition-colors
                `}
              >
                {showExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    <span>Moins de détails techniques</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    <span>Plus de détails techniques</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Technical Details Section */}
      {showExpanded && (
        <div
          id={`block-cause-details-${decisionId}`}
          className={`
            px-4 pb-4 pt-2
            border-t ${borderClasses}
          `}
          role="region"
          aria-label="Détails techniques"
        >
          {/* Triggered At */}
          <div className="mb-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Déclenché le
            </span>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {formatTriggeredDate(cause.triggeredAt)}
            </p>
          </div>

          {/* Related Policy ID (if available) */}
          {cause.relatedPolicyId && (
            <div className="mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Règle policy
              </span>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                  {cause.relatedPolicyId}
                </p>
                <button
                  type="button"
                  className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800"
                  aria-label="Voir la policy"
                  title="Voir la policy"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Data Quality Metrics (AC4) */}
          {cause.dataQualityMetrics && cause.dataQualityMetrics.length > 0 && (
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Métriques de qualité (AC4)
              </span>
              <div className="mt-2 space-y-2">
                {cause.dataQualityMetrics.map((metric, index) => {
                  const metricProgress = calculateProgress(metric.value, metric.threshold);
                  return (
                    <div
                      key={index}
                      className={`
                        p-2 rounded
                        bg-white dark:bg-gray-800
                        border border-gray-200 dark:border-gray-700
                      `}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {metric.metric}
                        </span>
                        <span className={`
                          font-mono
                          ${metricProgress >= 100 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-gray-600 dark:text-gray-400'
                          }
                        `}>
                          {formatPercentage(metric.value)} / {formatPercentage(metric.threshold)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`
                            h-full rounded-full
                            ${metricProgress >= 100 
                              ? 'bg-red-500' 
                              : metricProgress >= 80 
                                ? 'bg-amber-500' 
                                : 'bg-emerald-500'
                            }
                          `}
                          style={{ width: `${Math.min(metricProgress, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recovery Recommendation for Data Quality (AC4) */}
              <div
                className={`
                  mt-3 flex items-start gap-2 p-2 rounded
                  bg-blue-50 dark:bg-blue-900/20
                  border border-blue-200 dark:border-blue-800
                `}
              >
                <AlertCircle
                  className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  La décision pourrait être disponible une fois les métriques de qualité restaurées au-dessus du seuil.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BlockCausePanel;
