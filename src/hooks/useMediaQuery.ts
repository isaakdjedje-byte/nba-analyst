/**
 * useMediaQuery Hook
 * Story 3.8: Mobile-first responsive breakpoint detection
 * 
 * Provides reactive breakpoint detection for mobile-first responsive design
 * AC2: Breakpoints responsifs cohérents
 * AC7: Accessibilité mobile avec détection dynamique
 */

'use client';

import { useState, useEffect } from 'react';

// Breakpoints alignés avec Tailwind config (AC2)
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Hook pour détecter si un media query est actif
 * @param query - Media query string (ex: '(min-width: 768px)')
 * @returns boolean indiquant si le media query match
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Vérifier si window est disponible (SSR safety)
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia(query);
    
    // Initial check
    setMatches(media.matches);

    // Listener pour les changements
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern API (addEventListener)
    if (media.addEventListener) {
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    } else {
      // Fallback pour anciens navigateurs
      media.addListener(handler);
      return () => media.removeListener(handler);
    }
  }, [query]);

  return matches;
}

/**
 * Hook pour détecter la breakpoint actuelle
 * AC2: Mobile-first - défaut est mobile (0-639px)
 * @returns Le breakpoint actif ('sm' | 'md' | 'lg' | 'xl' | '2xl')
 */
export function useBreakpoint(): string {
  const [breakpoint, setBreakpoint] = useState('sm');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const getBreakpoint = (): string => {
      const width = window.innerWidth;
      if (width >= BREAKPOINTS['2xl']) return '2xl';
      if (width >= BREAKPOINTS.xl) return 'xl';
      if (width >= BREAKPOINTS.lg) return 'lg';
      if (width >= BREAKPOINTS.md) return 'md';
      if (width >= BREAKPOINTS.sm) return 'sm';
      return 'mobile'; // < 640px
    };

    const updateBreakpoint = () => {
      setBreakpoint(getBreakpoint());
    };

    // Initial check
    updateBreakpoint();

    // Debounced resize handler for performance
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateBreakpoint, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return breakpoint;
}

/**
 * Hook pour détecter si on est en mobile (< 768px)
 * AC2: Mobile: 320-767px (single-column, touch-optimized)
 * @returns boolean true si viewport < md (768px)
 */
export function useIsMobile(): boolean {
  const isMd = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
  return !isMd;
}

/**
 * Hook pour détecter si on est en tablette (768px - 1023px)
 * AC2: Tablet: 768-1023px (adapted grid, larger touch targets)
 * @returns boolean true si viewport >= md et < lg
 */
export function useIsTablet(): boolean {
  const isMd = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
  const isLg = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
  return isMd && !isLg;
}

/**
 * Hook pour détecter si on est en desktop (>= 1024px)
 * AC2: Desktop: 1024px+ (multi-column potential, hover states)
 * @returns boolean true si viewport >= lg (1024px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
}

/**
 * Hook pour obtenir les dimensions de la fenêtre
 * @returns objet avec width et height
 */
export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateSize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Initial size
    updateSize();

    // Debounced resize handler
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateSize, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return size;
}

export default useMediaQuery;
