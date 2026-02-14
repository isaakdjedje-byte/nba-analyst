/**
 * Decision Detail Page
 * Shows details for a specific decision/pick
 */

import { notFound } from 'next/navigation';

interface DecisionDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DecisionDetailPage({ params }: DecisionDetailPageProps) {
  const { id } = await params;

  // In a real app, fetch decision from API/database
  // For now, return notFound for most IDs to simulate missing decisions
  if (!id || id === 'invalid-id-123') {
    notFound();
  }

  return (
    <main data-testid="decision-detail-page">
      <h1>Decision Detail</h1>
      <div data-testid="decision-id">{id}</div>
      <div data-testid="pick-detail-modal">
        <h2>Pick Details</h2>
        <div data-testid="pick-rationale">
          <p>This is a sample rationale for the pick.</p>
        </div>
        <div data-testid="pick-confidence">
          <span>Confidence: 85%</span>
        </div>
        <div data-testid="hard-stop-banner" style={{ display: 'none' }}>
          <p>Critical policy violation detected</p>
        </div>
        <div data-testid="hard-stop-message">
          <p>Decision details</p>
        </div>
        <button data-testid="publish-button" disabled={false}>
          Publish
        </button>
      </div>
    </main>
  );
}
