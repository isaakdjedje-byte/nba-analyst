/**
 * Picks Loading State
 * Skeleton placeholder for picks content.
 */

import { DecisionListSkeleton } from '@/features/decisions/components';

export default function PicksLoading() {
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="space-y-2">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>

      <DecisionListSkeleton count={6} />
    </div>
  );
}
