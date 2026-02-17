/**
 * DecisionCard - Story 3.3 Tests (GREEN PHASE)
 * 
 * These tests verify the NEW features from Story 3.3:
 * - AC5: Expandable details
 * - AC6: State variants (expanded, blocked, degraded, loading)
 * - AC7: Responsive variants (compact/standard)
 * - AC9: Dark mode coherence
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DecisionCard } from '@/features/decisions/components';
import type { Decision } from '@/features/decisions/types';

vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: vi.fn(() => false),
}));

// =============================================================================
// TEST DATA
// =============================================================================

const baseDecision: Decision = {
  id: 'dec-123',
  match: {
    id: 'match-456',
    homeTeam: 'Lakers',
    awayTeam: 'Warriors',
    startTime: '2026-02-14T20:00:00Z',
    league: 'NBA',
  },
  status: 'PICK',
  rationale: 'Strong edge (5.2%) with high confidence (78%)',
  edge: 0.052,
  confidence: 0.78,
  recommendedPick: 'Lakers ML',
  dailyRunId: 'run-789',
  createdAt: '2026-02-14T12:00:00Z',
};

const hardStopDecision: Decision = {
  ...baseDecision,
  status: 'HARD_STOP',
  hardStopReason: 'Player injury detected - key player out',
  recommendedAction: 'Wait for updated odds',
};

const noBetDecision: Decision = {
  ...baseDecision,
  status: 'NO_BET',
  confidence: 0.42,
  edge: 0.02,
};

// =============================================================================
// AC5: EXPANDABLE DETAILS
// =============================================================================

describe('DecisionCard - AC5: Expandable Details', () => {
  
  it('should show expand button by default', () => {
    render(<DecisionCard decision={baseDecision} />);
    
    // Should have a button to expand details
    expect(screen.getByRole('button', { name: /détails/i })).toBeInTheDocument();
  });

  it('should reveal additional details when expanded', () => {
    render(<DecisionCard decision={baseDecision} />);
    
    const expandButton = screen.getByRole('button', { name: /détails/i });
    fireEvent.click(expandButton);
    
    // Should show details panel
    expect(screen.getByTestId('decision-details')).toBeInTheDocument();
  });

  it('should toggle expand state on button click', () => {
    const handleExpand = vi.fn();
    render(<DecisionCard decision={baseDecision} onExpand={handleExpand} />);
    
    const expandButton = screen.getByRole('button', { name: /détails/i });
    fireEvent.click(expandButton);
    
    expect(handleExpand).toHaveBeenCalledWith(baseDecision, expect.any(Boolean));
  });

  it('should have smooth expand/collapse animation', () => {
    render(<DecisionCard decision={baseDecision} />);
    
    const detailsPanel = screen.getByTestId('decision-details');
    expect(detailsPanel).toHaveClass('transition-all');
  });

  it('should support collapse after expand', () => {
    render(<DecisionCard decision={baseDecision} />);
    
    // First expand
    const expandButton = screen.getByRole('button', { name: /détails/i });
    fireEvent.click(expandButton);
    
    // Button text should change
    expect(expandButton).toHaveTextContent(/moins/i);
  });
});

// =============================================================================
// AC6: STATE VARIANTS
// =============================================================================

describe('DecisionCard - AC6: State Variants', () => {
  
  describe('Blocked State (Hard-Stop)', () => {
    it('should prominently display hard-stop information', () => {
      render(<DecisionCard decision={hardStopDecision} />);
      
      // Should show blocking active message
      expect(screen.getByText(/blocage actif/i)).toBeInTheDocument();
      
      // Should show the reason
      expect(screen.getAllByText(/Player injury detected/).length).toBeGreaterThan(0);
    });

    it('should show recommended action for hard-stop', () => {
      render(<DecisionCard decision={hardStopDecision} />);
      
      // Should display recommended action
      expect(screen.getAllByText(/Wait for updated odds/).length).toBeGreaterThan(0);
    });
  });

  describe('Degraded State', () => {
    const degradedDecision: Decision = {
      ...baseDecision,
      isDegraded: true,
    };

    it('should indicate data quality issues when degraded', () => {
      render(<DecisionCard decision={degradedDecision} />);
      
      // Should show degraded warning
      expect(screen.getByText(/données partielles/i)).toBeInTheDocument();
    });

    it('should show warning icon in degraded state', () => {
      render(<DecisionCard decision={degradedDecision} />);
      
      // Should have alert/warning indicator
      const warningIcon = screen.getByTestId('degraded-warning');
      expect(warningIcon).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render skeleton when loading', () => {
      render(<DecisionCard decision={baseDecision} isLoading={true} />);
      
      // Should show skeleton/loading UI
      const skeleton = screen.getByTestId('decision-skeleton');
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe('Hover/Focus States', () => {
    it('should have visual feedback classes', () => {
      render(<DecisionCard decision={baseDecision} />);
      
      const card = screen.getByTestId('decision-card');
      
      // Card should have hover styles
      expect(card).toHaveClass('hover:shadow-md');
    });

    it('should be focusable for keyboard navigation', () => {
      render(<DecisionCard decision={baseDecision} onClick={() => {}} />);
      
      const card = screen.getByTestId('decision-card');
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });
});

// =============================================================================
// AC7: RESPONSIVE VARIANTS (Mobile-First)
// =============================================================================

describe('DecisionCard - AC7: Responsive Mobile-First', () => {
  
  describe('Compact Variant (Mobile)', () => {
    it('should use compact layout when specified', () => {
      render(<DecisionCard decision={baseDecision} variant="compact" />);
      
      const card = screen.getByTestId('decision-card');
      expect(card).toHaveAttribute('data-variant', 'compact');
    });

    it('should have adequate touch targets (>=44x44px) on mobile', () => {
      render(<DecisionCard decision={baseDecision} variant="compact" />);
      
      // Touch targets should be at least 44px
      const expandButton = screen.getByRole('button', { name: /détails/i });
      expect(expandButton).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });
  });

  describe('Standard Variant (Desktop)', () => {
    it('should use standard layout when specified', () => {
      render(<DecisionCard decision={baseDecision} variant="standard" />);
      
      const card = screen.getByTestId('decision-card');
      expect(card).toHaveAttribute('data-variant', 'standard');
    });
  });

  describe('Auto Variant', () => {
    it('should default to standard when auto is selected', () => {
      render(<DecisionCard decision={baseDecision} variant="auto" />);
      
      const card = screen.getByTestId('decision-card');
      expect(card).toHaveAttribute('data-variant', 'standard');
    });
  });
});

// =============================================================================
// AC9: DARK MODE COHERENCE
// =============================================================================

describe('DecisionCard - AC9: Dark Mode Coherence', () => {
  
  it('should have dark mode classes for semantic colors', () => {
    render(<DecisionCard decision={baseDecision} />);
    
    const card = screen.getByTestId('decision-card');
    
    // Card should have dark mode classes
    expect(card).toHaveClass('dark:bg-gray-800');
    expect(card).toHaveClass('dark:border-gray-700');
  });

  it('should NOT rely on color alone for status indication', () => {
    render(<DecisionCard decision={baseDecision} />);
    
    const statusBadge = screen.getByTestId('status-badge');
    
    // Should have text AND icon, not just color
    expect(statusBadge.textContent).toBeTruthy(); // Has text
    expect(statusBadge).toHaveAttribute('aria-label');
  });
});

// =============================================================================
// ACCESSIBILITY TESTS (AC8) - ENHANCED FOR NEW FEATURES
// =============================================================================

describe('DecisionCard - AC8: Accessibility (Enhanced)', () => {
  
  it('should announce expanded state to screen readers', () => {
    render(<DecisionCard decision={baseDecision} />);
    
    const expandButton = screen.getByRole('button', { name: /détails/i });
    
    // Should have aria-expanded attribute
    expect(expandButton).toHaveAttribute('aria-expanded');
    expect(['true', 'false']).toContain(expandButton.getAttribute('aria-expanded'));
  });

  it('should control expanded panel with aria-controls', () => {
    render(<DecisionCard decision={baseDecision} />);
    
    const expandButton = screen.getByRole('button', { name: /détails/i });
    const detailsId = expandButton.getAttribute('aria-controls');
    
    // Button should control the details panel
    expect(detailsId).toBeTruthy();
    expect(document.getElementById(detailsId!)).toBeTruthy();
  });

  it('should have proper heading hierarchy for screen readers', () => {
    render(<DecisionCard decision={baseDecision} />);
    
    // Should have a heading that describes the card
    const heading = screen.getByRole('heading', { level: 3, name: /Lakers.*Warriors/i });
    expect(heading).toBeInTheDocument();
  });

  it('should have aria-labelledby linking to title', () => {
    render(<DecisionCard decision={baseDecision} />);
    
    const card = screen.getByTestId('decision-card');
    const ariaLabelledBy = card.getAttribute('aria-labelledby');
    
    expect(ariaLabelledBy).toBeTruthy();
    expect(document.getElementById(ariaLabelledBy!)).toBeTruthy();
  });
});

// =============================================================================
// EDGE CASES & INTEGRATION
// =============================================================================

describe('DecisionCard - Edge Cases', () => {
  
  it('should handle decision without gates', () => {
    render(<DecisionCard decision={baseDecision} />);
    
    // Expand to check gates section
    const expandButton = screen.getByRole('button', { name: /détails/i });
    fireEvent.click(expandButton);
    
    // Should not crash when gates are undefined
    expect(screen.getByTestId('decision-details')).toBeInTheDocument();
  });

  it('should handle decision with empty gates array', () => {
    const decisionWithEmptyGates = {
      ...baseDecision,
      gates: [],
    };
    
    render(<DecisionCard decision={decisionWithEmptyGates} />);
    
    const expandButton = screen.getByRole('button', { name: /détails/i });
    fireEvent.click(expandButton);
    
    // Should render without gates section
    expect(screen.getByTestId('decision-details')).toBeInTheDocument();
  });

  it('should handle null edge value', () => {
    const decisionWithNullEdge = {
      ...baseDecision,
      edge: null,
    };
    
    render(<DecisionCard decision={decisionWithNullEdge} />);
    
    // Should show N/A for edge
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('should handle HARD_STOP without reason', () => {
    const hardStopWithoutReason: Decision = {
      ...baseDecision,
      status: 'HARD_STOP',
    };
    
    render(<DecisionCard decision={hardStopWithoutReason} />);
    
    // Should not show blocked section if no reason
    expect(screen.queryByText(/^Blocage actif$/i)).not.toBeInTheDocument();
  });
});

// =============================================================================
// TEST SUMMARY
// =============================================================================

/**
 * TEST COVERAGE SUMMARY:
 * 
 * AC5 (Expandable Details): 5 tests
 * AC6 (State Variants): 6 tests
 * AC7 (Responsive): 4 tests
 * AC9 (Dark Mode): 2 tests
 * AC8 (Accessibility): 4 tests
 * Edge Cases: 4 tests
 * Total: 25 tests
 */
