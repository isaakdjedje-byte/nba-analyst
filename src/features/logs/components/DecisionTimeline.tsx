'use client';

interface DecisionTimelineProps {
  decisionId: string;
  showFilters?: boolean;
  onBack?: () => void;
}

export function DecisionTimeline({ decisionId, showFilters = false, onBack }: DecisionTimelineProps) {
  return (
    <div
      data-testid="decision-timeline"
      data-decision-id={decisionId}
      data-show-filters={showFilters ? 'true' : 'false'}
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Retour
        </button>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Timeline indisponible temporairement.
      </p>
    </div>
  );
}

export default DecisionTimeline;
