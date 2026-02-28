/**
 * Performance Page
 * Shows historical performance metrics and recommendation analytics.
 */

import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { EmptyPerformanceState } from '@/components/ui';
import { PerformanceView } from '@/features/performance/components/PerformanceView';

function PerformancePageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default async function PerformancePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
            Performance
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Analysez les performances historiques et les metriques de recommandation.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <EmptyPerformanceState />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          Performance
        </h2>
        <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300">
          Analysez les performances historiques et les metriques de recommandation.
        </p>
      </div>

      <Suspense fallback={<PerformancePageSkeleton />}>
        <PerformanceView />
      </Suspense>

      {(session.user.role === 'admin' || session.user.role === 'ops') && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-sm">
          <h3 className="text-sm uppercase tracking-wide text-slate-300">ML Operations</h3>
          <p className="mt-2 text-sm text-slate-100">
            Consulte les resultats de la nouvelle pipeline ML, la calibration, le drift et la sante des modeles actifs.
          </p>
          <Link
            href="/admin/ml"
            className="mt-4 inline-flex items-center rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            Ouvrir ML Monitoring
          </Link>
        </section>
      )}
    </div>
  );
}
