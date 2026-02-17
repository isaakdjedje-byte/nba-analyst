/**
 * DegradedState Component Tests
 * Story 3.9: Task 7 - DegradedState component
 *
 * Tests cover:
 * - AC3: Visual indicator for degraded status
 * - AC3: Retry mechanism
 * - AC5: Accessibility (aria-live, role=alert)
 * - AC9: Dark mode support
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DegradedState, DegradedStateBanner } from './degraded-state';

describe('DegradedState', () => {
  it('renders with reason message', () => {
    render(<DegradedState reason="Données partielles disponibles" />);

    expect(screen.getByText('Mode dégradé actif')).toBeInTheDocument();
    expect(screen.getByText('Données partielles disponibles')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<DegradedState reason="Test reason" testId="degraded-test" />);

    const degraded = screen.getByTestId('degraded-test');
    expect(degraded).toHaveAttribute('role', 'alert');
    expect(degraded).toHaveAttribute('aria-live', 'polite');
  });

  it('renders retry button when retry callback provided', () => {
    const handleRetry = vi.fn();
    render(
      <DegradedState
        reason="Test reason"
        retry={handleRetry}
      />
    );

    const retryButton = screen.getByRole('button', { name: /réessayer/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when no callback provided', () => {
    render(<DegradedState reason="Test reason" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has warning styling (amber colors)', () => {
    const { container } = render(<DegradedState reason="Test reason" />);

    // Check for amber/border-amber classes
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-amber-500');
    expect(wrapper.className).toContain('bg-amber-50');
  });

  it('has dark mode support', () => {
    const { container } = render(<DegradedState reason="Test reason" />);

    expect(container.innerHTML).toContain('dark:');
  });

  it('has heading with proper hierarchy', () => {
    render(<DegradedState reason="Test reason" />);

    const heading = screen.getByText('Mode dégradé actif');
    expect(heading.tagName).toBe('H3');
  });

  it('has AlertTriangle icon', () => {
    const { container } = render(<DegradedState reason="Test reason" />);

    // Icon should be present with aria-hidden
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon).toBeTruthy();
  });
});

describe('DegradedStateBanner', () => {
  it('renders with reason message', () => {
    render(<DegradedStateBanner reason="Données partielles disponibles" />);

    expect(screen.getByText('Mode dégradé')).toBeInTheDocument();
    expect(screen.getByText('Données partielles disponibles')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<DegradedStateBanner reason="Test reason" testId="banner-test" />);

    const banner = screen.getByTestId('banner-test');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('renders retry button when retry callback provided', () => {
    const handleRetry = vi.fn();
    render(
      <DegradedStateBanner
        reason="Test reason"
        retry={handleRetry}
      />
    );

    const retryButton = screen.getByRole('button', { name: /réessayer/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('has banner styling', () => {
    const { container } = render(<DegradedStateBanner reason="Test reason" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('w-full');
    expect(wrapper.className).toContain('border');
  });

  it('has responsive layout classes', () => {
    const { container } = render(<DegradedStateBanner reason="Test reason" />);

    // Should have responsive flex classes
    expect(container.innerHTML).toContain('sm:flex-row');
  });
});
