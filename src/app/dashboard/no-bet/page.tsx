/**
 * No-Bet Page
 * Shows blocked/paused decisions and No-Bet recommendations.
 */

import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { DecisionList, DecisionListSkeleton } from '@/features/decisions/components';
import { fetchDecisionsServer } from '@/features/decisions/services/decision-service-server';
import { GuardrailBannerWrapper } from '@/features/policy/components/GuardrailBannerWrapper';
import { EmptyNoBetState } from '@/components/ui';
import { Ban } from 'lucide-react';

export default async function NoBetPage() {
  const session = await getServerSession(authOptions);

  let initialDecisions = null;

  if (session) {
    try {
      const response = await fetchDecisionsServer();
      initialDecisions = response.data?.filter((d) => d.status === 'NO_BET' || d.status === 'HARD_STOP') || [];
    } catch (error) {
      console.error('[NoBetPage] Failed to prefetch decisions:', error);
    }
  }

  const hasDecisions = initialDecisions && initialDecisions.length > 0;

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

        {hasDecisions ? (
          <Suspense fallback={<DecisionListSkeleton count={6} />}>
            <DecisionList initialData={initialDecisions} />
          </Suspense>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <EmptyNoBetState />
          </div>
        )}
      </div>
    </div>
  );
}
