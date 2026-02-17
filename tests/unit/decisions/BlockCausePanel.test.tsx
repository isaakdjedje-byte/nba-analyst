/**
 * BlockCausePanel Unit Tests
 * Story 5.1: Créer le panneau d'affichage des causes de blocage policy
 *
 * Tests:
 * - AC1: Display specific cause and recommended action
 * - AC2: Show threshold values and progress
 * - AC3: Reference to policy rule
 * - AC4: Data quality metrics display
 * - AC5: Expandable technical details
 * - Security: XSS sanitization
 */

/// <reference types="@testing-library/jest-dom" />

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BlockCausePanel } from '../../../src/features/decisions/components/BlockCausePanel';
import type { BlockCause } from '../../../src/features/decisions/types';

describe('BlockCausePanel', () => {
  const createMockCause = (overrides?: Partial<BlockCause>): BlockCause => ({
    ruleName: 'HARD_STOP_BANKROLL_LIMIT',
    ruleDescription: 'Bankroll limit exceeded',
    triggeredAt: '2026-02-15T10:00:00Z',
    currentValue: 1000,
    threshold: 500,
    recommendation: 'Wait for next period or increase limit',
    relatedPolicyId: 'POLICY-BANKROLL-001',
    category: 'bankroll_limit',
    ...overrides,
  });

  describe('AC1: Display specific cause and recommended action', () => {
    it('renders rule name correctly', () => {
      const cause = createMockCause({ ruleName: 'HARD_STOP_TEST' });
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      expect(screen.getByText('HARD_STOP_TEST')).toBeInTheDocument();
    });

    it('renders rule description correctly', () => {
      const cause = createMockCause({ ruleDescription: 'Test description' });
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('renders recommended action correctly', () => {
      const cause = createMockCause({ recommendation: 'Contact support' });
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      expect(screen.getByText('Contact support')).toBeInTheDocument();
    });
  });

  describe('AC2: Show threshold values and progress', () => {
    it('displays current value and threshold', () => {
      const cause = createMockCause({ currentValue: 750, threshold: 500 });
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      expect(screen.getByText(/750/)).toBeInTheDocument();
      expect(screen.getByText(/500/)).toBeInTheDocument();
    });

    it('renders progress bar with correct percentage', () => {
      const cause = createMockCause({ currentValue: 75, threshold: 100 });
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('AC3: Reference to policy rule', () => {
    it('displays related policy ID in expanded mode', () => {
      const cause = createMockCause({ 
        relatedPolicyId: 'POLICY-TEST-001',
      });
      render(<BlockCausePanel decisionId="test-1" cause={cause} expanded={true} showTechnicalDetails={true} />);

      expect(screen.getByText('POLICY-TEST-001')).toBeInTheDocument();
    });
  });

  describe('AC4: Data quality metrics display', () => {
    it('renders data quality metrics when provided', () => {
      const cause = createMockCause({
        category: 'data_quality',
        dataQualityMetrics: [
          { metric: 'Data Freshness', value: 0.75, threshold: 0.9 },
          { metric: 'Source Reliability', value: 0.85, threshold: 0.85 },
        ],
      });
      render(<BlockCausePanel decisionId="test-1" cause={cause} expanded={true} showTechnicalDetails={true} />);

      expect(screen.getByText('Data Freshness')).toBeInTheDocument();
      expect(screen.getByText('Source Reliability')).toBeInTheDocument();
    });
  });

  describe('AC5: Expandable technical details', () => {
    it('shows expand button when technical details available', () => {
      const cause = createMockCause({ relatedPolicyId: 'POLICY-001' });
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      expect(screen.getByText(/détails techniques/i)).toBeInTheDocument();
    });

    it('expands to show triggered date when clicked', async () => {
      const cause = createMockCause({ relatedPolicyId: 'POLICY-001' });
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      const expandButton = screen.getByText(/Plus de détails techniques/i);
      expect(expandButton).toBeInTheDocument();
    });
  });

  describe('Security: XSS sanitization', () => {
    it('sanitizes rule description to prevent XSS', () => {
      const cause = createMockCause({ 
        ruleDescription: '<script>alert("xss")</script>Test' 
      });
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      // Should not contain raw script tag - sanitized text should be displayed
      const description = screen.queryByText((content) => 
        content.includes('<script>')
      );
      expect(description).not.toBeInTheDocument();
      
      // The sanitized text should be displayed without script tags
      expect(screen.getByText(/Test$/)).toBeInTheDocument();
    });

    it('sanitizes recommendation to prevent XSS', () => {
      const cause = createMockCause({ 
        recommendation: '<img onerror="alert(1)" src="x">Test' 
      });
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      // Should not contain raw img tag
      const recommendation = screen.queryByText((content) =>
        content.includes('<img')
      );
      expect(recommendation).not.toBeInTheDocument();
      
      // The sanitized text should be displayed
      expect(screen.getByText(/Test$/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA role', () => {
      const cause = createMockCause();
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('has correct data-testid', () => {
      const cause = createMockCause();
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      expect(screen.getByTestId('block-cause-panel')).toBeInTheDocument();
    });

    it('has category as data attribute', () => {
      const cause = createMockCause({ category: 'bankroll_limit' });
      render(<BlockCausePanel decisionId="test-1" cause={cause} />);

      const panel = screen.getByTestId('block-cause-panel');
      expect(panel).toHaveAttribute('data-category', 'bankroll_limit');
    });
  });

  describe('Category-specific styling', () => {
    const categories: BlockCause['category'][] = [
      'bankroll_limit',
      'data_quality',
      'model_confidence',
      'drift_detection',
      'service_unavailable',
    ];

    categories.forEach((category) => {
      it(`renders with ${category} category styles`, () => {
        const cause = createMockCause({ category });
        render(<BlockCausePanel decisionId="test-1" cause={cause} />);

        const panel = screen.getByTestId('block-cause-panel');
        expect(panel).toHaveAttribute('data-category', category);
      });
    });
  });
});
