/**
 * No-Bet Page
 * Shows blocked/paused decisions and No-Bet recommendations.
 */

import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { DecisionDateFilter, DecisionList, DecisionListSkeleton } from '@/features/decisions/components';
import { fetchDecisionsServer } from '@/features/decisions/services/decision-service-server';
import { GuardrailBannerWrapper } from '@/features/policy/components/GuardrailBannerWrapper';
import { Ban } from 'lucide-react';

interface NoBetPageProps {
  searchParams?: Promise<{
    date?: string;
  }>;
}

export default async function NoBetPage({ searchParams }: NoBetPageProps) {
  const session = await getServerSession(authOptions);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedDate = resolvedSearchParams?.date;

  let initialDecisions = null;

  if (session) {
    try {
      const response = await fetchDecisionsServer(selectedDate);
      initialDecisions = response.data?.filter((d) => d.status === 'NO_BET' || d.status === 'HARD_STOP') || [];
    } catch (error) {
      console.error('[NoBetPage] Failed to prefetch decisions:', error);
    }
  }

  return (
    <div>
      <GuardrailBannerWrapper />

      <div className="p-3 sm:p-4 md:p-6">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Ban className="w-5 h-5 sm:w-6 sm:h-6" />
            No-Bet
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Consultez les decisions bloquees et les recommandations d&apos;abstention.
          </p>
        </div>

        <DecisionDateFilter testId="nobet-date-filter" statuses={['NO_BET', 'HARD_STOP']} />

        <Suspense fallback={<DecisionListSkeleton count={6} />}>
          <DecisionList
            initialData={initialDecisions || undefined}
            filterStatuses={['NO_BET', 'HARD_STOP']}
            selectedDate={selectedDate}
          />
        </Suspense>
      </div>
    </div>
  );
}
