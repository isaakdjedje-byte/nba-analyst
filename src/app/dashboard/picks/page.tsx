/**
 * Picks Page
 * Displays today's match decisions in a scannable list
 * Story 3.2: Implement Picks view with today's decisions list
 * Story 3.8: Mobile-first responsive design
 * 
 * AC1: Parcours mobile optimisé (< 2 minutes)
 * AC2: Breakpoints responsifs cohérents
 * AC6: Lecture scannable des decisions
 * AC7: Accessibilité mobile
 */

import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { DecisionDateFilter, DecisionList, DecisionListSkeleton } from '@/features/decisions/components';
import { fetchDecisionsServer } from '@/features/decisions/services/decision-service-server';
import { GuardrailBannerWrapper } from '@/features/policy/components/GuardrailBannerWrapper';
import type { Decision } from '@/features/decisions/types';

// Component to display last update timestamp (AC3)
function LastUpdateTimestamp({ initialData }: { initialData: Decision[] | null }) {
  const lastUpdate = initialData?.[0]?.createdAt 
    ? new Date(initialData[0].createdAt)
    : new Date();
  
  const formattedTime = lastUpdate.toLocaleString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <time 
      className="text-xs text-gray-400 dark:text-gray-500"
      dateTime={lastUpdate.toISOString()}
      aria-label="Dernière mise à jour"
    >
      Màj: {formattedTime}
    </time>
  );
}

interface PicksPageProps {
  searchParams?: Promise<{
    date?: string;
  }>;
}

export default async function PicksPage({ searchParams }: PicksPageProps) {
  // Verify authentication (RBAC handled by API)
  const session = await getServerSession(authOptions);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedDate = resolvedSearchParams?.date;
  
  // Pre-fetch decisions on server for faster initial render
  let initialDecisions = null;
  
  if (session) {
    try {
      const response = await fetchDecisionsServer(selectedDate);
      initialDecisions = response.data;
    } catch (error) {
      // Log error but don't fail - client will retry
      console.error('[PicksPage] Failed to prefetch decisions:', error);
    }
  }

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      {/* GuardrailBanner - AC7: Intégration Dashboard */}
      <GuardrailBannerWrapper />
      
      {/* AC1: Mobile-first padding - 3 mobile -> 4 sm -> 6 md */}
      <div className="p-3 sm:p-4 md:p-6">
        {/* Page Header - AC1: Optimisé pour mobile */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              {/* AC7: Font size adaptatif - text-xl mobile, text-2xl desktop */}
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Picks du Jour
              </h2>
              {/* AC7: Date avec text-sm mobile */}
              <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 capitalize">
                {today}
              </p>
            </div>
            {/* AC3: Touch targets >= 44px */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                <span 
                  className="inline-flex h-2 w-2 rounded-full bg-green-500"
                  aria-hidden="true"
                />
                <span>Live</span>
              </div>
              <LastUpdateTimestamp initialData={initialDecisions} />
            </div>
          </div>
          {/* AC6: Description optimisée mobile */}
          <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Consultez les recommandations de paris du jour validées par notre système.
          </p>
        </div>

        <DecisionDateFilter testId="picks-date-filter" statuses={['PICK']} />

        {/* Decision List with Suspense - AC6: Virtual scrolling for > 20 items */}
        <Suspense fallback={<DecisionListSkeleton count={6} />}>
          <DecisionList
            initialData={initialDecisions || undefined}
            filterStatuses={['PICK']}
            selectedDate={selectedDate}
          />
        </Suspense>
      </div>
    </div>
  );
}
