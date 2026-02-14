/**
 * StatusBadge Unit Tests
 * Story 3.2: Implement Picks view with today's decisions list
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from '@/features/decisions/components';
import type { DecisionStatus } from '@/features/decisions/types';

describe('StatusBadge', () => {
  const statuses: { status: DecisionStatus; expectedLabel: string; expectedIcon: string }[] = [
    { status: 'PICK', expectedLabel: 'Pick', expectedIcon: '✓' },
    { status: 'NO_BET', expectedLabel: 'No-Bet', expectedIcon: '−' },
    { status: 'HARD_STOP', expectedLabel: 'Hard-Stop', expectedIcon: '⚠' },
  ];

  statuses.forEach(({ status, expectedLabel, expectedIcon }) => {
    it(`renders ${status} status with correct label`, () => {
      render(<StatusBadge status={status} />);
      
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent(expectedLabel);
    });

    it(`renders ${status} status with correct icon`, () => {
      render(<StatusBadge status={status} />);
      
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent(expectedIcon);
    });

    it(`has accessible label for ${status} status`, () => {
      render(<StatusBadge status={status} />);
      
      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label', `Statut: ${expectedLabel}`);
    });
  });

  it('renders with correct size classes', () => {
    const { rerender } = render(<StatusBadge status="PICK" size="sm" />);
    
    let badge = screen.getByRole('status');
    expect(badge.className).toContain('text-xs');

    rerender(<StatusBadge status="PICK" size="md" />);
    badge = screen.getByRole('status');
    expect(badge.className).toContain('text-sm');

    rerender(<StatusBadge status="PICK" size="lg" />);
    badge = screen.getByRole('status');
    expect(badge.className).toContain('text-base');
  });

  it('applies custom className', () => {
    render(<StatusBadge status="PICK" className="custom-class" />);
    
    const badge = screen.getByRole('status');
    expect(badge.className).toContain('custom-class');
  });
});
