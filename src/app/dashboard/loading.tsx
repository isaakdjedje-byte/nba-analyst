/**
 * Dashboard Loading State
 * Shows skeleton placeholders during tab transitions.
 */

export default function DashboardLoading() {
  return (
    <div className="p-6" data-testid="loading-skeleton">
      <div className="mb-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>

      <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 dark:border-gray-700">
        <div className="mx-auto max-w-md space-y-4">
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}
