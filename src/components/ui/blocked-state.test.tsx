/**
 * BlockedState Component Tests
 * Story 3.9: Task 8 - BlockedState component
 *
 * Tests cover:
 * - AC4: Hard-stop visual (orange #C2410C)
 * - AC4: Reason and recommended action displayed
 * - AC5: Accessibility (aria-live assertive, proper heading)
 * - NFR20: Icon + text + color redundancy
 * - NFR13: No bypass (screen reader message)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlockedState, InlineBlockedState } from './blocked-state';

describe('BlockedState', () => {
  it('renders with reason and recommended action', () => {
    render(
      <BlockedState
        reason="Limite de risque atteinte"
        recommendedAction="Attendre la fin du match"
      />
    );

    expect(screen.getByText('Décision bloquée')).toBeInTheDocument();
    expect(screen.getByText('Limite de risque atteinte')).toBeInTheDocument();
    expect(screen.getByText('Attendre la fin du match')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <BlockedState
        reason="Test reason"
        recommendedAction="Test action"
        testId="blocked-test"
      />
    );

    const blocked = screen.getByTestId('blocked-test');
    expect(blocked).toHaveAttribute('role', 'alert');
    expect(blocked).toHaveAttribute('aria-live', 'assertive');
  });

  it('has hard-stop orange styling', () => {
    const { container } = render(
      <BlockedState
        reason="Test reason"
        recommendedAction="Test action"
      />
    );

    // Should have orange color classes
    expect(container.innerHTML).toContain('orange-');
    expect(container.innerHTML).toContain('bg-orange-100');
  });

  it('has heading with proper hierarchy (h3)', () => {
    render(
      <BlockedState
        reason="Test reason"
        recommendedAction="Test action"
      />
    );

    const heading = screen.getByText('Décision bloquée');
    expect(heading.tagName).toBe('H3');
  });

  it('has ShieldAlert icon', () => {
    const { container } = render(
      <BlockedState
        reason="Test reason"
        recommendedAction="Test action"
      />
    );

    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon).toBeTruthy();
  });

  it('has no bypass message for screen readers', () => {
    const { container } = render(
      <BlockedState
        reason="Test reason"
        recommendedAction="Test action"
      />
    );

    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).toHaveTextContent(/ne peut pas être contournée/);
  });

  it('has recommended action prominently displayed', () => {
    render(
      <BlockedState
        reason="Test reason"
        recommendedAction="Attendre et observer"
      />
    );

    expect(screen.getByText('Action recommandée')).toBeInTheDocument();
    expect(screen.getByText('Attendre et observer')).toBeInTheDocument();
  });

  it('has dark mode support', () => {
    const { container } = render(
      <BlockedState
        reason="Test reason"
        recommendedAction="Test action"
      />
    );

    expect(container.innerHTML).toContain('dark:');
  });
});

describe('InlineBlockedState', () => {
  it('renders with reason and recommended action', () => {
    render(
      <InlineBlockedState
        reason="Limite de risque atteinte"
        recommendedAction="Attendre la fin du match"
      />
    );

    expect(screen.getByText('Blocage actif')).toBeInTheDocument();
    expect(screen.getByText('Limite de risque atteinte')).toBeInTheDocument();
    expect(screen.getByText('Attendre la fin du match')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(
      <InlineBlockedState
        reason="Test reason"
        recommendedAction="Test action"
        testId="inline-blocked-test"
      />
    );

    const blocked = screen.getByTestId('inline-blocked-test');
    expect(blocked).toHaveAttribute('role', 'alert');
    expect(blocked).toHaveAttribute('aria-live', 'assertive');
  });

  it('has inline card styling', () => {
    const { container } = render(
      <InlineBlockedState
        reason="Test reason"
        recommendedAction="Test action"
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('rounded-lg');
    expect(wrapper.className).toContain('border');
  });

  it('has heading with proper hierarchy (h4)', () => {
    render(
      <InlineBlockedState
        reason="Test reason"
        recommendedAction="Test action"
      />
    );

    const heading = screen.getByText('Blocage actif');
    expect(heading.tagName).toBe('H4');
  });

  it('has action section with border separator', () => {
    const { container } = render(
      <InlineBlockedState
        reason="Test reason"
        recommendedAction="Test action"
      />
    );

    expect(container.innerHTML).toContain('border-t');
  });
});
