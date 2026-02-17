/**
 * Status Badge Component
 * Story 3.6: Implementer le composant StatusBadge avec semantique stricte
 * 
 * Requirements:
 * - Icon + label + color (never color alone per NFR20)
 * - WCAG 2.2 AA contrast (NFR19) - All colors pass 4.5:1
 * - Semantic status indication with strict typing
 * - Lucide icons: CheckCircle, Ban, ShieldAlert
 * - Size variants: sm, md, lg
 */

import React from 'react';
import { CheckCircle, Ban, ShieldAlert } from 'lucide-react';
import { STATUS_CONFIG, type DecisionStatus, validateDecisionStatus } from '../types';

interface StatusBadgeProps {
  status: DecisionStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const ICON_MAP = {
  CheckCircle,
  Ban,
  ShieldAlert,
};

// Fixed: sm variant now meets 44x44px touch target requirement (AC3)
const sizeClasses = {
  sm: 'px-3 py-2 text-xs gap-1.5 min-h-[44px] min-w-[44px]',
  md: 'px-3 py-1 text-sm gap-1.5',
  lg: 'px-4 py-1.5 text-base gap-2',
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

// Static class mappings for Tailwind JIT compatibility (AC6 fix)
const bgClassMap: Record<DecisionStatus, { light: string; dark: string }> = {
  PICK: { light: 'bg-emerald-50', dark: 'dark:bg-emerald-900/20' },
  NO_BET: { light: 'bg-blue-50', dark: 'dark:bg-blue-900/20' },
  HARD_STOP: { light: 'bg-orange-50', dark: 'dark:bg-orange-900/20' },
};

const borderClassMap: Record<DecisionStatus, { light: string; dark: string }> = {
  PICK: { light: 'border-emerald-200', dark: 'dark:border-emerald-800' },
  NO_BET: { light: 'border-blue-200', dark: 'dark:border-blue-800' },
  HARD_STOP: { light: 'border-orange-200', dark: 'dark:border-orange-800' },
};

export function StatusBadge({ 
  status, 
  size = 'md', 
  showLabel = true,
  className = '' 
}: StatusBadgeProps) {
  // Runtime validation for strict status enforcement (AC4)
  validateDecisionStatus(status);
  
  const config = STATUS_CONFIG[status];
  const Icon = ICON_MAP[config.icon];
  
  // Use static class mappings for Tailwind JIT compatibility
  const bgClasses = bgClassMap[status];
  const borderClasses = borderClassMap[status];
  
  return (
    <span
      role="status"
      aria-label={`Statut: ${config.label}`}
      aria-live="polite"
      aria-atomic="true"
      data-testid="status-badge"
      className={`
        inline-flex items-center rounded-full border font-medium transition-colors
        ${sizeClasses[size]}
        ${bgClasses.light} ${bgClasses.dark}
        ${borderClasses.light} ${borderClasses.dark}
        ${className}
      `}
      style={{ color: config.color }}
    >
      <Icon 
        className={`${iconSizes[size]} flex-shrink-0`} 
        aria-hidden="true" 
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
