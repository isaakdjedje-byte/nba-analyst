/**
 * GuardrailBanner Unit Tests
 * Story 3.7: Créer le composant GuardrailBanner pour état global
 * 
 * Tests:
 * - AC1: Affichage du statut global avec icône + couleur + label
 * - AC2: Affichage de la cause et action recommandée
 * - AC3: Persistance non-intrusive (sticky/inline)
 * - AC4: Variantes de positionnement
 * - AC5: États sémantiques stricts (HEALTHY/WARNING/HARD_STOP)
 * - AC6: Conformité accessibilité WCAG AA (role, aria-live)
 * - AC8: Cohérence avec StatusBadge (mêmes couleurs)
 */

/// <reference types="@testing-library/jest-dom" />

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GuardrailBanner } from '../../../src/features/policy/components/GuardrailBanner';
import { 
  GUARDRAIL_STATUS_CONFIG, 
  GUARDRAIL_STATUS,
  validateGuardrailStatus 
} from '../../../src/features/policy/types';
import type { GuardrailStatus } from '../../../src/features/policy/types';

describe('GuardrailBanner', () => {
  const statuses: { status: GuardrailStatus; expectedLabel: string; iconName: string }[] = [
    { status: 'HEALTHY', expectedLabel: 'Système opérationnel', iconName: 'CheckCircle' },
    { status: 'WARNING', expectedLabel: 'Attention requise', iconName: 'AlertTriangle' },
    { status: 'HARD_STOP', expectedLabel: 'Bloquage actif', iconName: 'ShieldAlert' },
  ];

  describe('AC1: Affichage du statut global', () => {
    statuses.forEach(({ status, expectedLabel }) => {
      it(`renders ${status} with correct label`, () => {
        render(<GuardrailBanner status={status} />);
        
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();
      });

      it(`renders ${status} with correct semantic color`, () => {
        render(<GuardrailBanner status={status} />);
        
        const banner = screen.getByTestId('guardrail-banner');
        const icon = banner.querySelector('svg');
        expect(icon).toHaveStyle({ color: GUARDRAIL_STATUS_CONFIG[status].color });
      });

      it(`renders ${status} with icon (SVG element)`, () => {
        render(<GuardrailBanner status={status} />);
        
        const banner = screen.getByTestId('guardrail-banner');
        const svg = banner.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });
    });
  });

  describe('AC2: Affichage de la cause et action recommandée', () => {
    it('displays cause and action for HEALTHY status', () => {
      render(<GuardrailBanner status="HEALTHY" />);
      
      expect(screen.getByText(/Tous les indicateurs sont dans les limites acceptables/i)).toBeInTheDocument();
      expect(screen.getByText(/Vous pouvez consulter les recommandations normalement/i)).toBeInTheDocument();
    });

    it('displays cause and action for WARNING status', () => {
      render(<GuardrailBanner status="WARNING" />);
      
      expect(screen.getByText(/Approche des limites de risque/i)).toBeInTheDocument();
      expect(screen.getByText(/Surveillez vos positions et restez vigilant/i)).toBeInTheDocument();
    });

    it('displays cause and action for HARD_STOP status', () => {
      render(<GuardrailBanner status="HARD_STOP" />);
      
      expect(screen.getByText(/Cap de perte journalier atteint/i)).toBeInTheDocument();
      expect(screen.getByText(/Reprise recommandée au prochain cycle/i)).toBeInTheDocument();
    });

    it('uses separator between cause and action', () => {
      render(<GuardrailBanner status="HEALTHY" />);
      
      const text = screen.getByText((content) => 
        content.includes('•') && 
        content.includes('Tous les indicateurs') &&
        content.includes('recommandations')
      );
      expect(text).toBeInTheDocument();
    });
  });

  describe('AC3 & AC4: Variantes de positionnement', () => {
    it('renders sticky variant with sticky positioning classes', () => {
      render(<GuardrailBanner status="HEALTHY" variant="sticky" />);
      
      const banner = screen.getByTestId('guardrail-banner');
      expect(banner).toHaveClass('sticky', 'top-0', 'z-40');
      expect(banner).toHaveAttribute('data-variant', 'sticky');
    });

    it('renders inline variant without sticky classes', () => {
      render(<GuardrailBanner status="HEALTHY" variant="inline" />);
      
      const banner = screen.getByTestId('guardrail-banner');
      expect(banner).not.toHaveClass('sticky');
      expect(banner).toHaveAttribute('data-variant', 'inline');
    });

    it('defaults to sticky variant', () => {
      render(<GuardrailBanner status="HEALTHY" />);
      
      const banner = screen.getByTestId('guardrail-banner');
      expect(banner).toHaveClass('sticky', 'top-0', 'z-40');
    });

    it('is full-width', () => {
      render(<GuardrailBanner status="HEALTHY" />);
      
      const banner = screen.getByTestId('guardrail-banner');
      expect(banner).toHaveClass('w-full');
    });
  });

  describe('AC5: États sémantiques stricts', () => {
    it('only accepts valid GuardrailStatus values', () => {
      const validStatuses: GuardrailStatus[] = ['HEALTHY', 'WARNING', 'HARD_STOP'];
      
      validStatuses.forEach(status => {
        expect(() => render(<GuardrailBanner status={status} />)).not.toThrow();
      });
    });

    it('validates status values at runtime', () => {
      expect(() => validateGuardrailStatus('HEALTHY')).not.toThrow();
      expect(() => validateGuardrailStatus('WARNING')).not.toThrow();
      expect(() => validateGuardrailStatus('HARD_STOP')).not.toThrow();
    });

    it('throws for invalid status values', () => {
      expect(() => validateGuardrailStatus('INVALID')).toThrow('Invalid guardrail status: INVALID');
      expect(() => validateGuardrailStatus('ERROR')).toThrow('Invalid guardrail status: ERROR');
    });

    it('exports GUARDRAIL_STATUS constants', () => {
      expect(GUARDRAIL_STATUS.HEALTHY).toBe('HEALTHY');
      expect(GUARDRAIL_STATUS.WARNING).toBe('WARNING');
      expect(GUARDRAIL_STATUS.HARD_STOP).toBe('HARD_STOP');
    });
  });

  describe('AC6: Conformité accessibilité WCAG AA', () => {
    describe('ARIA roles', () => {
      it('has role="status" for HEALTHY', () => {
        render(<GuardrailBanner status="HEALTHY" />);
        
        const banner = screen.getByTestId('guardrail-banner');
        expect(banner).toHaveAttribute('role', 'status');
      });

      it('has role="alert" for WARNING', () => {
        render(<GuardrailBanner status="WARNING" />);
        
        const banner = screen.getByTestId('guardrail-banner');
        expect(banner).toHaveAttribute('role', 'alert');
      });

      it('has role="alert" for HARD_STOP', () => {
        render(<GuardrailBanner status="HARD_STOP" />);
        
        const banner = screen.getByTestId('guardrail-banner');
        expect(banner).toHaveAttribute('role', 'alert');
      });
    });

    describe('aria-live regions', () => {
      it('has aria-live="polite" for HEALTHY', () => {
        render(<GuardrailBanner status="HEALTHY" />);
        
        const banner = screen.getByTestId('guardrail-banner');
        expect(banner).toHaveAttribute('aria-live', 'polite');
      });

      it('has aria-live="assertive" for WARNING', () => {
        render(<GuardrailBanner status="WARNING" />);
        
        const banner = screen.getByTestId('guardrail-banner');
        expect(banner).toHaveAttribute('aria-live', 'assertive');
      });

      it('has aria-live="assertive" for HARD_STOP', () => {
        render(<GuardrailBanner status="HARD_STOP" />);
        
        const banner = screen.getByTestId('guardrail-banner');
        expect(banner).toHaveAttribute('aria-live', 'assertive');
      });
    });

    describe('ARIA labels', () => {
      it('has accessible label for HEALTHY', () => {
        render(<GuardrailBanner status="HEALTHY" />);
        
        const banner = screen.getByTestId('guardrail-banner');
        expect(banner).toHaveAttribute('aria-label', 'Statut global: Système opérationnel');
      });

      it('has accessible label for WARNING', () => {
        render(<GuardrailBanner status="WARNING" />);
        
        const banner = screen.getByTestId('guardrail-banner');
        expect(banner).toHaveAttribute('aria-label', 'Statut global: Attention requise');
      });

      it('has accessible label for HARD_STOP', () => {
        render(<GuardrailBanner status="HARD_STOP" />);
        
        const banner = screen.getByTestId('guardrail-banner');
        expect(banner).toHaveAttribute('aria-label', 'Statut global: Bloquage actif');
      });
    });

    describe('Icon accessibility', () => {
      it('marks icon as decorative with aria-hidden', () => {
        render(<GuardrailBanner status="HEALTHY" />);
        
        const banner = screen.getByTestId('guardrail-banner');
        const svg = banner.querySelector('svg');
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('AC8: Cohérence avec StatusBadge', () => {
    it('HEALTHY uses same color as StatusBadge PICK (#0E9F6E)', () => {
      expect(GUARDRAIL_STATUS_CONFIG.HEALTHY.color).toBe('#0E9F6E');
    });

    it('HARD_STOP uses same color as StatusBadge HARD_STOP (#C2410C)', () => {
      expect(GUARDRAIL_STATUS_CONFIG.HARD_STOP.color).toBe('#C2410C');
    });

    it('WARNING uses amber color (#B45309)', () => {
      expect(GUARDRAIL_STATUS_CONFIG.WARNING.color).toBe('#B45309');
    });
  });

  describe('Fonctionnalité dismissible', () => {
    it('shows dismiss button when dismissible=true and onDismiss provided', () => {
      const onDismiss = vi.fn();
      render(<GuardrailBanner status="HEALTHY" dismissible onDismiss={onDismiss} />);
      
      const dismissButton = screen.getByLabelText(/Masquer le bandeau/i);
      expect(dismissButton).toBeInTheDocument();
    });

    it('hides dismiss button when dismissible=false', () => {
      render(<GuardrailBanner status="HEALTHY" dismissible={false} />);
      
      const dismissButton = screen.queryByLabelText(/Masquer le bandeau/i);
      expect(dismissButton).not.toBeInTheDocument();
    });

    it('hides dismiss button when onDismiss not provided', () => {
      render(<GuardrailBanner status="HEALTHY" dismissible />);
      
      const dismissButton = screen.queryByLabelText(/Masquer le bandeau/i);
      expect(dismissButton).not.toBeInTheDocument();
    });

    it('calls onDismiss when dismiss button clicked', () => {
      const onDismiss = vi.fn();
      render(<GuardrailBanner status="HEALTHY" dismissible onDismiss={onDismiss} />);
      
      const dismissButton = screen.getByLabelText(/Masquer le bandeau/i);
      fireEvent.click(dismissButton);
      
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('dismiss button has proper touch target size (44x44px)', () => {
      const onDismiss = vi.fn();
      render(<GuardrailBanner status="HEALTHY" dismissible onDismiss={onDismiss} />);
      
      const dismissButton = screen.getByLabelText(/Masquer le bandeau/i);
      expect(dismissButton).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });

    it('dismiss button has focus styles', () => {
      const onDismiss = vi.fn();
      render(<GuardrailBanner status="HEALTHY" dismissible onDismiss={onDismiss} />);
      
      const dismissButton = screen.getByLabelText(/Masquer le bandeau/i);
      expect(dismissButton.className).toContain('focus:ring');
    });
  });

  describe('Responsive Design', () => {
    it('has max-width container for content', () => {
      render(<GuardrailBanner status="HEALTHY" />);
      
      const container = screen.getByTestId('guardrail-banner').querySelector('.max-w-7xl');
      expect(container).toBeInTheDocument();
    });

    it('uses flex layout for content alignment', () => {
      render(<GuardrailBanner status="HEALTHY" />);
      
      const banner = screen.getByTestId('guardrail-banner');
      const flexContainer = banner.querySelector('.flex');
      expect(flexContainer).toBeInTheDocument();
    });
  });

  describe('data-testid attributes', () => {
    it('has data-testid="guardrail-banner"', () => {
      render(<GuardrailBanner status="HEALTHY" />);
      
      expect(screen.getByTestId('guardrail-banner')).toBeInTheDocument();
    });

    it('has data-status attribute', () => {
      render(<GuardrailBanner status="WARNING" />);
      
      const banner = screen.getByTestId('guardrail-banner');
      expect(banner).toHaveAttribute('data-status', 'WARNING');
    });
  });

  describe('Snapshot Tests (Regression)', () => {
    it('matches snapshot for HEALTHY status', () => {
      const { container } = render(<GuardrailBanner status="HEALTHY" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for WARNING status', () => {
      const { container } = render(<GuardrailBanner status="WARNING" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for HARD_STOP status', () => {
      const { container } = render(<GuardrailBanner status="HARD_STOP" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for sticky variant', () => {
      const { container } = render(<GuardrailBanner status="HEALTHY" variant="sticky" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot for inline variant', () => {
      const { container } = render(<GuardrailBanner status="HEALTHY" variant="inline" />);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot with dismiss button', () => {
      const onDismiss = vi.fn();
      const { container } = render(
        <GuardrailBanner status="HEALTHY" dismissible onDismiss={onDismiss} />
      );
      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
