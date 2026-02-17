/**
 * Decision Card Skeleton Component
 * Loading placeholder for DecisionCard
 * Story 3.2: Implement Picks view with today's decisions list
 * 
 * Requirements:
 * - Match skeleton layout to actual card layout
 * - Animate-pulse for perceived performance
 */

export function DecisionCardSkeleton() {
  return (
    <div 
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:bg-gray-800 dark:border-gray-700"
      data-testid="decision-skeleton"
      aria-busy="true"
      aria-label="Chargement des décisions..."
    >
      {/* Header Skeleton */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Teams */}
          <div className="h-6 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          {/* Time */}
          <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        {/* Status Badge */}
        <div className="h-7 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Stats Skeleton */}
      <div className="mt-3 flex items-center gap-4">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Rationale Skeleton */}
      <div className="mt-3 space-y-1.5">
        <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

interface DecisionListSkeletonProps {
  count?: number;
}

export function DecisionListSkeleton({ count = 6 }: DecisionListSkeletonProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Chargement des décisions">
      {Array.from({ length: count }).map((_, index) => (
        <DecisionCardSkeleton key={index} />
      ))}
    </div>
  );
}
