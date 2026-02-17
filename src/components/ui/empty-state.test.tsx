/**
 * EmptyState Component Tests
 * Story 3.9: Task 3 - EmptyState component
 *
 * Tests cover:
 * - AC2: Icon + title + description + optional action pattern
 * - AC5: Accessibility (proper heading hierarchy, aria-live)
 * - AC9: Dark mode support classes
 * - NFR20: Icon + text (never color alone)
 * - NFR22: Touch targets >= 44px
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Trophy } from 'lucide-react';
import {
  EmptyState,
  EmptyPicksState,
  EmptyNoBetState,
  EmptyPerformanceState,
  EmptyLogsState,
} from './empty-state';

describe('EmptyState', () => {
  it('renders with icon, title, and description', () => {
    render(
      <EmptyState
        icon={Trophy}
        title="Test Title"
        description="Test description"
      />
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <EmptyState
        icon={Trophy}
        title="Test Title"
        description="Test description"
        testId="test-empty"
      />
    );

    const emptyState = screen.getByTestId('test-empty');
    expect(emptyState).toHaveAttribute('role', 'status');
    expect(emptyState).toHaveAttribute('aria-live', 'polite');
  });

  it('renders heading with proper hierarchy (h3)', () => {
    render(
      <EmptyState
        icon={Trophy}
        title="Test Title"
        description="Test description"
      />
    );

    const heading = screen.getByText('Test Title');
    expect(heading.tagName).toBe('H3');
  });

  it('renders action button when actionLabel and onAction provided', () => {
    const handleAction = vi.fn();
    render(
      <EmptyState
        icon={Trophy}
        title="Test Title"
        description="Test description"
        actionLabel="Click me"
        onAction={handleAction}
      />
    );

    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders action link when actionLabel and actionHref provided', () => {
    render(
      <EmptyState
        icon={Trophy}
        title="Test Title"
        description="Test description"
        actionLabel="Go to page"
        actionHref="/test"
      />
    );

    const link = screen.getByRole('link', { name: 'Go to page' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });

  it('has dark mode support classes', () => {
    const { container } = render(
      <EmptyState
        icon={Trophy}
        title="Test Title"
        description="Test description"
      />
    );

    // Check that dark mode classes exist somewhere in the component
    expect(container.innerHTML).toContain('dark:');
  });

  it('has icon container with proper styling', () => {
    const { container } = render(
      <EmptyState
        icon={Trophy}
        title="Test Title"
        description="Test description"
      />
    );

    const iconContainer = container.querySelector('[class*="rounded-full"]');
    expect(iconContainer).toBeTruthy();
  });

  it('has touch target minimum 44px on action button', () => {
    render(
      <EmptyState
        icon={Trophy}
        title="Test Title"
        description="Test description"
        actionLabel="Click me"
        onAction={vi.fn()}
      />
    );

    const button = screen.getByRole('button');
    expect(button.className).toContain('min-h-[44px]');
  });

  it('does not render action when only actionLabel provided without handler', () => {
    render(
      <EmptyState
        icon={Trophy}
        title="Test Title"
        description="Test description"
        actionLabel="Click me"
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('EmptyPicksState', () => {
  it('renders with correct content', () => {
    render(<EmptyPicksState />);

    expect(screen.getByText('Aucun pick disponible')).toBeInTheDocument();
    expect(
      screen.getByText(/Les décisions du jour ne sont pas encore disponibles/)
    ).toBeInTheDocument();
  });

  it('has link to logs page', () => {
    render(<EmptyPicksState />);

    const link = screen.getByRole('link', { name: "Voir l'historique" });
    expect(link).toHaveAttribute('href', '/dashboard/logs');
  });

  it('has correct test id', () => {
    render(<EmptyPicksState />);
    expect(screen.getByTestId('empty-picks-state')).toBeInTheDocument();
  });
});

describe('EmptyNoBetState', () => {
  it('renders with correct content', () => {
    render(<EmptyNoBetState />);

    expect(screen.getByText('Aucune décision no-bet')).toBeInTheDocument();
    expect(
      screen.getByText(/Il n'y a actuellement aucune recommandation no-bet/)
    ).toBeInTheDocument();
  });

  it('has link to picks page', () => {
    render(<EmptyNoBetState />);

    const link = screen.getByRole('link', { name: 'Voir les picks' });
    expect(link).toHaveAttribute('href', '/dashboard/picks');
  });
});

describe('EmptyPerformanceState', () => {
  it('renders with correct content', () => {
    render(<EmptyPerformanceState />);

    expect(screen.getByText('Aucune donnée de performance')).toBeInTheDocument();
    expect(
      screen.getByText(/Les statistiques de performance ne sont pas encore disponibles/)
    ).toBeInTheDocument();
  });

  it('does not have action button', () => {
    render(<EmptyPerformanceState />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('EmptyLogsState', () => {
  it('renders with correct content', () => {
    render(<EmptyLogsState />);

    expect(screen.getByText('Aucun historique disponible')).toBeInTheDocument();
    expect(
      screen.getByText(/L'historique des décisions est vide/)
    ).toBeInTheDocument();
  });
});
