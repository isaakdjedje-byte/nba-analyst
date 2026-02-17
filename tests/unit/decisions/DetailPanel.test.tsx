/**
 * DetailPanel Unit Tests
 * Story 3.5: Ajouter le panneau de détails extensible
 *
 * AC Coverage:
 * - AC2: Confidence and edge breakdown display
 * - AC3: Detailed gate outcomes
 * - AC4: Data signals and metadata
 * - AC9: Graceful degradation for missing data
 */

/// <reference types="@testing-library/jest-dom" />

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DetailPanel } from '../../../src/features/decisions/components/DetailPanel';
import type { DecisionDetail, DataSource, GateOutcomeDetailed, AuditMetadata } from '../../../src/features/decisions/types';

// =============================================================================
// MOCK DATA
// =============================================================================

const mockDataSource: DataSource = {
  name: 'ESPN',
  freshness: '2026-02-14T10:30:00Z',
  reliability: 0.95,
};

const mockGate: GateOutcomeDetailed = {
  name: 'Edge Threshold',
  passed: true,
  threshold: 0.05,
  actual: 0.082,
  description: 'Minimum edge required for pick',
  evaluatedAt: '2026-02-14T10:35:00Z',
};

const mockGateFailed: GateOutcomeDetailed = {
  name: 'Confidence Threshold',
  passed: false,
  threshold: 0.7,
  actual: 0.65,
  description: 'Minimum confidence required',
  evaluatedAt: '2026-02-14T10:35:00Z',
};

const mockMetadata: AuditMetadata = {
  traceId: 'trace-abc123def456',
  timestamp: '2026-02-14T10:35:00Z',
  policyVersion: 'v2.1.0',
  runId: 'run-20260214-001',
  createdBy: 'system',
};

const mockDecisionDetail: DecisionDetail = {
  id: 'decision-001',
  match: {
    id: 'match-001',
    homeTeam: 'Lakers',
    awayTeam: 'Warriors',
    startTime: '2026-02-14T20:00:00Z',
    league: 'NBA',
  },
  status: 'PICK',
  rationale: 'Strong edge with high confidence',
  edge: 0.082,
  confidence: 0.75,
  recommendedPick: 'Lakers -4.5',
  dailyRunId: 'run-001',
  createdAt: '2026-02-14T10:35:00Z',
  confidenceBreakdown: {
    mlConfidence: 0.78,
    historicalAccuracy: 0.72,
    sampleSize: 150,
    adjustedConfidence: 0.75,
  },
  edgeCalculation: {
    impliedProbability: 0.55,
    predictedProbability: 0.632,
    edge: 0.082,
    marketOdds: 1.82,
    fairOdds: 1.58,
  },
  gates: [mockGate, mockGateFailed],
  dataSignals: {
    sources: [mockDataSource],
    mlModelVersion: 'v1.2.3',
    trainingDate: '2026-01-15T00:00:00Z',
  },
  metadata: mockMetadata,
};

const mockDecisionMinimal: DecisionDetail = {
  id: 'decision-002',
  match: {
    id: 'match-002',
    homeTeam: 'Celtics',
    awayTeam: 'Heat',
    startTime: '2026-02-14T21:00:00Z',
    league: 'NBA',
  },
  status: 'NO_BET',
  rationale: 'Edge insufficient',
  edge: 0.02,
  confidence: 0.65,
  recommendedPick: null,
  dailyRunId: 'run-001',
  createdAt: '2026-02-14T10:35:00Z',
  // No extended data - for AC9 testing
};

// =============================================================================
// TESTS
// =============================================================================

describe('DetailPanel', () => {
  // AC2: Content display when expanded
  describe('AC2: Content Display', () => {
    it('renders expanded content when isExpanded=true', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      expect(screen.getByTestId('detail-panel')).toBeInTheDocument();
      expect(screen.getByTestId('confidence-edge-section')).toBeInTheDocument();
      expect(screen.getByTestId('gates-detail-section')).toBeInTheDocument();
      expect(screen.getByTestId('data-signals-section')).toBeInTheDocument();
      expect(screen.getByTestId('metadata-section')).toBeInTheDocument();
    });

    it('renders nothing when isExpanded=false', () => {
      const { container } = render(<DetailPanel decision={mockDecisionDetail} isExpanded={false} />);

      expect(container.firstChild).toBeNull();
    });
  });

  // AC2: Confidence and Edge breakdown
  describe('AC2: ConfidenceEdgeSection', () => {
    it('displays confidence breakdown with all metrics', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      expect(screen.getByText(/Analyse Edge & Confiance/i)).toBeInTheDocument();
      expect(screen.getByText(/Confiance ML/i)).toBeInTheDocument();
      expect(screen.getByText(/Précision historique/i)).toBeInTheDocument();
      expect(screen.getByText(/Taille échantillon/i)).toBeInTheDocument();
      expect(screen.getByText(/Confiance ajustée/i)).toBeInTheDocument();
    });

    it('displays edge calculation breakdown', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      expect(screen.getByText(/Calcul Edge/i)).toBeInTheDocument();
      expect(screen.getByText(/Probabilité implicite/i)).toBeInTheDocument();
      expect(screen.getByText(/Probabilité prédite/i)).toBeInTheDocument();
      expect(screen.getByText(/Cotes marché/i)).toBeInTheDocument();
      expect(screen.getByText(/Cotes justes/i)).toBeInTheDocument();
      expect(screen.getByText(/Edge final/i)).toBeInTheDocument();
    });

    it('falls back to simple display when breakdown data is missing', () => {
      render(<DetailPanel decision={mockDecisionMinimal} isExpanded={true} />);

      // Should still render with fallback display
      expect(screen.getByText(/Analyse Edge & Confiance/i)).toBeInTheDocument();
      expect(screen.getByText(/Edge calculé/i)).toBeInTheDocument();
    });
  });

  // AC3: Detailed gate outcomes
  describe('AC3: GatesDetailSection', () => {
    it('displays gate details with threshold and actual values', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      expect(screen.getAllByText(/Validation Policy/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId('gate-detail-Edge Threshold')).toBeInTheDocument();
      expect(screen.getAllByText(/Seuil:/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Réel:/i).length).toBeGreaterThanOrEqual(1);
    });

    it('shows passed and failed gates with visual distinction', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      // Should show gate summary
      expect(screen.getByText(/1 passé/i)).toBeInTheDocument();
      expect(screen.getByText(/1 échoué/i)).toBeInTheDocument();
    });

    it('displays gates in evaluation sequence order', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      const firstGate = screen.getByText('1.');
      expect(firstGate).toBeInTheDocument();
    });
  });

  // AC4: Data signals
  describe('AC4: DataSignalsSection', () => {
    it('displays ML model information', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      expect(screen.getByText(/Modèle ML/i)).toBeInTheDocument();
      expect(screen.getByText(/v1.2.3/i)).toBeInTheDocument();
      expect(screen.getByText(/Entraîné le/i)).toBeInTheDocument();
    });

    it('displays data sources with reliability scores', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      expect(screen.getByText(/Sources de données/i)).toBeInTheDocument();
      expect(screen.getByText(/ESPN/i)).toBeInTheDocument();
      expect(screen.getByText(/Fiabilité:/i)).toBeInTheDocument();
    });
  });

  // AC4: Metadata
  describe('AC4: MetadataSection', () => {
    it('displays audit metadata', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      expect(screen.getAllByText(/Metadata Audit/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/ID Trace/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/trace-abc123def456/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Version Policy/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/v2.1.0/i)).toBeInTheDocument();
    });

    it('has copy button for traceId', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      const copyButton = screen.getByTestId('copy-traceid');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveAttribute('aria-label', 'Copier ID Trace');
    });
  });

  // AC9: Graceful degradation
  describe('AC9: Graceful Degradation', () => {
    it('handles missing confidence breakdown gracefully', () => {
      render(<DetailPanel decision={mockDecisionMinimal} isExpanded={true} />);

      expect(screen.getByText(/Analyse Edge & Confiance/i)).toBeInTheDocument();
      // Should show fallback UI
    });

    it('handles missing gates gracefully', () => {
      render(<DetailPanel decision={mockDecisionMinimal} isExpanded={true} />);

      expect(screen.getByText(/Validation Policy/i)).toBeInTheDocument();
      expect(screen.getByText(/Informations de validation non disponibles/i)).toBeInTheDocument();
    });

    it('handles missing data signals gracefully', () => {
      render(<DetailPanel decision={mockDecisionMinimal} isExpanded={true} />);

      expect(screen.getAllByText(/Signaux de données/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Informations de signaux de données non disponibles/i)).toBeInTheDocument();
    });

    it('handles missing metadata gracefully', () => {
      render(<DetailPanel decision={mockDecisionMinimal} isExpanded={true} />);

      expect(screen.getAllByText(/Metadata Audit/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Informations de métadonnées non disponibles/i)).toBeInTheDocument();
    });
  });

  // Accessibility
  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);

      // Check for section headings - use getAllByText since text may appear in multiple places
      expect(screen.getAllByText(/Analyse Edge & Confiance/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Validation Policy/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Metadata Audit/i).length).toBeGreaterThanOrEqual(1);
    });

    it('uses semantic HTML elements', () => {
      render(<DetailPanel decision={mockDecisionDetail} isExpanded={true} />);

      // Check for section elements
      const sections = document.querySelectorAll('section');
      expect(sections.length).toBeGreaterThanOrEqual(4);
    });
  });
});
