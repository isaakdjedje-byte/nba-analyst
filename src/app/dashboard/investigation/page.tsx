/**
 * Investigation Page
 * Story 4.4: Implementer l'investigation de decision contestee
 * 
 * Dashboard page for support/ops to investigate contested decisions
 * 
 * Requirements (AC1-AC5):
 * - AC1: Search by date + match + user (FR23)
 * - AC2: Search filters include date range, match/team, user, decision status
 * - AC3: Full decision timeline displayed
 * - AC4: Gate evaluation, ML outputs, data quality visible
 * - AC5: Export as PDF or copy summary, traceId displayed, audit logging
 * 
 * Page: /dashboard/investigation
 */

import { Suspense } from 'react';
import { InvestigationView } from './InvestigationView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Investigation - NBA Analyst',
  description: 'Investigation de décisions contestées pour support et ops',
};

function InvestigationLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
      </div>
    </div>
  );
}

export default function InvestigationPage() {
  return (
    <main data-testid="investigation-page">
      <Suspense fallback={<InvestigationLoadingFallback />}>
        <InvestigationView />
      </Suspense>
    </main>
  );
}
