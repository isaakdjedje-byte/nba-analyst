/**
 * TimelineStep Component
 * Story 4.3: Creer le composant DecisionTimeline pour replay decisionnel
 * 
 * Individual timeline event/step with:
 * - Expandable details showing inputs, outputs, processing steps
 * - Timestamp and duration display
 * - traceId linkage
 * - Phase grouping visual indicators
 * 
 * Requirements (AC3):
 * - Hover/focus expands details with raw inputs, outputs, status
 * - Each step shows: timestamp, duration, traceId linkage, status
 * 
 * WCAG 2.2 AA compliant
 * Mobile-first responsive
 * Dark mode support
 */

'use client';

import { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  SkipForward, 
  Clock, 
  ChevronDown, 
  ChevronRight,
  Hash,
  Play,
  Pause
} from 'lucide-react';
import { 
  type TimelineEvent, 
  type TimelineEventStatus,
  PHASE_CONFIG 
} from '../types';

/**
 * Status icon component
 */
function StatusIcon({ status }: { status: TimelineEventStatus }) {
  const iconMap = {
    success: CheckCircle,
    failure: XCircle,
    skipped: SkipForward,
  };

  const colorMap = {
    success: 'text-emerald-500 dark:text-emerald-400',
    failure: 'text-red-500 dark:text-red-400',
    skipped: 'text-gray-400 dark:text-gray-500',
  };

  const labelMap = {
    success: 'Succès',
    failure: 'Échec',
    skipped: 'Ignoré',
  };

  const Icon = iconMap[status];

  return (
    <span 
      className={`inline-flex items-center gap-1.5 ${colorMap[status]}`}
      role="status"
      aria-label={labelMap[status]}
      title={labelMap[status]}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="text-sm">{labelMap[status]}</span>
    </span>
  );
}

/**
 * Format timestamp to readable format
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format duration in milliseconds
 */
function formatDuration(ms?: number): string {
  if (!ms) return '-';
  
  if (ms < 1000) return `${ms}ms`;
  
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(1);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * JSON pretty printer for inputs/outputs
 */
function JsonDisplay({ data, label }: { data: Record<string, unknown> | undefined; label: string }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className="rounded bg-gray-50 dark:bg-gray-900 p-3 overflow-x-auto">
      <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
        {label}
      </h5>
      <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

interface TimelineStepProps {
  event: TimelineEvent;
}

export function TimelineStep({ event }: TimelineStepProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const phaseConfig = PHASE_CONFIG[event.phase];

  // Determine border color based on status
  const borderColorMap = {
    success: 'border-l-emerald-500 dark:border-l-emerald-400',
    failure: 'border-l-red-500 dark:border-l-red-400',
    skipped: 'border-l-gray-400 dark:border-l-gray-500',
  };

  return (
    <div
      className={`
        rounded-lg border border-gray-200 dark:border-gray-700 
        bg-white dark:bg-gray-800 overflow-hidden
        border-l-4 ${borderColorMap[event.status]}
        transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50
      `}
      data-testid={`timeline-step-${event.id}`}
      data-testid-status={event.status}
    >
      {/* Step header - clickable for expansion (AC3) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start justify-between p-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        aria-expanded={isExpanded}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Expand/Collapse icon */}
          <div className="flex-shrink-0 mt-0.5">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            )}
          </div>

          {/* Step info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-gray-900 dark:text-white">
                {event.name}
              </h4>
              <StatusIcon status={event.status} />
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {event.description}
            </p>

            {/* Metadata row (AC3): timestamp, duration, traceId */}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              {/* Timestamp */}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatTimestamp(event.timestamp)}
              </span>

              {/* Duration */}
              {event.duration !== undefined && (
                <span className="flex items-center gap-1">
                  {event.duration > 0 ? (
                    <Play className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Pause className="h-3 w-3" aria-hidden="true" />
                  )}
                  {formatDuration(event.duration)}
                </span>
              )}

              {/* traceId linkage (AC3) */}
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" aria-hidden="true" />
                <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                  {event.traceId.slice(0, 8)}...
                </span>
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Expanded details (AC3): raw inputs, processing steps, outputs */}
      {isExpanded && (
        <div 
          className="px-4 pb-4 pt-0 border-t border-gray-200 dark:border-gray-700"
          data-testid={`timeline-step-details-${event.id}`}
        >
          <div className="mt-4 space-y-4">
            {/* Phase indicator */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                Phase:
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {phaseConfig.label}
              </span>
            </div>

            {/* Inputs (AC3) */}
            {event.inputs && Object.keys(event.inputs).length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Donnees d&apos;entree (Inputs)
                </h5>
                <JsonDisplay data={event.inputs} label="Inputs" />
              </div>
            )}

            {/* Outputs (AC3) */}
            {event.outputs && Object.keys(event.outputs).length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Sortie (Outputs)
                </h5>
                <JsonDisplay data={event.outputs} label="Outputs" />
              </div>
            )}

            {/* Additional details */}
            {event.details && Object.keys(event.details).length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Détails supplémentaires
                </h5>
                <JsonDisplay data={event.details} label="Details" />
              </div>
            )}

            {/* Empty data message */}
            {!event.inputs && !event.outputs && !event.details && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                Aucun détail supplémentaire disponible pour cette étape.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TimelineStep;
