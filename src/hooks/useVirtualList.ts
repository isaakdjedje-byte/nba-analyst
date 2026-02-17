/**
 * useVirtualList Hook
 * Story 3.8: Virtual scrolling pour listes > 20 éléments (AC6)
 * 
 * AC6: Lecture scannable des décisions avec virtual scrolling
 * AC4: Performance de chargement mobile (60fps)
 * 
 * Utilise @tanstack/react-virtual pour un rendu performant
 * des listes longues sur mobile
 */

'use client';

import { useRef, useCallback } from 'react';
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual';

interface UseVirtualListOptions<T> {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  getItemId?: (item: T, index: number) => string;
}

interface VirtualListResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  virtualItems: VirtualItem[];
  totalSize: number;
  scrollToIndex: (index: number) => void;
  getItemStyle: (index: number) => React.CSSProperties;
  isVirtualized: boolean;
}

/**
 * Hook pour virtualiser une liste d'éléments
 * 
 * AC6: Virtual scrolling pour listes > 20 éléments
 * Maintient 60fps sur mobile avec des listes longues
 * 
 * @param options - Configuration de la virtualisation
 * @returns VirtualListResult avec refs et styles pour le rendu
 */
export function useVirtualList<T>({
  items,
  estimateSize = 120, // Hauteur estimée par item mobile (px)
  overscan = 5, // Nombre d'items à pré-rendre
  getItemId,
}: UseVirtualListOptions<T>): VirtualListResult {
  const containerRef = useRef<HTMLDivElement>(null);

  // AC6: Virtual scrolling uniquement pour listes > 20 éléments
  const shouldVirtualize = items.length > 20;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: useCallback(
      (index: number) => {
        if (getItemId) {
          return getItemId(items[index], index);
        }
        return index;
      },
      [items, getItemId]
    ),
    enabled: shouldVirtualize,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const scrollToIndex = useCallback(
    (index: number) => {
      virtualizer.scrollToIndex(index);
    },
    [virtualizer]
  );

  /**
   * Génère les styles CSS pour un item virtuel
   * Position absolue avec transform pour performance GPU
   */
  const getItemStyle = useCallback(
    (index: number): React.CSSProperties => {
      if (!shouldVirtualize) {
        return {};
      }

      const virtualItem = virtualItems.find((item) => item.index === index);
      if (!virtualItem) {
        return {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${index * estimateSize}px)`,
        };
      }

      return {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualItem.size}px`,
        transform: `translateY(${virtualItem.start}px)`,
      };
    },
    [virtualItems, shouldVirtualize, estimateSize]
  );

  return {
    containerRef,
    virtualItems,
    totalSize,
    scrollToIndex,
    getItemStyle,
    isVirtualized: shouldVirtualize,
  };
}

/**
 * Composant wrapper pour une liste virtuelle
 * Usage:
 * ```tsx
 * const { containerRef, virtualItems, totalSize, getItemStyle } = useVirtualList({
 *   items: decisions,
 *   estimateSize: 140,
 * });
 * 
 * <div ref={containerRef} className="h-full overflow-auto">
 *   <div style={{ height: totalSize, position: 'relative' }}>
 *     {virtualItems.map((virtualItem) => (
 *       <div key={virtualItem.key} style={getItemStyle(virtualItem.index)}>
 *         <DecisionCard decision={decisions[virtualItem.index]} />
 *       </div>
 *     ))}
 *   </div>
 * </div>
 * ```
 */

export default useVirtualList;
