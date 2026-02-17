/**
 * StatusBadge Unit Tests
 * Story 3.6: Implementer le composant StatusBadge avec semantique stricte
 * 
 * Tests:
 * - AC1: Icon + Label + Color consistency
 * - AC2: WCAG AA accessibility
 * - AC3: Size variants (sm/md/lg)
 * - AC4: Strict status validation
 */

/// <reference types="@testing-library/jest-dom" />

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from '../../../src/features/decisions/components/StatusBadge';
import { STATUS_CONFIG, DECISION_STATUS, validateDecisionStatus } from '../../../src/features/decisions/types';
import type { DecisionStatus } from '../../../src/features/decisions/types';

describe('StatusBadge', () => {
  const statuses: { status: DecisionStatus; expectedLabel: string; iconName: string }[] = [
    { status: 'PICK', expectedLabel: 'Pick', iconName: 'CheckCircle' },
    { status: 'NO_BET', expectedLabel: 'No-Bet', iconName: 'Ban' },
    { status: 'HARD_STOP', expectedLabel: 'Hard-Stop', iconName: 'ShieldAlert' },
  ];

  describe('AC1: Icon + Label + Color Display', () => {
    statuses.forEach(({ status, expectedLabel }) => {
      it(`renders ${status} with correct label`, () => {
        render(<StatusBadge status={status} />);
        
        const badge = screen.getByRole('status');
        expect(badge).toHaveTextContent(expectedLabel);
      });

      it(`renders ${status} with correct semantic color`, () => {
        render(<StatusBadge status={status} />);
        
        const badge = screen.getByRole('status');
        expect(badge).toHaveStyle({ color: STATUS_CONFIG[status].color });
      });

      it(`renders ${status} with icon (SVG element)`, () => {
        render(<StatusBadge status={status} />);
        
        const badge = screen.getByRole('status');
        const svg = badge.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('AC2: WCAG AA Accessibility', () => {
    statuses.forEach(({ status, expectedLabel }) => {
      it(`has accessible label for ${status}`, () => {
        render(<StatusBadge status={status} />);
        
        const badge = screen.getByRole('status');
        expect(badge).toHaveAttribute('aria-label', `Statut: ${expectedLabel}`);
      });

      it(`has role="status" for ${status}`, () => {
        render(<StatusBadge status={status} />);
        
        const badge = screen.getByRole('status');
        expect(badge).toBeInTheDocument();
      });
    });

    it('icon is decorative (aria-hidden)', () => {
      render(<StatusBadge status="PICK" />);
      
      const badge = screen.getByRole('status');
      const svg = badge.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('AC3: Size Variants', () => {
    it('supports sm size variant', () => {
      render(<StatusBadge status="PICK" size="sm" />);
      
      const badge = screen.getByRole('status');
      expect(badge.className).toContain('text-xs');
    });

    it('supports md size variant (default)', () => {
      render(<StatusBadge status="PICK" size="md" />);
      
      const badge = screen.getByRole('status');
      expect(badge.className).toContain('text-sm');
    });

    it('supports lg size variant', () => {
      render(<StatusBadge status="PICK" size="lg" />);
      
      const badge = screen.getByRole('status');
      expect(badge.className).toContain('text-base');
    });

    it('defaults to md size', () => {
      render(<StatusBadge status="PICK" />);
      
      const badge = screen.getByRole('status');
      expect(badge.className).toContain('text-sm');
    });
  });

  describe('AC4: Strict Semantic Status', () => {
    it('only accepts valid DecisionStatus values', () => {
      // TypeScript enforces this at compile time
      const validStatuses: DecisionStatus[] = ['PICK', 'NO_BET', 'HARD_STOP'];
      
      validStatuses.forEach(status => {
        expect(() => render(<StatusBadge status={status} />)).not.toThrow();
      });
    });

    it('validates status values at runtime', () => {
      expect(() => validateDecisionStatus('PICK')).not.toThrow();
      expect(() => validateDecisionStatus('NO_BET')).not.toThrow();
      expect(() => validateDecisionStatus('HARD_STOP')).not.toThrow();
    });

    it('throws for invalid status values', () => {
      expect(() => validateDecisionStatus('INVALID')).toThrow('Invalid decision status: INVALID');
      expect(() => validateDecisionStatus('PENDING')).toThrow('Invalid decision status: PENDING');
    });

    it('exports DECISION_STATUS constants', () => {
      expect(DECISION_STATUS.PICK).toBe('PICK');
      expect(DECISION_STATUS.NO_BET).toBe('NO_BET');
      expect(DECISION_STATUS.HARD_STOP).toBe('HARD_STOP');
    });
  });

  describe('Additional Features', () => {
    it('can hide label with showLabel=false', () => {
      render(<StatusBadge status="PICK" showLabel={false} />);
      
      const badge = screen.getByRole('status');
      expect(badge).not.toHaveTextContent('Pick');
      expect(badge.querySelector('svg')).toBeInTheDocument(); // Icon still present
    });

    it('applies custom className', () => {
      render(<StatusBadge status="PICK" className="custom-class" />);
      
      const badge = screen.getByRole('status');
      expect(badge.className).toContain('custom-class');
    });

    it('exports correct semantic colors', () => {
      expect(STATUS_CONFIG.PICK.color).toBe('#047857'); // Updated for WCAG AA compliance
      expect(STATUS_CONFIG.NO_BET.color).toBe('#2563EB');
      expect(STATUS_CONFIG.HARD_STOP.color).toBe('#C2410C');
    });

    it('has data-testid attribute', () => {
      render(<StatusBadge status="PICK" />);
      
      expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    });

    it('has aria-live="polite" for screen reader announcements', () => {
      render(<StatusBadge status="PICK" />);
      
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-live', 'polite');
    });

    it('has aria-atomic="true" for complete announcements', () => {
      render(<StatusBadge status="PICK" />);
      
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('Snapshot Tests (Regression)', () => {
    it('matches snapshot for PICK status', () => {
      const { container } = render(<StatusBadge status="PICK" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for NO_BET status', () => {
      const { container } = render(<StatusBadge status="NO_BET" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for HARD_STOP status', () => {
      const { container } = render(<StatusBadge status="HARD_STOP" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for sm size', () => {
      const { container } = render(<StatusBadge status="PICK" size="sm" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for lg size', () => {
      const { container } = render(<StatusBadge status="PICK" size="lg" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for icon-only display', () => {
      const { container } = render(<StatusBadge status="PICK" showLabel={false} />);
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
