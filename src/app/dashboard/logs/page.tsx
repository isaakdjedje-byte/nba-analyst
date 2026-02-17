/**
 * Logs Page
 * Displays chronological decision logs with filtering tools.
 */

import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { History } from 'lucide-react';
import { EmptyLogsState } from '@/components/ui';
import { LogsView } from '@/features/logs/components/LogsView';

function LogsPageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
      <div className="mb-6 p-4 rounded-lg border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-white p-4 dark:bg-gray-800 dark:border-gray-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="mt-3 h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="mt-3 h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function LogsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 sm:w-6 sm:h-6" />
            Historique des decisions
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Consultez l&apos;historique complet des decisions et leurs justifications.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <EmptyLogsState />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <History className="w-5 h-5 sm:w-6 sm:h-6" />
          Historique des decisions
        </h2>
        <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300">
          Consultez l&apos;historique complet des decisions et leurs justifications.
        </p>
      </div>

      <Suspense fallback={<LogsPageSkeleton />}>
        <LogsView />
      </Suspense>
    </div>
  );
}
