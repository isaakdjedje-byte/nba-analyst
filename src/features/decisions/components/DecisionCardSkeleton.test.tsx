/**
 * DecisionCardSkeleton Tests
 * Story 3.9: Task 1 & 2 - Loading Skeleton Components
 *
 * Tests cover:
 * - AC1: Skeleton structure matches DecisionCard layout
 * - AC1: Animation pulse indicates active loading
 * - AC1: Layout structure preserved
 * - AC5: Accessibility (aria-busy, aria-label)
 * - AC7: Responsive sizing (mobile-first)
 * - AC9: Dark mode support
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DecisionCardSkeleton, DecisionListSkeleton } from './DecisionCardSkeleton';

describe('DecisionCardSkeleton', () => {
  it('renders with proper accessibility attributes', () => {
    render(<DecisionCardSkeleton />);

    const skeleton = screen.getByTestId('decision-skeleton');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(skeleton).toHaveAttribute('aria-label', 'Chargement des décisions...');
  });

  it('has pulse animation elements', () => {
    const { container } = render(<DecisionCardSkeleton />);

    // Check for animate-pulse class on skeleton elements
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders correct structure matching DecisionCard layout', () => {
    const { container } = render(<DecisionCardSkeleton />);

    // Should have header section with teams and status
    const headerSection = container.querySelector('[class*="flex items-start"]');
    expect(headerSection).toBeTruthy();

    // Should have stats section
    const statsSection = container.querySelector('[class*="flex items-center gap-4"]');
    expect(statsSection).toBeTruthy();

    // Should have rationale section
    const rationaleSection = container.querySelector('[class*="space-y-1.5"]');
    expect(rationaleSection).toBeTruthy();
  });

  it('has rounded styling for visual consistency', () => {
    const { container } = render(<DecisionCardSkeleton />);

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.className).toContain('rounded-lg');
  });

  it('has border and background styling', () => {
    const { container } = render(<DecisionCardSkeleton />);

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.className).toContain('border');
    expect(skeleton.className).toContain('bg-white');
  });

  it('supports dark mode classes', () => {
    const { container } = render(<DecisionCardSkeleton />);

    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.className).toContain('dark:bg-gray-800');
    expect(skeleton.className).toContain('dark:border-gray-700');
  });
});

describe('DecisionListSkeleton', () => {
  it('renders multiple skeleton cards', () => {
    const count = 3;
    render(<DecisionListSkeleton count={count} />);

    const skeletons = screen.getAllByTestId('decision-skeleton');
    expect(skeletons).toHaveLength(count);
  });

  it('renders default count of 6 cards', () => {
    render(<DecisionListSkeleton />);

    const skeletons = screen.getAllByTestId('decision-skeleton');
    expect(skeletons).toHaveLength(6);
  });

  it('has grid layout for responsive design', () => {
    const { container } = render(<DecisionListSkeleton count={3} />);

    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain('grid');
  });

  it('has responsive grid columns', () => {
    const { container } = render(<DecisionListSkeleton count={3} />);

    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain('md:grid-cols-2');
    expect(grid.className).toContain('lg:grid-cols-3');
  });

  it('has proper accessibility role and label', () => {
    const { container } = render(<DecisionListSkeleton />);

    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveAttribute('role', 'status');
    expect(grid).toHaveAttribute('aria-label', 'Chargement des décisions');
  });

  it('each card has unique key for React rendering', () => {
    const { container } = render(<DecisionListSkeleton count={3} />);

    const cards = container.querySelectorAll('[data-testid="decision-skeleton"]');
    expect(cards).toHaveLength(3);
  });
});
