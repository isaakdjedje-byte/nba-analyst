/**
 * useExpansionState Hook
 * Story 3.5: Implement state persistence for expansion
 *
 * Manages expansion state with sessionStorage persistence
 * AC6: Persistent state per session
 * - Multiple cards can be expanded simultaneously
 * - State clears on full page reload
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'decision-expanded-';

/**
 * Hook to manage expansion state with session persistence
 * @param decisionId - Unique identifier for the decision
 * @returns Tuple of [isExpanded, setIsExpanded, toggle]
 */
export function useExpansionState(decisionId: string) {
  // Initialize from sessionStorage on mount (AC6)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${decisionId}`);
      return stored === 'true';
    } catch {
      // sessionStorage not available (e.g., private mode)
      return false;
    }
  });

  // Persist to sessionStorage on change (AC6)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}${decisionId}`, String(isExpanded));
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }, [isExpanded, decisionId]);

  // Toggle function for convenience
  const toggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Expand function
  const expand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  // Collapse function
  const collapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  return {
    isExpanded,
    setIsExpanded,
    toggle,
    expand,
    collapse,
  };
}

/**
 * Hook to track multiple expansion states
 * Useful when managing expansion of multiple cards
 */
export function useMultipleExpansionState(decisionIds: string[]) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') {
      return new Set();
    }
    try {
      const expanded = new Set<string>();
      decisionIds.forEach(id => {
        const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${id}`);
        if (stored === 'true') {
          expanded.add(id);
        }
      });
      return expanded;
    } catch {
      return new Set();
    }
  });

  // Persist changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      // Clear old entries
      decisionIds.forEach(id => {
        if (!expandedIds.has(id)) {
          sessionStorage.removeItem(`${STORAGE_PREFIX}${id}`);
        }
      });
      // Set new entries
      expandedIds.forEach(id => {
        sessionStorage.setItem(`${STORAGE_PREFIX}${id}`, 'true');
      });
    } catch {
      // Ignore storage errors
    }
  }, [expandedIds, decisionIds]);

  const toggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expand = useCallback((id: string) => {
    setExpandedIds(prev => new Set(Array.from(prev).concat(id)));
  }, []);

  const collapse = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(decisionIds));
  }, [decisionIds]);

  const isExpanded = useCallback((id: string) => expandedIds.has(id), [expandedIds]);

  return {
    expandedIds,
    isExpanded,
    toggle,
    expand,
    collapse,
    collapseAll,
    expandAll,
  };
}

export default useExpansionState;
