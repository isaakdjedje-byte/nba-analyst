/**
 * Investigation View Component
 * Story 4.4: Implementer l'investigation de decision contestee
 * 
 * Client-side view component for investigation
 */

'use client';

import { useState, useCallback, Suspense } from 'react';
import { InvestigationSearch } from '@/features/investigation/components/InvestigationSearch';
import { InvestigationDetail } from '@/features/investigation/components/InvestigationDetail';
import { useInvestigationSearch, useInvestigationDetail } from '@/features/investigation/hooks/useInvestigationSearch';
import type { InvestigationFilters } from '@/features/investigation/types';

// View modes
type InvestigationView = 'search' | 'detail';

function InvestigationSearchView({ 
  onSelectDecision 
}: { 
  onSelectDecision: (id: string) => void;
}) {
  const [filters, setFilters] = useState<InvestigationFilters>({});
  
  const { 
    results, 
    isLoading, 
    error, 
    total,
  } = useInvestigationSearch(filters, {
    enabled: Object.keys(filters).length > 0,
  });

  const handleSearch = useCallback((newFilters: InvestigationFilters) => {
    setFilters(newFilters);
  }, []);

  const handleSelectDecision = useCallback((decisionId: string) => {
    onSelectDecision(decisionId);
  }, [onSelectDecision]);

  return (
    <InvestigationSearch
      onSearch={handleSearch}
      onSelectDecision={handleSelectDecision}
      results={results}
      isLoading={isLoading}
      error={error}
      totalResults={total}
    />
  );
}

function InvestigationDetailView({ 
  decisionId, 
  onBack 
}: { 
  decisionId: string;
  onBack: () => void;
}) {
  const { data: decision, isLoading, error } = useInvestigationDetail(decisionId);

  return (
    <InvestigationDetail
      decisionId={decisionId}
      decision={decision}
      isLoading={isLoading}
      error={error}
      onBack={onBack}
    />
  );
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Chargement...</p>
      </div>
    </div>
  );
}

export function InvestigationView() {
  const [view, setView] = useState<InvestigationView>('search');
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);

  const handleSelectDecision = useCallback((decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setView('detail');
  }, []);

  const handleBack = useCallback(() => {
    setView('search');
    setSelectedDecisionId(null);
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Investigation de décisions contestées
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Recherchez et investiguez les décisions contestées pour les expliquer aux utilisateurs avec preuves.
        </p>
      </div>

      {/* Main Content */}
      <Suspense fallback={<LoadingFallback />}>
        {view === 'search' && (
          <InvestigationSearchView onSelectDecision={handleSelectDecision} />
        )}

        {view === 'detail' && selectedDecisionId && (
          <InvestigationDetailView 
            decisionId={selectedDecisionId} 
            onBack={handleBack} 
          />
        )}
      </Suspense>
    </div>
  );
}
