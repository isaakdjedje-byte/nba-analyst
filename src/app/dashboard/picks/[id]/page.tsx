/**
 * Decision Detail Page
 * Shows details for a specific decision/pick
 */

import { notFound } from 'next/navigation';
import { getPolicyDecisionById, getPolicyDecisionByTraceId } from '@/server/db/repositories';

interface DecisionDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DecisionDetailPage({ params }: DecisionDetailPageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  const decision = id.startsWith('trace-') || id.startsWith('hist-') || id.startsWith('run-')
    ? await getPolicyDecisionByTraceId(id)
    : await getPolicyDecisionById(id);

  if (!decision) {
    notFound();
  }

  return (
    <main data-testid="decision-detail-page">
      <h1>Decision Detail</h1>
      <div data-testid="decision-id">{decision.id}</div>
      <div data-testid="pick-detail-modal">
        <h2>Pick Details</h2>
        <div data-testid="pick-rationale">
          <p>{decision.rationale}</p>
        </div>
        <div data-testid="pick-confidence">
          <span>Confidence: {(decision.confidence * 100).toFixed(1)}%</span>
        </div>
        <div data-testid="hard-stop-banner" style={{ display: decision.status === 'HARD_STOP' ? 'block' : 'none' }}>
          <p>Critical policy violation detected</p>
        </div>
        <div data-testid="hard-stop-message">
          <p>{decision.hardStopReason || 'Decision details'}</p>
        </div>
        <button data-testid="publish-button" disabled={decision.status === 'HARD_STOP'}>
          Publish
        </button>
      </div>
    </main>
  );
}
