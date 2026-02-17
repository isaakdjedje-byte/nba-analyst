/**
 * RationalePanel Unit Tests
 * Story 3.4: Implementer le RationalePanel avec justification courte
 * 
 * AC Coverage:
 * - AC1: Justification visible par defaut
 * - AC2: Explication edge et confiance
 * - AC3: Affichage des gates pertinents
 * - AC7: Accessibilite (ARIA attributes)
 * - AC9: Etat donnees manquantes
 * 
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RationalePanel } from '@/features/decisions/components/RationalePanel';
import type { Decision } from '@/features/decisions/types';

// =============================================================================
// MOCK DATA
// =============================================================================

const mockDecision: Decision = {
  id: 'dec-1',
  match: {
    id: 'match-1',
    homeTeam: 'Lakers',
    awayTeam: 'Warriors',
    startTime: '2026-02-14T20:00:00Z',
    league: 'NBA',
  },
  status: 'PICK',
  rationale: 'Edge favorable de 5.2% avec confiance à 78%. Les Lakers montrent une forme excellente à domicile.',
  edge: 0.052,
  confidence: 0.78,
  recommendedPick: 'Lakers -4.5',
  gates: [
    { name: 'confidence', passed: true, threshold: 0.7, actual: 0.78 },
    { name: 'edge', passed: true, threshold: 0.03, actual: 0.052 },
    { name: 'volume', passed: true, threshold: 1000, actual: 1500 },
  ],
  dailyRunId: 'run-1',
  createdAt: '2026-02-14T10:00:00Z',
};

const mockDecisionNoGates: Decision = {
  ...mockDecision,
  gates: [],
};

const mockDecisionNoRationale: Decision = {
  ...mockDecision,
  rationale: '',
};

const mockDecisionNullRationale: Decision = {
  ...mockDecision,
  rationale: undefined as unknown as string,
};

const mockDecisionNoBet: Decision = {
  ...mockDecision,
  status: 'NO_BET',
  rationale: 'Edge insuffisant (1.2%) et confiance trop faible (45%). Abstention recommandee.',
  edge: 0.012,
  confidence: 0.45,
  gates: [
    { name: 'confidence', passed: false, threshold: 0.7, actual: 0.45 },
    { name: 'edge', passed: false, threshold: 0.03, actual: 0.012 },
  ],
};

const mockDecisionHardStop: Decision = {
  ...mockDecision,
  status: 'HARD_STOP',
  rationale: 'Blocage policy actif: taux de reussite historique insuffisant.',
  hardStopReason: 'Taux de reussite < 55% sur les matchs similaires',
  gates: [
    { name: 'confidence', passed: true, threshold: 0.7, actual: 0.78 },
    { name: 'edge', passed: true, threshold: 0.03, actual: 0.052 },
    { name: 'win_rate', passed: false, threshold: 0.55, actual: 0.48 },
  ],
};

const mockDecisionManyGates: Decision = {
  ...mockDecision,
  gates: [
    { name: 'confidence', passed: true, threshold: 0.7, actual: 0.78 },
    { name: 'edge', passed: true, threshold: 0.03, actual: 0.052 },
    { name: 'volume', passed: true, threshold: 1000, actual: 1500 },
    { name: 'line_movement', passed: true, threshold: 0.02, actual: 0.035 },
    { name: 'sharp_money', passed: false, threshold: 0.6, actual: 0.45 },
  ],
};

// =============================================================================
// TEST SUITE: RationalePanel
// =============================================================================

describe('RationalePanel', () => {
  // ============================================================================
  // AC1: Justification Visible par Defaut
  // ============================================================================
  describe('AC1: Justification Visible par Defaut', () => {
    it('renders rationale text when provided', () => {
      render(<RationalePanel decision={mockDecision} />);
      expect(screen.getByText(mockDecision.rationale)).toBeInTheDocument();
    });

    it('displays rationale in a paragraph element', () => {
      render(<RationalePanel decision={mockDecision} />);
      const rationaleText = screen.getByText(mockDecision.rationale);
      expect(rationaleText.tagName).toBe('P');
    });

    it('applies line-clamp-2 class for concise view', () => {
      render(<RationalePanel decision={mockDecision} />);
      const rationaleText = screen.getByText(mockDecision.rationale);
      expect(rationaleText).toHaveClass('line-clamp-2');
    });
  });

  // ============================================================================
  // AC2: Explication Edge et Confiance
  // ============================================================================
  describe('AC2: Explication Edge et Confiance', () => {
    it('displays contextual explanation for PICK status', () => {
      render(<RationalePanel decision={mockDecision} />);
      expect(screen.getByText(/Edge de 5% avec confiance/i)).toBeInTheDocument();
    });

    it('displays contextual explanation for NO_BET status', () => {
      render(<RationalePanel decision={mockDecisionNoBet} />);
      expect(screen.getAllByText(/Edge insuffisant/i).length).toBeGreaterThan(0);
    });

    it('displays hard stop reason for HARD_STOP status', () => {
      render(<RationalePanel decision={mockDecisionHardStop} />);
      expect(screen.getAllByText(/Taux de reussite/i).length).toBeGreaterThan(0);
    });

    it('formats edge as percentage', () => {
      render(<RationalePanel decision={mockDecision} />);
      expect(screen.getByText(/5%/)).toBeInTheDocument();
    });

    it('formats confidence as percentage', () => {
      render(<RationalePanel decision={mockDecision} />);
      expect(screen.getAllByText(/78%/).length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // AC3: Affichage des Gates Pertinents
  // ============================================================================
  describe('AC3: Affichage des Gates Pertinents', () => {
    it('displays gate indicators when gates exist', () => {
      render(<RationalePanel decision={mockDecision} />);
      expect(screen.getByTestId('gate-indicator-confidence')).toBeInTheDocument();
      expect(screen.getByTestId('gate-indicator-edge')).toBeInTheDocument();
    });

    it('shows passed gates with checkmark icon', () => {
      render(<RationalePanel decision={mockDecision} />);
      const confidenceGate = screen.getByTestId('gate-indicator-confidence');
      expect(confidenceGate).toHaveTextContent('confidence');
    });

    it('shows failed gates with X icon', () => {
      render(<RationalePanel decision={mockDecisionHardStop} />);
      const winRateGate = screen.getByTestId('gate-indicator-win_rate');
      expect(winRateGate).toBeInTheDocument();
    });

    it('limits displayed gates to 3 in embedded variant with overflow indicator', () => {
      render(<RationalePanel decision={mockDecisionManyGates} />);
      const overflowIndicator = screen.getByText('+2');
      expect(overflowIndicator).toBeInTheDocument();
    });

    it('does not show gate section when gates are empty', () => {
      render(<RationalePanel decision={mockDecisionNoGates} />);
      expect(screen.queryByTestId('gates-section')).not.toBeInTheDocument();
    });

    it('shows informative message when gates data is missing', () => {
      render(<RationalePanel decision={mockDecisionNoGates} />);
      expect(screen.getByText(/Informations de validation non disponibles/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // AC6: Variant Embedded
  // ============================================================================
  describe('AC6: Variant Embedded', () => {
    it('renders embedded variant by default', () => {
      render(<RationalePanel decision={mockDecision} />);
      const panel = screen.getByTestId('rationale-panel');
      expect(panel).toHaveClass('mt-2');
    });

    it('renders embedded variant when explicitly specified', () => {
      render(<RationalePanel decision={mockDecision} variant="embedded" />);
      const panel = screen.getByTestId('rationale-panel');
      expect(panel).toHaveClass('mt-2');
    });

    it('renders detailed variant when specified', () => {
      render(<RationalePanel decision={mockDecision} variant="detailed" />);
      const panel = screen.getByTestId('rationale-panel');
      expect(panel).toHaveClass('p-4');
    });

    it('shows expanded content when isExpanded is true', () => {
      render(<RationalePanel decision={mockDecision} isExpanded />);
      const content = screen.getByTestId('rationale-content');
      expect(content).not.toHaveClass('line-clamp-2');
    });
  });

  // ============================================================================
  // AC7: Accessibilite
  // ============================================================================
  describe('AC7: Accessibilite', () => {
    it('renders as a semantic section element', () => {
      render(<RationalePanel decision={mockDecision} />);
      const panel = screen.getByTestId('rationale-panel');
      expect(panel.tagName).toBe('SECTION');
    });

    it('has aria-labelledby attribute pointing to title', () => {
      render(<RationalePanel decision={mockDecision} />);
      const panel = screen.getByTestId('rationale-panel');
      expect(panel).toHaveAttribute('aria-labelledby');
      const labelledBy = panel.getAttribute('aria-labelledby');
      expect(labelledBy).toContain('rationale-title');
    });

    it('includes sr-only title for screen readers', () => {
      render(<RationalePanel decision={mockDecision} />);
      const title = screen.getByText(/Justification pour Lakers contre Warriors/i);
      expect(title).toHaveClass('sr-only');
    });

    it('uses semantic list for gates with proper aria-label', () => {
      render(<RationalePanel decision={mockDecision} />);
      const gatesList = screen.getByLabelText(/Validations policy/i);
      expect(gatesList.tagName).toBe('UL');
    });

    it('provides accessible gate indicators with aria-label', () => {
      render(<RationalePanel decision={mockDecision} />);
      const confidenceGate = screen.getByTestId('gate-indicator-confidence');
      expect(confidenceGate).toHaveAttribute('aria-label');
    });
  });

  // ============================================================================
  // AC8: Dark Mode Coherence
  // ============================================================================
  describe('AC8: Dark Mode Coherence', () => {
    it('applies dark mode text color classes', () => {
      render(<RationalePanel decision={mockDecision} />);
      const rationaleText = screen.getByText(mockDecision.rationale);
      expect(rationaleText).toHaveClass('dark:text-slate-300');
    });

    it('applies dark mode background classes to gate indicators', () => {
      render(<RationalePanel decision={mockDecision} />);
      const gate = screen.getByTestId('gate-indicator-confidence');
      expect(gate).toHaveClass('dark:bg-emerald-900');
    });
  });

  // ============================================================================
  // AC9: Etat Donnees Manquantes
  // ============================================================================
  describe('AC9: Etat Donnees Manquantes', () => {
    it('shows error state when rationale is empty string', () => {
      render(<RationalePanel decision={mockDecisionNoRationale} />);
      expect(screen.getByText(/Données de justification indisponibles/i)).toBeInTheDocument();
    });

    it('shows error state when rationale is undefined', () => {
      render(<RationalePanel decision={mockDecisionNullRationale} />);
      expect(screen.getByText(/Données de justification indisponibles/i)).toBeInTheDocument();
    });

    it('shows error icon with alert icon in error state', () => {
      render(<RationalePanel decision={mockDecisionNoRationale} />);
      const alertIcon = screen.getByTestId('alert-icon');
      expect(alertIcon).toBeInTheDocument();
    });

    it('does not show empty rationale placeholder', () => {
      render(<RationalePanel decision={mockDecisionNoRationale} />);
      expect(screen.queryByTestId('rationale-content')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // AC4: Format Concis et Lisible
  // ============================================================================
  describe('AC4: Format Concis et Lisible', () => {
    it('uses minimum 16px font size for readability', () => {
      render(<RationalePanel decision={mockDecision} />);
      const rationaleText = screen.getByText(mockDecision.rationale);
      // Tailwind text-base = 16px (1rem)
      expect(rationaleText).toHaveClass('text-base');
    });

    it('limits rationale to 2-3 lines by default', () => {
      render(<RationalePanel decision={mockDecision} />);
      const rationaleText = screen.getByText(mockDecision.rationale);
      expect(rationaleText).toHaveClass('line-clamp-2');
    });
  });
});
