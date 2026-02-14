/**
 * DecisionCard Unit Tests
 * Story 3.2: Implement Picks view with today's decisions list
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DecisionCard } from '@/features/decisions/components';
import type { Decision } from '@/features/decisions/types';

const mockDecision: Decision = {
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

describe('DecisionCard', () => {
  it('renders match information', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    expect(screen.getByText('Lakers')).toBeInTheDocument();
    expect(screen.getByText('Warriors')).toBeInTheDocument();
    expect(screen.getByText(/vs/i)).toBeInTheDocument();
  });

  it('displays status badge', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    const statusBadge = screen.getByRole('status');
    expect(statusBadge).toHaveTextContent('Pick');
  });

  it('shows match time', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    // Time should be displayed (format may vary by locale)
    expect(screen.getByText(/20:00|8:00/)).toBeInTheDocument();
  });

  it('shows league', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    expect(screen.getByText('NBA')).toBeInTheDocument();
  });

  it('displays edge and confidence', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    expect(screen.getByText('5.2%')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
  });

  it('shows rationale preview', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    expect(screen.getByText(mockDecision.rationale)).toBeInTheDocument();
  });

  it('shows recommended pick for PICK status', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    expect(screen.getByText('Lakers ML')).toBeInTheDocument();
  });

  it('does not show recommended pick for NO_BET status', () => {
    const noBetDecision = { ...mockDecision, status: 'NO_BET' as const, recommendedPick: null };
    render(<DecisionCard decision={noBetDecision} />);
    
    expect(screen.queryByText('Recommandation:')).not.toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const handleClick = vi.fn();
    render(<DecisionCard decision={mockDecision} onClick={handleClick} />);
    
    const card = screen.getByTestId('decision-card');
    fireEvent.click(card);
    
    expect(handleClick).toHaveBeenCalledWith(mockDecision);
  });

  it('is keyboard accessible when onClick is provided', () => {
    const handleClick = vi.fn();
    render(<DecisionCard decision={mockDecision} onClick={handleClick} />);
    
    const card = screen.getByTestId('decision-card');
    expect(card).toHaveAttribute('tabIndex', '0');
  });

  it('has correct accessibility attributes', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    const card = screen.getByTestId('decision-card');
    expect(card).toHaveAttribute('role', 'group');
    expect(card).toHaveAttribute('aria-label');
  });
});
